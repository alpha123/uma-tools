import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { program, buildOrServe } from '../buildtools.mjs';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dirname, '..', '..');

program.parse();
const options = program.opts();

buildOrServe({
	options,
	root,
	cc_global: false,
	entryPoints: [{in: './app.tsx', out: 'bundle'}],
	artifacts: ['bundle.js', 'bundle.css'],
});
