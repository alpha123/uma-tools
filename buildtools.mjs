import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import { fileURLToPath } from 'node:url';

import { program, Option } from 'commander';

program
	.option('--debug')
	.addOption(new Option('--serve [port]', 'run development server on [port]').preset(8000).implies({debug: true}));

export { program } from 'commander';

function getRedirPlugin(redirects) {
	return {
		name: 'redirect',
		setup(build) {
			Object.keys(redirects).forEach(filter => {
				build.onResolve({filter: new RegExp(filter)}, args => ({
					path: redirects[filter](args)
				}));
			});
		}
	};
}

function getMockAssertPlugin(debug) {
	const mockAssertFn = debug ? 'console.assert' : 'function(){}';
	return {
		name: 'mockAssert',
		setup(build) {
			build.onResolve({filter: /^node:assert$/}, args => ({
				path: args.path, namespace: 'mockAssert-ns'
			}));
			build.onLoad({filter: /.*/, namespace: 'mockAssert-ns'}, () => ({
				contents: 'module.exports={strict:'+mockAssertFn+'};',
				loader: 'js'
			}));
		}
	};
}

const MIME_TYPES = {
	'.html': 'text/html; charset=UTF-8',
	'.css': 'text/css',
	'.js': 'text/javascript',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.otf': 'font/otf',
	'.ttf': 'font/ttf',
	'.woff': 'font/woff'
};

export async function buildOrServe(buildDesc) {
	const port = buildDesc.options.serve;
	const serve = port != null;
	const debug = !!buildDesc.options.debug;

	const buildOptions = {
		entryPoints: buildDesc.entryPoints,
		bundle: true,
		minify: !debug,
		outdir: '.',
		write: !serve,
		define: {CC_DEBUG: debug.toString(), CC_GLOBAL: buildDesc.cc_global.toString()},
		external: ['*.ttf'],
		plugins: [getMockAssertPlugin(debug), getRedirPlugin(buildDesc.redirect ?? {})]
	};

	if (serve) {
		const ctx = await esbuild.context(buildOptions);
		runServer(ctx, port, buildDesc.root, buildDesc.artifacts);
		console.log(`Serving on http://[::]:${port}/ ...`);
	} else {
		await esbuild.build(buildOptions);
	}
}

function runServer(ctx, port, root, artifacts) {
	const requestCount = new Map(artifacts.map(f => [f, 0]));
	let buildCount = 0;
	let output = null;
	// client makes two requests for simulator.worker.js, avoid rebuilding on the second one
	let workerState = 0;
	http.createServer(async (req, res) => {
		let url = req.url.replace(/\/(?:skills|compare|stamina)$/, '/');
		url = url.endsWith('/') ? url + 'index.html' : url;
		const filename = path.basename(url);
		if (artifacts.indexOf(filename) > -1) {
			const requestN = requestCount.get(filename) + (filename == 'simulator.worker.js' ? (workerState = +!workerState) : 1);
			requestCount.set(filename, requestN);
			if (requestN != buildCount) {
				buildCount += 1;
				console.log(`rebuilding ... => ${buildCount}`);
				// NOTE: i feel like we should call ctx.cancel() here in case the previous build is running,
				// but doing so causes the rebuild to not pick up new changes for some reason? slightly confused,
				// perhaps using the API wrong
				//await ctx.cancel();
				output = new Promise(async resolve => {
					const result = await ctx.rebuild();
					resolve(new Map(result.outputFiles.map(o => [path.basename(o.path), o.contents])));
				});
			}
			console.log(`GET ${req.url} 200 OK => ${requestN}`);
			const artifact = (await output).get(filename);
			res.writeHead(200, {
				'Content-type': MIME_TYPES[path.extname(filename)],
				'Content-length': artifact.length
			}).end(artifact);
		} else {
			const fp = path.join(root, url);
			const exists = await fs.promises.access(fp).then(() => true, () => false);
			if (exists) {
				console.log(`GET ${req.url} 200 OK`);
				res.writeHead(200, {'Content-type': MIME_TYPES[path.extname(filename)] || 'application/octet-stream'});
				fs.createReadStream(fp).pipe(res);
			} else {
				console.log(`GET ${req.url} 404 Not Found`)
				res.writeHead(404).end();
			}
		}
	}).listen(port);
}
