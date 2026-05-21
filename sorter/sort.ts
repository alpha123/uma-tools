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

interface Graph {
	rows: number
	cols: number
	vert: number[]
	mat: Uint32Array
}

export function makeGraph(vert: number[]): Graph {
	let n = vert.reduce((a,b) => Math.max(a,b), 0);
	const r = n + 1;
	const c = (r + 31) >>> 5;
	const mat = new Uint32Array(r*c);
	mat[0] = (1<<Math.min(n,31))-1 << 1;
	n -= Math.min(n,31);
	const run = Math.floor(n/32);
	mat.fill(0xffffffff, 1, 1+run);
	n -= 32 * run;
	mat[1+run] = (1<<n)-1|0;
	return {rows: r, cols: c, vert, mat};
}

export function updateEdges(graph: Graph, order: number[]) {
	const {rows: r, cols: c, mat} = graph;
	for (let i = order.length - 2; i >= 0; --i) {
		const u = order[i], v = order[i+1];
		for (let j = 0; j < c; ++j) {
			mat[u*c+j] |= mat[v*c+j];
		}
		mat[(u*(c<<5)+v)>>>5] |= 1 << (v&0x1f);
	}

	for (let k = 0; k < order.length - 1; ++k) {
		const v = order[k];
		for (let u = 1; u < r; ++u) {
			const i = u*(c<<5)+v;
			if (mat[i>>>5] & (1 << (i&0x1f))) {
				for (let j = 0; j < c; ++j) {
					mat[u*c+j] |= mat[v*c+j];
				}
			}
		}
	}
}

export function nextGroup(graph: Graph, k: number): number[] {
	const {rows: r, cols: c, vert, mat} = graph;
	const n = c<<5;
	const lb = Array(r).fill(0), ub = Array(r).fill(r);
	vert.forEach(u => {
		vert.forEach(v => {
			const uv = u*n+v, vu = v*n+u;
			lb[u] += (mat[vu>>>5]>>>(vu&0x1f)) & 1;
			ub[u] -= (mat[uv>>>5]>>>(uv&0x1f)) & 1;
		});
	});

	const group = [];
	for (let i = 0; i < k; ++i) {
		const cand = vert.filter(u => !group.some(v => {
			const uv = u*n+v, vu = v*n+u;
			return u == v || (mat[uv>>>5] & (1 << (uv&0x1f))) || (mat[vu>>>5] & (1 << (vu&0x1f)));
		}));
		if (cand.length == 0) break;
		group.push(cand.reduce(({best,v},u) => ub[u] - lb[u] > best ? {best: ub[u] - lb[u], v: u} : {best,v}, {best: -1, v: -1}).v);
	}
	return group;
}

export function maxPaths(graph: Graph): number[] {
	const {rows: r, cols: c, vert, mat} = graph;
	const n = c<<5;
	const dist = Array(r).fill(0);
	for (let k = 0; k < r - 1; ++k) {
		mat.forEach((x,i) => {
			while (x != 0) {
				const j = 31 - Math.clz32(x);
				const u = (i/c)|0;
				const v = (i%c << 5) + j;
				dist[v] = Math.min(dist[v], dist[u] - 1);
				x &= ~(1 << j);
			}
		});
	}
	return dist;
}
