import * as fc from 'fast-check';
import { prop, forAll } from '../../uma-skill-tools/test/TestHelpers.ts';

import { shuffle, makeGraph, updateEdges, close, nextGroup, maxPaths } from '../sort.ts';

function detectCycles(graph: Uint32Array, vert: number[]) {
	const n = vert.length;
	const dist = Array(n).fill(0);
	const pred = Array(n).fill(-1);
	for (let i = 0; i < n - 1; ++i) {
		vert.forEach(u => {
			vert.forEach(v => {
				const uv = u*n+v;
				const e = (graph[uv>>>5]>>>(uv&0x1f)) & 1;
				if (e && dist[u] - 1 < dist[v]) {
					dist[v] = dist[u] - 1;
					pred[v] = u;
				}
			});
		});
	}
	
	for (let i = 0; i < n; ++i) {
		const u = vert[i];
		for (let j = 0; j < n; ++j) {
			const v = vert[j];
			const uv = u*n+v;
			const e = (graph[uv>>>5]>>>(uv&0x1f)) & 1;
			if (e && dist[u] - 1 < dist[v]) {
				pred[v] = u;
				const visited = Array(n).fill(false);
				visited[v] = true;
				while (!visited[u]) {
					visited[u] = true;
					u = pred[u];
				}
				const cycle = [u];
				v = pred[u];
				while (v != u) {
					cycle.push(v);
					v = pred[v];
				}
				console.error("cycle detected");
				console.error(cycle);
				return true;
			}
		}
	}
	return false;
}

const nk = () => fc.integer({min: 3, max: 255}).chain(n => fc.tuple(fc.constant(n), fc.integer({min: 2, max: n - 1})));

prop('should always result in a sorted list', forAll(nk(), fc.compareFunc(), ([n, k], cmp) => {
	const numbers1 = Array.from({length: n-1}, (_,i) => i+1); {}
	shuffle(numbers1);
	const numbers = [0, ...numbers1];
	const graph = makeGraph(n);
	let next = numbers1.slice(0,k);
	while (next.length > 1) {
		next.sort(cmp);
		updateEdges(graph, n, next);
		next = nextGroup(close(graph, numbers), n, numbers1, k);
		if (next.length == 0) { console.log("impossible?"); return false; }
	}
	const order = maxPaths(graph, numbers);
	numbers1.sort((a,b) => order[b] - order[a]);
	for (let i = 1; i < numbers1.length; ++i) {
		if (cmp(numbers1[i - 1], numbers1[i]) > 0) return false;
	}
	return true;
}));

prop('should never result in cycles even if the user orders inconsistently', forAll(nk(), ([n, k]) => {
	const numbers1 = Array.from({length: n-1}, (_,i) => i+1); {}
	shuffle(numbers1);
	const numbers = [0, ...numbers1];
	const graph = makeGraph(n);
	let next = numbers1.slice(0,k);
	while (next.length > 1) {
		shuffle(next);
		updateEdges(graph, n, next);
		next = nextGroup(close(graph, numbers), n, numbers1, k);
		if (detectCycles(graph, numbers)) return false;
	}
	return true;
}));
