import { h, Fragment, render } from 'preact';
import { useState, useMemo, useEffect, useRef } from 'preact/hooks';

import { dragula } from './dragula';

import { shuffle, makeGraph, updateEdges, close, nextGroup, maxPaths } from './sort';

import umas from '../umas.json';

import '../UmaUI.css';
import './app.css';

const STEPSIZE = 3;

function App(props) {
	const sortlist = useRef(null);
	const [order, setOrder] = useState(null);

	useEffect(function () {
		if (sortlist.current == null) return;
		const d = dragula([sortlist.current]);
		return () => d.destroy();
	}, [sortlist.current]);

	const NNUM = 20;
	const numbers = useMemo(() => { const n = Array.from({length: NNUM}, (_,i)=>i+1); shuffle(n); console.log(n); return n; }, []);
	//const numbers = [ 2, 7, 9, 4, 3, 5, 6, 1, 8, 10 ];
	//const numbers = [ 5, 6, 1, 4, 8, 3, 9, 2, 10, 7 ];

	const [graph, setGraph] = useState(() => makeGraph(NNUM));
	const [group, setGroup] = useState(() => numbers.slice(0,STEPSIZE));

	const [steps, setSteps] = useState(0);
	function step() {
		const order = Array.from(sortlist.current.children).map(el => +el.dataset.n);
		const newGraph = [...graph];  // i don't think it matters that we don't actually do a deep copy here, but keep an eye on it
		updateEdges(newGraph, order);
		setGraph(newGraph);
		const reachable = close(newGraph);
		const next = nextGroup(reachable, STEPSIZE);
		if (next.length == 1) {
			const dist = maxPaths(newGraph);
			setOrder(dist);
		} else {
			setGroup(next);
		}
		setSteps(steps + 1);
	}

	let final = null;
	if (order != null) {
		final = numbers.sort((a,b) => order[b] - order[a]);
	}

	return (
		<div>
			{order != null
				? <ul>{final.map(n => <li key={'final-' + n}>{n}</li>)}</ul>
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
