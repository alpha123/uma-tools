import * as fc from 'fast-check';
import { prop, forAll } from '../../uma-skill-tools/test/TestHelpers.ts';

import { shuffle, makeGraph, updateEdges, nextGroup, maxPaths } from '../sort.ts';

function detectCycles(graph: Graph) {
	const {rows: r, cols: c, vert, mat} = graph;
	const n = c<<5;
	const dist = Array(r).fill(0);
	const pred = Array(r).fill(-1);
	for (let i = 0; i < r - 1; ++i) {
		vert.forEach(u => {
			vert.forEach(v => {
				const uv = u*n+v;
				const e = mat[uv>>>5] & (1 << (uv&0x1f));
				if (e && dist[u] - 1 < dist[v]) {
					dist[v] = dist[u] - 1;
					pred[v] = u;
				}
			});
		});
	}

	for (let i = 0; i < vert.length; ++i) {
		const u = vert[i];
		for (let j = 0; j < vert.length; ++j) {
			const v = vert[j];
			const uv = u*n+v;
			const e = mat[uv>>>5] & (1 << (uv&0x1f));
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

const nk = () => fc.integer({min: 3, max: 254}).chain(n => fc.tuple(fc.constant(n), fc.integer({min: 2, max: n - 1})));

prop('should always result in a sorted list', forAll(nk(), fc.compareFunc(), ([n, k], cmp) => {
	const numbers = Array.from({length: n}, (_,i) => i+1); {}
	shuffle(numbers);
	const graph = makeGraph(numbers);
	let next = numbers.slice(0,k);
	while (next.length > 1) {
		next.sort(cmp);
		updateEdges(graph, next);
		next = nextGroup(graph, k);
		if (next.length == 0) { console.log("impossible?"); return false; }
	}
	const order = maxPaths(graph);
	numbers.sort((a,b) => order[b] - order[a]);
	for (let i = 1; i < numbers.length; ++i) {
		if (cmp(numbers[i - 1], numbers[i]) > 0) return false;
	}
	return true;
}));

prop('should never result in cycles even if the user orders inconsistently', forAll(nk(), ([n, k]) => {
	const numbers = Array.from({length: n}, (_,i) => i+1); {}
	shuffle(numbers);
	const graph = makeGraph(numbers);
	let next = numbers.slice(0,k);
	while (next.length > 1) {
		shuffle(next);
		updateEdges(graph, next);
		next = nextGroup(graph, k);
		if (detectCycles(graph)) return false;
	}
	return true;
}));
