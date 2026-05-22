import { h, Fragment, render } from 'preact';
import { useState, useMemo, useEffect, useRef } from 'preact/hooks';

import Sortable from '../vendor/sortable';

import { shuffle, makeGraph, updateEdges, close, nextGroup, maxPaths } from './sort';

import colors from './colors.json';

import '../UmaUI.css';
import './app.css';

const STEPSIZE = 3;

function UmaTab(props) {
	const id = props.shortId + 1000;
	return (
		<li class="umatab" data-id={props.shortId} style={`border-color:#${colors[id].ui_border_color}`}>
			<img src={`stand/chara_stand_${id}_${id*100+1}.png`} width="250" draggable={false} />
			<span>{props.name}</span>
		</li>
	);
}

function FinalUma(props) {
	const i = props.i;
	const id = props.shortId + 1000;
	return (
		<li class="umatab" data-id={props.shortId} style={`border-color:#${colors[id].ui_border_color}`}>
			<img src={`stand/chara_stand_${id}_${id*100+1}.png`} class="umaImg" loading="lazy" draggable={false} />
			<span>{props.name}</span>
		</li>
	);
}

function App(props) {
	const sortlist = useRef(null);
	useEffect(() => {
		if (sortlist.current == null) return;
		const d = Sortable.create(sortlist.current, {
			dataIdAttr: 'data-id',
			ghostClass: 'gu-transit',
			forceFallback: true,
			fallbackClass: 'gu-mirror'
		});
		return () => d.destroy();
	}, [sortlist.current]);

	const [final, setFinal] = useState(null);
	useEffect(() => {
		if (final != null) {
			window.location.hash = new Uint8Array(final).toBase64({alphabet: 'base64url'});
		} else if (graph != null) {  // don't run on initial page load before we've  had the chance to load state from URL below
			window.history.replaceState(null, '', ' ');  // window.lcation.hash = ''; keeps the # marker
		}
	}, [final]);

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
	useEffect(() => {
		fetch('../umas.json').then(resp => resp.json()).then(umas => {
			const ids = Object.keys(umas).filter(id => +id < 2000).map(id => +id - 1000);
			const names = [];
			ids.forEach(id => names[id] = umas[id+1000].name[1]);
			setNames(names);
			shuffle(ids);
			setGraph(makeGraph(ids));
			setGroup(ids.slice(0,STEPSIZE));

			if (window.location.hash) {
				try {
					const loaded = Array.from(Uint8Array.fromBase64(window.location.hash.slice(1), {alphabet: 'base64url'}));
					if (loaded.length > 0 && new Set(loaded).isSubsetOf(new Set(ids))) {
						setFinal(loaded);
					}
				} catch (_) { }
			}
		});
	}, []);

	const [steps, setSteps] = useState(1);
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
			setFinal(graph.vert.toSorted((a,b) => dist[b] - dist[a]));
		} else {
			setGroup(next);
		}
		setSteps(steps + 1);
	}

	function undo() {
		setFinal(null);
		const oldGraph = {...graph, mat: popUndo()};
		const c = graph.cols;
		// recover the user's chosen sorting order as the topological sort of the difference between the old and new graphs
		const changed = graph.mat.map((x,i) => x ^ oldGraph.mat[i]);
		const indeg = [];
		const qset = new Set();
		changed.forEach((x,i) => {
			while (x != 0) {
				const j = 31 - Math.clz32(x);
				const u = (i/c)|0;
				const v = (i%c << 5) + j;
				indeg[v] = (indeg[v] || 0) + 1;
				qset.add(u);
				x &= ~(1 << j);
			}
		});
		const queue = Array.from(qset).filter(v => !(v in indeg));
		const group = [];
		while (queue.length > 0) {
			const u = queue.pop();
			group.push(u);
			for (let i = u*c; i < (u+1)*c; ++i) {
				let x = changed[i];
				while (x != 0) {
					const j = 31 - Math.clz32(x);
					const v = (i%c << 5) + j;
					if ((indeg[v] -= 1) == 0) {
						queue.push(v);
					}
					x &= ~(1 << j);
				}
			}
		}
		setGraph(oldGraph);
		setGroup(group);
		setSteps(steps - 1);
	}

	function List(props) {
		const finallist = useRef(null);
		useEffect(() => {
			if (finallist.current == null) return;
			const d = Sortable.create(finallist.current, {
				dataIdAttr: 'data-id',
				ghostClass: 'gu-transit',
				forceFallback: true,
				fallbackClass: 'gu-mirror',
				onSort: function () {
					setFinal(d.toArray().map(id => +id));
				}
			});
			return () => d.destroy();
		}, [finallist.current]);

		return (
			<Fragment>
				<ol id="orderIcons">
					{final.map((_,i) =>
						<li key={i}>
							{i < 18 ? <img src={`order/utx_txt_order_${i.toString().padStart(2,'0')}.png`} width={i == 0 ? 150 : i < 3 ? 90 : i < 5 ? 80 : 70} /> : <span>#{i+1}</span>}
						</li>)}
				</ol>
				<ol id="results" ref={finallist}>
					{final.map((id,i) => <FinalUma key={id} i={i} shortId={id} name={names[id]} />)}
				</ol>
				{undoStack != null && /* hide if state loaded from URL */
					<button class="stdBtn btnType2" disabled={false} onClick={undo}>Undo</button>}
			</Fragment>
		);
	}

	function SortStep(props) {
		return (
			<Fragment>
				<h2 id="groupHead">Group #<span>{steps}</span></h2>
				<div id="sortlistWrapper">
					<ul id="sortlistIcons">
						{group.map((id,i) => <li key={id}><img src={`order/utx_txt_order_${i.toString().padStart(2,'0')}.png`} width="40" /></li>)}
					</ul>
					<ul id="sortlist" ref={sortlist}>
						{group.map(id => <UmaTab key={id} shortId={id} name={names[id]} />)}
					</ul>
				</div>
				<div id="buttonsRow">
					<button class="stdBtn btnType2" disabled={undoStack==null} onClick={undo}>Undo</button>
					<button class="stdBtn btnType1" disabled={graph==null} onClick={step}>Next</button>
				</div>
			</Fragment>
		);
	}

	return (
		<div id="sorter">
			{final != null ? <List /> : <SortStep />}
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
