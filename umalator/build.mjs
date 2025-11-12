import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { program } from 'commander';

program
	.option('--debug');

program.parse();
const options = program.opts();
const debug = !!options.debug;

const dirname = path.dirname(fileURLToPath(import.meta.url));

const mockAssertFn = debug ? 'console.assert' : 'function(){}';
const mockAssert = {
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

const redirectTable = {
	name: 'redirectTable',
	setup(build) {
		build.onResolve({filter: /^@tanstack\//}, args => ({
			path: path.join(dirname, '..', 'vendor', args.path.slice(10), 'index.ts')
		}));
	}
};

await esbuild.build({
	entryPoints: [{in: path.join(dirname, 'app.tsx'), out: 'bundle'}, path.join(dirname, 'simulator.worker.ts')],
	bundle: true,
	minify: !debug,
	outdir: 'umalator',
	define: {CC_DEBUG: debug.toString(), CC_GLOBAL: 'false'},
	external: ['*.ttf'],
	plugins: [mockAssert, redirectTable]
});
