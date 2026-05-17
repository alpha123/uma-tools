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
 */

export function shuffle(a: number[]) {
	for (let i = a.length - 1; i > 0; --i) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
}

export function makeGraph(n: number) {
	const graph = [Array.from({length: n+1}, (_,i) => +(i != 0))];
	for (let i = 0; i < n; ++i) {
		graph.push(Array(n+1).fill(0));

	}
	return graph;
}

export function updateEdges(graph, order) {
	for (let i = 0; i < order.length; ++i) {
		for (let j = i + 1; j < order.length; ++j) {
			graph[order[i]][order[j]] = 1;
		}
	}
}

export function close(graph) {
	const reachable = graph.map(uv => uv.map(e => !!e));
	for (let k = 0; k < graph.length; ++k) {
		for (let i = 0; i < graph.length; ++i) {
			for (let j = 0; j < graph.length; ++j) {
				reachable[i][j] ||= reachable[i][k] && reachable[k][j];
			}
		}
	}
	return reachable;
}

export function nextGroup(reachable, k) {
	const lb = reachable.map((_,u) => reachable.reduce((a,uv) => a + +uv[u], 0)),
		ub = reachable.map(uv => uv.length - uv.reduce((a,e) => a + +e, 0));
	const group = [];
	const nodes = Array.from({length: reachable.length - 1}, (_,i) => i + 1);
	// shuffling is not strictly necessary but because there may be many nodes with the same ub-lb uncertainty score and the
	// first one "wins", shuffle to randomize which that will be to keep the initial comparisons more varied
	shuffle(nodes);
	for (let i = 0; i < k; ++i) {
		const cand = nodes.filter(u => !group.some(v => u == v || reachable[u][v] || reachable[v][u]));
		if (cand.length == 0) break;
		group.push(cand.reduce(({best,v},u) => ub[u] - lb[u] > best ? {best: ub[u] - lb[u], v: u} : {best,v}, {best: 0, v: 0}).v);
	}
	return group;
}

export function maxPaths(graph) {
	const dist = graph.map(_ => 0);
	const pred = graph.map(_ => -1);
	for (let i = 0; i < graph.length - 1; ++i) {
		graph.forEach((uv, u) => {
			uv.forEach((e, v) => {
				if (e && dist[u] - 1 < dist[v]) {
					dist[v] = dist[u] - 1;
					pred[v] = u;
				}
			});
		});
	}
	return dist;
}
