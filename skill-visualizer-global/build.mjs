import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { program, buildOrServe } from '../buildtools.mjs';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dirname, '..', '..');
const datadir = path.join(dirname, '..', 'umalator-global');

program.parse();
const options = program.opts();

buildOrServe({
	options,
	root,
	cc_global: true,
	entryPoints: [{in: '../skill-visualizer/app.tsx', out: 'bundle'}],
	artifacts: ['bundle.js', 'bundle.css'],
	redirect: {
		"^\.\.?(?:/uma-skill-tools)?/data/": args => path.join(datadir, args.path.split('/data/')[1]),
		"skill_meta.json$": _ => path.join(datadir, 'skill_meta.json'),
		"umas.json$": _ => path.join(datadir, 'umas.json')
	}
});
