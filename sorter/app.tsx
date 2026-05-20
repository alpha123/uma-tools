import { h, Fragment, render } from 'preact';
import { useState, useMemo, useEffect, useRef } from 'preact/hooks';

import Sortable from '../vendor/sortable';

import { shuffle, makeGraph, updateEdges, close, nextGroup, maxPaths } from './sort';

import umas from '../umas.json';

import '../UmaUI.css';
import './app.css';

const STEPSIZE = 3;

function UmaTab(props) {
	const id = props.shortId + 1000;
	return (
		<li class="umatab" data-id={props.shortId}>
			<img src={`stand/chara_stand_${id}_${id*100+1}.png`} width="250" draggable="false" />
			<span>{props.name}</span>
		</li>
	);
}

function App(props) {
	const sortlist = useRef(null);
	const [order, setOrder] = useState(null);

	useEffect(function () {
		if (sortlist.current == null) return;
		const d = Sortable.create(sortlist.current, {
			dataIdAttr: 'data-id',
			ghostClass: 'gu-transit',
			forceFallback: true,
			fallbackClass: 'gu-mirror'
		});
		return () => d.destroy();
	}, [sortlist.current]);

	const [undoStack, setUndoStack] = useState(null);

	function pushUndo(mat) {
		setUndoStack({car: mat, cdr: undoStack});
	}

	function popUndo() {
		setUndoStack(undoStack.cdr);
		return undoStack.car;
	}

	const [names, setNames] = useState([]);
	const [graph, setGraph] = useState(null);
	const [group, setGroup] = useState([]);
	useEffect(function () {
		fetch('../umas.json').then(resp => resp.json()).then(umas => {
			const ids = Object.keys(umas).filter(id => +id < 2000).map(id => +id - 1000);
			const names = [];
			ids.forEach(id => names[id] = umas[id+1000].name[1]);
			setNames(names);
			shuffle(ids);
			setGraph(makeGraph(ids));
			setGroup(ids.slice(0,STEPSIZE));
		});
	}, []);

	const [steps, setSteps] = useState(0);
	function step() {
		const order = Array.from(sortlist.current.children).map(el => +el.dataset.id);
		pushUndo(graph.mat);
		const newGraph = {...graph, mat: new Uint32Array(graph.mat)};
		updateEdges(newGraph, order);
		setGraph(newGraph);
		let next = nextGroup(newGraph, STEPSIZE);
		next = next.filter(id => id != 0);
		if (next.length == 1) {
			const dist = maxPaths(newGraph);
			setOrder(dist);
		} else {
			setGroup(next);
		}
		setSteps(steps + 1);
	}

	function undo() {
		setOrder(null);
		const oldGraph = {...graph, mat: popUndo()};
		setGroup(nextGroup(oldGraph, STEPSIZE));
		setGraph(oldGraph);
		setSteps(steps - 1);
	}

	let final = null;
	if (order != null) {
		final = graph.vert.sort((a,b) => order[b] - order[a]);  // mutation whatever
	}

	return (
		<div id="sortProgress">
			{order != null
				? <ol>{final.map(id => <UmaTab key={'final-' + id} shortId={id} name={names[id]} />)}</ol>
				: <div id="sortlistWrapper">
					  <ul id="sortlistBg">{group.map(id => <li key={id} class="tabslot" />)}</ul>
					  <ul id="sortlist" ref={sortlist}>
						{group.map(id => <UmaTab key={id} shortId={id} name={names[id]} />)}
					  </ul>
				  </div>
			}
			<div>{steps} steps</div>
			<div id="buttonsRow">
				<button class="stdBtn btnType2" disabled={undoStack==null} onClick={undo}>Undo</button>
				{order == null && <button class="stdBtn btnType1" disabled={graph==null} onClick={step}>Next</button>}
			</div>
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
