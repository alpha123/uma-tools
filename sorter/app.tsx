import { h, Fragment, render } from 'preact';
import { useState, useMemo, useEffect, useRef } from 'preact/hooks';

import { dragula } from './dragula';

import umas from '../umas.json';

import '../UmaUI.css';
import './app.css';

function shuffle(a: number[]) {
	for (let i = a.length - 1; i > 0; --i) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
}

function close(graph) {
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

/*function unreachableSet(reachable, u) {
	const Uset = new Set();
	for (let v = 0; v < reachable.length; ++v) {
		if (v != u && !reachable[u][v] && !reachable[v][u]) {
			Uset.add(v);
		}
	}
	return Uset;
}*/

function nextGroup(reachable) {
	/*const nunknown = reachable.map((uv, u) => uv.reduce((a,e) => a + +!e, 0) + reachable.reduce((a,vu) => a + +!vu[u], 0));
	//console.log("unknown:", nunknown);
	return nunknown.map((n,v) => [v,n]).sort((a,b) => b[1] - a[1]).map(p => p[0]).slice(0,STEPSIZE);*/


	/*const maxU = nunknown.reduce(({n,v}, uk, i) => uk > n ? {n:uk, v:i} : {n,v}, {n:1, v:0}).v;
	console.log(maxU);
	const maxUset = unreachableSet(reachable, maxU);
	return reachable
		.map((_,u) => [u,unreachableSet(reachable, u).intersection(maxUset).size])
		.sort((a,b) => b[1] - a[1])
		.map(p => p[0])
		.slice(0,STEPSIZE);*/

	const lb = reachable.map((_,u) => reachable.reduce((a,uv) => a + +uv[u], 0)),
		ub = reachable.map(uv => uv.length - uv.reduce((a,e) => a + +e, 0));
	//console.log("lb", lb);
	//console.log("ub", ub);
	//return ub.map((x,v) => [v,x-lb[v]]).sort((a,b) => b[1] - a[1]).map(p => p[0]).slice(0,STEPSIZE);
	const group = [];
	const nodes = Array.from({length: reachable.length - 1}, (_,i) => i + 1);
	// shuffling is not strictly necessary but because there may be many nodes with the same ub-lb uncertainty score and the
	// first one "wins", shuffle to randomize which that will be to keep the initial comparisons more varied
	shuffle(nodes);
	for (let i = 0; i < STEPSIZE; ++i) {
		const cand = nodes.filter(u => !group.some(v => u == v || reachable[u][v] || reachable[v][u]));
		if (cand.length == 0) break;
		group.push(cand.reduce(({best,v},u) => ub[u] - lb[u] > best ? {best: ub[u] - lb[u], v: u} : {best,v}, {best: 0, v: 0}).v);
	}
	return group;
}

function maxPath(graph) {
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

	graph.forEach((uv, u) => {
		uv.forEach((e, v) => {
			if (e && dist[u] - 1 < dist[v]) {
				pred[v] = u;
				const visited = graph.map(_ => false);
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
				console.log("cycle detected");
				console.log(cycle);
			}
		});
	});

	return dist;
}

const STEPSIZE = 3;

function App(props) {
	const sortlist = useRef(null);
	const [order, setOrder] = useState(null);

	useEffect(function () {
		if (sortlist.current == null) return;
		const d = dragula([sortlist.current]);
		return () => d.destroy();
	}, [sortlist.current]);

	const NNUM = 141;
	const numbers = useMemo(() => { const n = Array.from({length: NNUM}, (_,i)=>i+1); shuffle(n); console.log(n); return n; }, []);
	//const numbers = [ 2, 7, 9, 4, 3, 5, 6, 1, 8, 10 ];
	//const numbers = [ 5, 6, 1, 4, 8, 3, 9, 2, 10, 7 ];

	const [graph, setGraph] = useState(() => [Array.from({length: NNUM+1}, (_,i) => +(i != 0))].concat(numbers.map(_ => Array.from({length: NNUM+1}, _ => 0))));
	const [group, setGroup] = useState(() => numbers.slice(0,STEPSIZE));

	const [steps, setSteps] = useState(0);
	function step() {
		const order = Array.from(sortlist.current.children).map(el => +el.dataset.n);
		const newGraph = [...graph];  // i don't think it matters that we don't actually do a deep copy here, but keep an eye on it
		for (let i = 0; i < order.length; ++i) {
			for (let j = i + 1; j < order.length; ++j) {
				newGraph[order[i]][order[j]] = 1;
			}
		}

		const dist = maxPath(newGraph);
		//console.log(newGraph);
		//console.log(dist);
		const counts = Map.groupBy(numbers, n => dist[n]);
		//console.log(counts);
		setGraph(newGraph);
		const mode = Array.from(counts.values()).reduce((a,b) => a.length > b.length ? a : b);
		//console.log("closure");
		const reachable = close(graph);
		//console.log(reachable);
		const next = nextGroup(reachable);
		//console.log("nextGroup", next);
		if (mode.length == 1) {
			setOrder(dist);
		} else {
			//shuffle(mode);
			//setGroup(mode.slice(0,STEPSIZE));
			setGroup(next);
		}
		setSteps(steps + 1);
	}

	let final = null;
	if (order != null) {
		final = numbers.sort((a,b) => {
			//console.log(a, order[a]);
			//console.log(b, order[b]);
			return order[b] - order[a]
		});
		console.log("final:", final);
	}

	return (
		<div>
			{order != null
				? <ul>{final.map(n => <li>{n}</li>)}</ul>
				: <ul id="sortlist" ref={sortlist}>
					  {group.map(n => <li key={n} data-n={n}>{n}</li>)}
				</ul>
			}
			<div>{steps} steps</div>
			{order == null && <button class="stdBtn btnType1" onClick={step}>Next</button>}
		</div>
	);
}

try {
	window.parent && window.parent.location.hostname;
	render(<App />, document.getElementById('app'));
} catch (e) {
	if (e instanceof DOMException) {
		document.getElementById('app').innerHTML = '<p style="font-size:22px"><span style="border:3px solid orange;border-radius:3em;color:orange;display:inline-block;font-weight:bold;height:1.8em;line-height:1.8em;text-align:center;width:1.8em">!</span> You are probably on some kind of scummy ad-infested rehosting site. The official URL for this sorter is <a href="https://alpha123.github.io/uma-tools/sorter/" target="_blank">https://alpha123.github.io/uma-tools/sorter/</a>.</p>'
	} else {
		throw e;
	}
}
