/**
 * our goal is to minimize the number of comparisons presented to the user required to fully sort the array. the
 * algorithm below derives from the observation that it's not really any more costly for a human to rank 3 items than to
 * pick one of two (or at least even if it takes longer it requires fewer comparisons and the hypothesis is that this is
 * a favourable tradeoff).
 *
 * we represent ordering progress so far as a graph where there is an edge between nodes u and v if the user ranked u
 * ahead of v. the order of a vertex in the final ranking is the longest path from the root node to that vertex. we
 * hypothesize that the selection algorithm below ensures that cycles will never be formed in the graph (NB. see below),
 * which means that the final ordering can be done in linear time.
 *
 * at each step we compute the transitive closure of the graph. the lower bound of a vertex in the final ranking is its
 * number of incoming edges in the transitive closure, and the upper bound is |V| - the number of its outgoing edges.
 * the vertices selected to be ordered by the user in the next step are those with the widest bounds that are not
 * reachable from each other. (this is done greedily, i.e. select the vertex v₁ with the widest bounds, then the next
 * vertex with the widest bounds not reachable from v₁ and that can't reach v₁, etc. i think this is not guaranteed to
 * find the optimal set and possibly not even guaranteed to be a good approximation of the optimal set.)
 *
 * this relies on two unproven assumptions:
 *   - this eventually terminates
 *   - this method of picking candidates makes cycles impossible no matter how the user sorts the candidates
 *
 * the tests in test/sort.ts are there to verify this is hopefully true.
 *
 * this approach is inspired by this stackoverflow answer https://stackoverflow.com/a/867740 but the selection heuristic
 * they propose of most common maximum path length does not actually work very well in practice (it usually results in
 * many more comparisons than the heuristic used here for example, sometimes twice as many in the worst case)
 */

export function shuffle(a: number[]) {
	for (let i = a.length - 1; i > 0; --i) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
}

export function makeGraph(n: number): Uint32Array {
	const graph = new Uint32Array(Math.ceil(n*n/32));
	graph[0] = (1<<Math.min(n-1,31))-1 << 1;
	n -= Math.min(n,32);
	const run = Math.floor(n/32);
	graph.fill(0xffffffff, 1, 1+run);
	n -= 32 * run;
	graph[1+run] = (1<<n)-1|0;
	return graph;
}

export function updateEdges(graph: Uint32Array, nvert: number, order: number[]) {
	for (let i = 0; i < order.length; ++i) {
		for (let j = i + 1; j < order.length; ++j) {
			const idx = order[i] * nvert + order[j];
			graph[idx>>>5] |= 1 << (idx&0x1f);
		}
	}
}

export function close(graph: Uint32Array, vert: number[]) {
	const n = vert.length;
	const reachable = new Uint32Array(graph);
	vert.forEach(k => {
		vert.forEach(i => {
			vert.forEach(j => {
				const ij = i*n+j, ik = i*n+k, kj = k*n+j;
				reachable[ij>>>5] |= ((reachable[ik>>>5]>>>(ik&0x1f)) & (reachable[kj>>>5]>>>(kj&0x1f)) & 1) << (ij&0x1f);
			});
		});
	});
	return reachable;
}

export function nextGroup(reachable: Uint32Array, n: number, vert: number[], k: number) {
	const lb = Array(n).fill(0), ub = Array(n).fill(n);
	vert.forEach(u => {
		vert.forEach(v => {
			const uv = u*n+v, vu = v*n+u;
			lb[u] += (reachable[vu>>>5]>>>(vu&0x1f)) & 1;
			ub[u] -= (reachable[uv>>>5]>>>(uv&0x1f)) & 1;
		});
	});

	const group = [];
	for (let i = 0; i < k; ++i) {
		const cand = vert.filter(u => !group.some(v => {
			const uv = u*n+v, vu = v*n+u;
			return u == v || ((reachable[uv>>>5]>>>(uv&0x1f))&1) || ((reachable[vu>>>5]>>>(vu&0x1f))&1);
		}));
		if (cand.length == 0) break;
		group.push(cand.reduce(({best,v},u) => ub[u] - lb[u] > best ? {best: ub[u] - lb[u], v: u} : {best,v}, {best: 0, v: 0}).v);
	}
	return group;
}

export function maxPaths(graph: Uint32Array, vert: number[]) {
	const n = vert.length;
	const dist = Array(n).fill(0);
	for (let i = 0; i < n - 1; ++i) {
		vert.forEach(u => {
			vert.forEach(v => {
				const uv = u*n+v;
				const e = (graph[uv>>>5]>>>(uv&0x1f)) & 1;
				if (e && dist[u] - 1 < dist[v]) {
					dist[v] = dist[u] - 1;
				}
			});
		});
	}
	return dist;
}
