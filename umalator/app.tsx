import { h, Fragment, render } from 'preact';
import { useState, useReducer, useMemo, useEffect, useRef, useId, useCallback } from 'preact/hooks';
import { Text, IntlProvider } from 'preact-i18n';
import { Record, Set as ImmSet } from 'immutable';
import * as d3 from 'd3';
import { computePosition, flip } from '@floating-ui/dom';

import { CourseHelpers } from '../uma-skill-tools/CourseData';
import { RaceParameters, Mood, GroundCondition, Weather, Season, Time, Grade } from '../uma-skill-tools/RaceParameters';
import type { GameHpPolicy } from '../uma-skill-tools/HpPolicy';

import { Language, LanguageSelect, useLanguageSelect } from '../components/Language';
import { ExpandedSkillDetails, STRINGS_en as SKILL_STRINGS_en } from '../components/SkillList';
import { RaceTrack, TrackSelect, RegionDisplayType } from '../components/RaceTrack';
import { HorseState, SkillSet } from '../components/HorseDefTypes';
import { HorseDef, horseDefTabs } from '../components/HorseDef';
import { TRACKNAMES_ja, TRACKNAMES_en } from '../strings/common';

import { getActivateableSkills, getNullRow, runBasinnChart, BasinnChart } from './BasinnChart';

import { initTelemetry, postEvent } from './telemetry';

import { IntroText } from './IntroText';

import skilldata from '../uma-skill-tools/data/skill_data.json';
import skillnames from '../uma-skill-tools/data/skillnames.json';
import skill_meta from '../skill_meta.json';

function skillmeta(id: string) {
	// handle the fake skills (e.g., variations of Sirius unique) inserted by make_skill_data with ids like 100701-1
	return skill_meta[id.split('-')[0]];
}

import './app.css';

const DEFAULT_SAMPLES = 500;
const DEFAULT_SEED = 2615953739;

class RaceParams extends Record({
	mood: 2 as Mood,
	ground: GroundCondition.Good,
	weather: Weather.Sunny,
	season: Season.Spring,
	time: Time.Midday,
	grade: Grade.G1
}) {}

const enum EventType { CM, LOH }

const presets = (CC_GLOBAL ? [
	{type: EventType.CM, name: 'Virgo Cup', date: '2025-11-20', courseId: 10903, season: Season.Autumn, ground: GroundCondition.Good, weather: Weather.Sunny, time: Time.Midday},
	{type: EventType.CM, name: 'Leo Cup', date: '2025-10-30', courseId: 10906, season: Season.Summer, ground: GroundCondition.Good, weather: Weather.Sunny, time: Time.Midday},
	{type: EventType.CM, name: 'Cancer Cup', date: '2025-10-07', courseId: 10602, season: Season.Summer, ground: GroundCondition.Yielding, weather: Weather.Sunny, time: Time.Midday},
	{type: EventType.CM, name: 'Gemini Cup', date: '2025-09', courseId: 10811, season: Season.Spring, ground: GroundCondition.Good, weather: Weather.Sunny, time: Time.Midday},
	{type: EventType.CM, name: 'Taurus Cup', date: '2025-08', courseId: 10606, season: Season.Spring, ground: GroundCondition.Good, weather: Weather.Sunny, time: Time.Midday}
] : [
	{type: EventType.LOH, date: '2025-11', courseId: 11502, season: Season.Autumn, time: Time.Midday},
	{type: EventType.CM, date: '2025-10', courseId: 10302, season: Season.Autumn, ground: GroundCondition.Good, weather: Weather.Cloudy, time: Time.Midday},
	{type: EventType.CM, date: '2025-09-22', courseId: 10807, season: Season.Autumn, ground: GroundCondition.Good, weather: Weather.Sunny, time: Time.Midday},
	{type: EventType.LOH, date: '2025-08', courseId: 10105, season: Season.Summer, Time: Time.Midday},
	{type: EventType.CM, date: '2025-07-25', courseId: 10906, ground: GroundCondition.Yielding, weather: Weather.Cloudy, season: Season.Summer, time: Time.Midday},
	{type: EventType.CM, date: '2025-06-21', courseId: 10606, ground: GroundCondition.Good, weather: Weather.Sunny, season: Season.Spring, time: Time.Midday}
])
	.map(def => ({
		type: def.type,
		name: def.name,
		date: new Date(def.date),
		courseId: def.courseId,
		racedef: new RaceParams({
			mood: 2 as Mood,
			ground: def.type == EventType.CM ? def.ground : GroundCondition.Good,
			weather: def.type == EventType.CM ? def.weather : Weather.Sunny,
			season: def.season,
			time: def.time,
			grade: Grade.G1
		})
	}))
	.sort((a,b) => +b.date - +a.date);

const DEFAULT_PRESET = presets[Math.max(presets.findIndex((now => p => new Date(p.date.getFullYear(), p.date.getUTCMonth() + 1, 0) < now)(new Date())) - 1, 0)];
const DEFAULT_COURSE_ID = DEFAULT_PRESET.courseId;

function id(x) { return x; }

function binSearch(a: number[], x: number) {
	let lo = 0, hi = a.length - 1;
	if (x < a[0]) return 0;
	if (x > a[hi]) return hi - 1;
	while (lo <= hi) {
		const mid = Math.floor((lo + hi) / 2);
		if (x < a[mid]) {
			hi = mid - 1;
		} else if (x > a[mid]) {
			lo = mid + 1;
		} else {
			return mid;
		}
	}
	return Math.abs(a[lo] - x) < Math.abs(a[hi] - x) ? lo : hi;
}

function TimeOfDaySelect(props) {
	function click(e) {
		e.stopPropagation();
		if (!('timeofday' in e.target.dataset)) return;
		props.set(+e.target.dataset.timeofday);
	}
	// + 2 because for some reason the icons are 00-02 (noon/evening/night) but the enum values are 1-4 (morning(?) noon evening night)
	return (
		<div class="timeofdaySelect" onClick={click}>
			{Array(3).fill(0).map((_,i) =>
				<img src={`/uma-tools/icons/utx_ico_timezone_0${i}.png`} title={SKILL_STRINGS_en.skilldetails.time[i+2]}
					class={i+2 == props.value ? 'selected' : ''} data-timeofday={i+2} />)}
		</div>
	);
}

function GroundSelect(props) {
	if (CC_GLOBAL) {
		return (
			<select class="groundSelect" value={props.value} onInput={(e) => props.set(+e.currentTarget.value)}>
				<option value="1">Firm</option>
				<option value="2">Good</option>
				<option value="3">Soft</option>
				<option value="4">Heavy</option>
			</select>
		);
	}
	return (
		<select class="groundSelect" value={props.value} onInput={(e) => props.set(+e.currentTarget.value)}>
			<option value="1">良</option>
			<option value="2">稍重</option>
			<option value="3">重</option>
			<option value="4">不良</option>
		</select>
	);
}

function WeatherSelect(props) {
	function click(e) {
		e.stopPropagation();
		if (!('weather' in e.target.dataset)) return;
		props.set(+e.target.dataset.weather);
	}
	return (
		<div class="weatherSelect" onClick={click}>
			{Array(4).fill(0).map((_,i) =>
				<img src={`/uma-tools/icons/utx_ico_weather_0${i}.png`} title={SKILL_STRINGS_en.skilldetails.weather[i+1]}
					class={i+1 == props.value ? 'selected' : ''} data-weather={i+1} />)}
		</div>
	);
}

function SeasonSelect(props) {
	function click(e) {
		e.stopPropagation();
		if (!('season' in e.target.dataset)) return;
		props.set(+e.target.dataset.season);
	}
	return (
		<div class="seasonSelect" onClick={click}>
			{Array(4 + +!CC_GLOBAL /* global doenst have late spring for some reason */).fill(0).map((_,i) =>
				<img src={`/uma-tools/icons${CC_GLOBAL?'/global':''}/utx_txt_season_0${i}.png`} title={SKILL_STRINGS_en.skilldetails.season[i+1]}
					class={i+1 == props.value ? 'selected' : ''} data-season={i+1} />)}
		</div>
	);
}

function Histogram(props) {
	const {data, width, height} = props;
	const axes = useRef(null);
	const xH = 20;
	const yW = 40;

	const x = d3.scaleLinear().domain(
		data[0] == 0 && data[data.length-1] == 0
			? [-1,1]
			: [Math.min(0,Math.floor(data[0])),Math.ceil(data[data.length-1])]
	).range([yW,width-yW]);
	const bucketize = d3.bin().value(id).domain(x.domain()).thresholds(x.ticks(30));
	const buckets = bucketize(data);
	const y = d3.scaleLinear().domain([0,d3.max(buckets, b => b.length)]).range([height-xH,xH]);

	useEffect(function () {
		const g = d3.select(axes.current);
		g.selectAll('*').remove();
		g.append('g').attr('transform', `translate(0,${height - xH})`).call(d3.axisBottom(x));
		g.append('g').attr('transform', `translate(${yW},0)`).call(d3.axisLeft(y));
	}, [data, width, height]);

	const rects = buckets.map((b,i) =>
		<rect key={i} fill="#2a77c5" stroke="black" x={x(b.x0)} y={y(b.length)} width={x(b.x1) - x(b.x0)} height={height - xH - y(b.length)} />
	);
	return (
		<svg id="histogram" width={width} height={height}>
			<g>{rects}</g>
			<g ref={axes}></g>
		</svg>
	);
}

function BasinnChartPopover(props) {
	const popover = useRef(null);
	useEffect(function () {
		if (popover.current == null) return;
		// bit nasty
		const anchor = document.querySelector(`.basinnChart tr[data-skillid="${props.skillid}"] img`);
		computePosition(anchor, popover.current, {
			placement: 'bottom-start',
			middleware: [flip()]
		}).then(({x,y}) => {
			popover.current.style.transform = `translate(${x}px,${y}px)`;
			popover.current.style.visibility = 'visible';
		});
		popover.current.focus();
	}, [popover.current, props.skillid]);
	return (
		<div class="basinnChartPopover" tabindex="1000" style="visibility:hidden" ref={popover}>
			<ExpandedSkillDetails id={props.skillid} distanceFactor={props.courseDistance} dismissable={false} />
			<Histogram width={500} height={333} data={props.results} />
		</div>
	);
}

function VelocityLines(props) {
	const axes = useRef(null);
	const data = props.data;
	const x = d3.scaleLinear().domain([0,props.courseDistance]).range([0,props.width]);
	const y = data && d3.scaleLinear().domain([0,d3.max(data.v, v => d3.max(v))]).range([props.height,0]);
	const hpY = data && d3.scaleLinear().domain([0,d3.max(data.hp, hp => d3.max(hp))]).range([props.height,0]);
	useEffect(function () {
		if (axes.current == null) return;
		const g = d3.select(axes.current);
		g.selectAll('*').remove();
		g.append('g').attr('transform', `translate(${props.xOffset},${props.height+5})`).call(d3.axisBottom(x));
		if (data) {
			g.append('g').attr('transform', `translate(${props.xOffset},4)`).call(d3.axisLeft(y));
		}
	}, [props.data, props.courseDistance, props.width, props.height]);
	const colors = ['#2a77c5', '#c52a2a'];
	const hpColors = ['#688aab', '#ab6868'];
	return (
		<Fragment>
			<g transform={`translate(${props.xOffset},5)`}>
				{data && data.v.map((v,i) =>
					<path fill="none" stroke={colors[i]} stroke-width="2.5" d={
						d3.line().x(j => x(data.p[i][j])).y(j => y(v[j]))(data.p[i].map((_,j) => j))
					} />
				).concat(props.showHp ? data.hp.map((hp,i) =>
					<path fill="none" stroke={hpColors[i]} stroke-width="2.5" d={
						d3.line().x(j => x(data.p[i][j])).y(j => hpY(hp[j]))(data.p[i].map((_,j) => j))
					} />
				) : [])}
			</g>
			<g ref={axes} />
		</Fragment>
	);
}

const NO_SHOW = Object.freeze([
	'10011', '10012', '10016', '10021', '10022', '10026', '10031', '10032', '10036',
	'10041', '10042', '10046', '10051', '10052', '10056', '10061', '10062', '10066',
	'40011',
	'20061', '20062', '20066'
]);

const ORDER_RANGE_FOR_STRATEGY = Object.freeze({
	'Nige': [1,1],
	'Senkou': [2,4],
	'Sasi': [5,9],
	'Oikomi': [5,9],
	'Oonige': [1,1]
});

function racedefToParams({mood, ground, weather, season, time, grade}: RaceParams, includeOrder?: string): RaceParameters {
	return {
		mood, groundCondition: ground, weather, season, time, grade,
		popularity: 1,
		skillId: '',
		orderRange: includeOrder != null ? ORDER_RANGE_FOR_STRATEGY[includeOrder] : null,
		numUmas: 9
	};
}

async function serialize(courseId: number, nsamples: number, seed: number, usePosKeep: boolean, racedef: RaceParams, uma1: HorseState, uma2: HorseState) {
	const json = JSON.stringify({
		courseId,
		nsamples,
		seed,
		usePosKeep,
		racedef: racedef.toJS(),
		uma1: uma1.toJS(),
		uma2: uma2.toJS()
	});
	const enc = new TextEncoder();
	const stringStream = new ReadableStream({
		start(controller) {
			controller.enqueue(enc.encode(json));
			controller.close();
		}
	});
	const zipped = stringStream.pipeThrough(new CompressionStream('gzip'));
	const reader = zipped.getReader();
	let buf = new Uint8Array();
	let result;
	while ((result = await reader.read())) {
		if (result.done) {
			return encodeURIComponent(btoa(String.fromCharCode(...buf)));
		} else {
			buf = new Uint8Array([...buf, ...result.value]);
		}
	}
}

async function deserialize(hash) {
	const zipped = atob(decodeURIComponent(hash));
	const buf = new Uint8Array(zipped.split('').map(c => c.charCodeAt(0)));
	const stringStream = new ReadableStream({
		start(controller) {
			controller.enqueue(buf);
			controller.close();
		}
	});
	const unzipped = stringStream.pipeThrough(new DecompressionStream('gzip'));
	const reader = unzipped.getReader();
	const decoder = new TextDecoder();
	let json = '';
	let result;
	while ((result = await reader.read())) {
		if (result.done) {
			try {
				const o = JSON.parse(json);
				return {
					courseId: o.courseId,
					nsamples: o.nsamples,
					seed: o.seed || DEFAULT_SEED,  // field added later, could be undefined when loading state from existing links
					usePosKeep: o.usePosKeep,
					racedef: new RaceParams(o.racedef),
					uma1: new HorseState(o.uma1).set('skills', SkillSet(o.uma1.skills)),
					uma2: new HorseState(o.uma2).set('skills', SkillSet(o.uma2.skills))
				};
			} catch (_) {
				return {
					courseId: DEFAULT_COURSE_ID,
					nsamples: DEFAULT_SAMPLES,
					seed: DEFAULT_SEED,
					usePosKeep: true,
					racedef: new RaceParams(),
					uma1: new HorseState(),
					uma2: new HorseState()
				};
			}
		} else {
			json += decoder.decode(result.value);
		}
	}
}

const EMPTY_RESULTS_STATE = {courseId: DEFAULT_COURSE_ID, results: [], runData: null, chartData: null, displaying: ''};
function updateResultsState(state: typeof EMPTY_RESULTS_STATE, o: number | string | {results: any, runData: any}) {
	if (typeof o == 'number') {
		return {
			courseId: o,
			results: [],
			runData: null,
			chartData: null,
			displaying: ''
		};
	} else if (typeof o == 'string') {
		postEvent('setChartData', {display: o});
		return {
			courseId: state.courseId,
			results: state.results,
			runData: state.runData,
			chartData: state.runData != null ? state.runData[o] : null,
			displaying: o
		};
	} else {
		return {
			courseId: state.courseId,
			results: o.results,
			runData: o.runData,
			chartData: o.runData[state.displaying || 'meanrun'],
			displaying: state.displaying || 'meanrun'
		};
	}
}

function RacePresets(props) {
	const id = useId();
	const selectedIdx = presets.findIndex(p => p.courseId == props.courseId && p.racedef.equals(props.racedef));
	return (
		<Fragment>
			<label for={id}>Preset:</label>
			<select id={id} onChange={e => { const i = +e.currentTarget.value; i > -1 && props.set(presets[i].courseId, presets[i].racedef); }}>
				<option value="-1"></option>
				{presets.map((p,i) => <option value={i} selected={i == selectedIdx}>{p.name || (p.date.getFullYear() + '-' + (100 + p.date.getUTCMonth() + 1).toString().slice(-2) + (p.type == EventType.CM ? ' CM' : ' LOH'))}</option>)}
			</select>
		</Fragment>
	);
}

const baseSkillsToTest = Object.keys(skilldata).filter(id => skilldata[id].rarity < 3);

const enum Mode { Compare, Chart }
const enum UiStateMsg { SetModeCompare, SetModeChart, SetCurrentIdx0, SetCurrentIdx1, ToggleExpand }

const DEFAULT_UI_STATE = {mode: Mode.Compare, currentIdx: 0, expanded: false};

function nextUiState(state: typeof DEFAULT_UI_STATE, msg: UiStateMsg) {
	switch (msg) {
		case UiStateMsg.SetModeCompare:
			return {...state, mode: Mode.Compare};
		case UiStateMsg.SetModeChart:
			return {...state, mode: Mode.Chart, currentIdx: 0, expanded: false};
		case UiStateMsg.SetCurrentIdx0:
			return {...state, currentIdx: 0};
		case UiStateMsg.SetCurrentIdx1:
			return {...state, currentIdx: 1};
		case UiStateMsg.ToggleExpand:
			return {...state, expanded: !state.expanded};
	}
}

function App(props) {
	//const [language, setLanguage] = useLanguageSelect();
	const [skillsOpen, setSkillsOpen] = useState(false);
	const [racedef, setRaceDef] = useState(() => DEFAULT_PRESET.racedef);
	const [nsamples, setSamples] = useState(DEFAULT_SAMPLES);
	const [seed, setSeed] = useState(DEFAULT_SEED);
	const [usePosKeep, togglePosKeep] = useReducer((b,_) => !b, true);
	const [showHp, toggleShowHp] = useReducer((b,_) => !b, false);
	const [{courseId, results, runData, chartData, displaying}, setSimState] = useReducer(updateResultsState, EMPTY_RESULTS_STATE);
	const setCourseId = setSimState;
	const setResults = setSimState;
	const setChartData = setSimState;

	const [tableData, updateTableData] = useReducer((data,newData) => {
		const merged = new Map();
		if (newData == 'reset') {
			return merged;
		}
		data.forEach((v,k) => merged.set(k,v));
		newData.forEach((v,k) => merged.set(k,v));
		return merged;
	}, new Map());

	const [popoverSkill, setPopoverSkill] = useState('');

	function racesetter(prop) {
		return (value) => setRaceDef(racedef.set(prop, value));
	}

	const course = useMemo(() => CourseHelpers.getCourse(courseId), [courseId]);

	const [uma1, setUma1] = useState(() => new HorseState());
	const [uma2, setUma2] = useState(() => new HorseState());

	const [{mode, currentIdx, expanded}, updateUiState] = useReducer(nextUiState, DEFAULT_UI_STATE);
	function toggleExpand(e: Event) {
		e.stopPropagation();
		postEvent('toggleExpand', {expand: !expanded});
		updateUiState(UiStateMsg.ToggleExpand);
	}

	const [worker1, worker2] = [1,2].map(_ => useMemo(() => {
		const w = new Worker('./simulator.worker.js');
		w.addEventListener('message', function (e) {
			const {type, results} = e.data;
			switch (type) {
				case 'compare':
					setResults(results);
					break;
				case 'chart':
					updateTableData(results);
					break;
			}
		});
		return w;
	}, []));

	function loadState() {
		if (window.location.hash) {
			deserialize(window.location.hash.slice(1)).then(o => {
				setCourseId(o.courseId);
				setSamples(o.nsamples);
				setSeed(o.seed);
				if (o.usePosKeep != usePosKeep) togglePosKeep(0);
				setRaceDef(o.racedef);
				setUma1(o.uma1);
				setUma2(o.uma2);
			});
		}
	}

	useEffect(function () {
		loadState();
		window.addEventListener('hashchange', loadState);
	}, []);

	function copyStateUrl(e) {
		e.preventDefault();
		serialize(courseId, nsamples, seed, usePosKeep, racedef, uma1, uma2).then(hash => {
			const url = window.location.protocol + '//' + window.location.host + window.location.pathname;
			window.navigator.clipboard.writeText(url + '#' + hash);
		});
	}

	function copyUmaToRight() {
		postEvent('copyUma', {direction: 'to-right'});
		setUma2(uma1);
	}

	function copyUmaToLeft() {
		postEvent('copyUma', {direction: 'to-left'});
		setUma1(uma2);
	}

	function swapUmas() {
		postEvent('copyUma', {direction: 'swap'});
		setUma1(uma2);
		setUma2(uma1);
	}

	const strings = {skillnames: {}, tracknames: TRACKNAMES_en};
	const langid = +(props.lang == 'en');
	Object.keys(skillnames).forEach(id => strings.skillnames[id] = skillnames[id][langid]);

	function doComparison() {
		postEvent('doComparison', {});
		worker1.postMessage({
			msg: 'compare',
			data: {
				nsamples,
				course,
				racedef: racedefToParams(racedef),
				uma1: uma1.toJS(),
				uma2: uma2.toJS(),
				options: {seed, usePosKeep}
			}
		});
	}

	function doBasinnChart() {
		postEvent('doBasinnChart', {});
		const params = racedefToParams(racedef, uma1.strategy);
		const skills = getActivateableSkills(baseSkillsToTest.filter(s => !uma1.skills.has(s) && (s[0] != '9' || !uma1.skills.has('1' + s.slice(1)))), uma1, course, params);
		const filler = new Map();
		skills.forEach(id => filler.set(id, getNullRow(id)));
		const uma = uma1.toJS();
		const skills1 = skills.slice(0,Math.floor(skills.length/2));
		const skills2 = skills.slice(Math.floor(skills.length/2));
		updateTableData('reset');
		updateTableData(filler);
		worker1.postMessage({msg: 'chart', data: {skills: skills1, course, racedef: params, uma, options: {seed, usePosKeep}}});
		worker2.postMessage({msg: 'chart', data: {skills: skills2, course, racedef: params, uma, options: {seed, usePosKeep}}});
	}

	function basinnChartSelection(skillId) {
		const r = tableData.get(skillId);
		if (r.runData != null) setResults(r);
	}

	function addSkillFromTable(skillId) {
		postEvent('addSkillFromTable', {skillId});
		setUma1(uma1.set('skills', uma1.skills.add(skillId)));
	}

	function showPopover(skillId) {
		postEvent('showPopover', {skillId});
		setPopoverSkill(skillId);
	}

	useEffect(function () {
		document.body.addEventListener('click', function () {
			setPopoverSkill('');
		});
	}, []);

	function rtMouseMove(pos) {
		if (chartData == null) return;
		document.getElementById('rtMouseOverBox').style.display = 'block';
		const x = pos * course.distance;
		const i0 = binSearch(chartData.p[0], x), i1 = binSearch(chartData.p[1], x);
		document.getElementById('rtV1').textContent = `${chartData.v[0][i0].toFixed(2)} m/s  t=${chartData.t[0][i0].toFixed(2)} s  (${chartData.hp[0][i0].toFixed(0)} hp remaining)`;
		document.getElementById('rtV2').textContent = `${chartData.v[1][i1].toFixed(2)} m/s  t=${chartData.t[1][i1].toFixed(2)} s  (${chartData.hp[1][i1].toFixed(0)} hp remaining)`;
	}

	function rtMouseLeave() {
		document.getElementById('rtMouseOverBox').style.display = 'none';
	}

	const mid = Math.floor(results.length / 2);
	const median = results.length % 2 == 0 ? (results[mid-1] + results[mid]) / 2 : results[mid];
	const mean = results.reduce((a,b) => a+b, 0) / results.length;

	const colors = [
		{stroke: 'rgb(42, 119, 197)', fill: 'rgba(42, 119, 197, 0.7)'},
		{stroke: 'rgb(197, 42, 42)', fill: 'rgba(197, 42, 42, 0.7)'}
	];
	const skillActivations = chartData == null ? [] : chartData.sk.flatMap((a,i) => {
		return Array.from(a.keys()).flatMap(id => {
			if (NO_SHOW.indexOf(skillmeta(id).iconId) > -1) return [];
			else return a.get(id).map(ar => ({
				type: RegionDisplayType.Textbox,
				color: colors[i],
				text: skillnames[id][0],
				regions: [{start: ar[0], end: ar[1]}]
			}));
		});
	});

	const umaTabs = (
		<Fragment>
			<div class={`umaTab ${currentIdx == 0 ? 'selected' : ''}`} onClick={() => updateUiState(UiStateMsg.SetCurrentIdx0)}>Umamusume 1</div>
			{mode == Mode.Compare && <div class={`umaTab ${currentIdx == 1 ? 'selected' : ''}`} onClick={() => updateUiState(UiStateMsg.SetCurrentIdx1)}>Umamusume 2<div id="expandBtn" title="Expand panel" onClick={toggleExpand} /></div>}
		</Fragment>
	);

	let resultsPane;
	if (mode == Mode.Compare && results.length > 0) {
		resultsPane = (
			<div id="resultsPaneWrapper">
				<div id="resultsPane" class="mode-compare">
					<table id="resultsSummary">
						<tfoot>
							<tr>
								{Object.entries({
									minrun: ['Minimum', 'Set chart display to the run with minimum bashin difference'],
									maxrun: ['Maximum', 'Set chart display to the run with maximum bashin difference'],
									meanrun: ['Mean', 'Set chart display to a run representative of the mean bashin difference'],
									medianrun: ['Median', 'Set chart display to a run representative of the median bashin difference']
								}).map(([k,label]) =>
									<th scope="col" class={displaying == k ? 'selected' : ''} title={label[1]} onClick={() => setChartData(k)}>{label[0]}</th>
								)}
							</tr>
						</tfoot>
						<tbody>
							<tr>
								<td onClick={() => setChartData('minrun')}>{results[0].toFixed(2)}<span class="unit-basinn">{CC_GLOBAL?'lengths':'バ身'}</span></td>
								<td onClick={() => setChartData('maxrun')}>{results[results.length-1].toFixed(2)}<span class="unit-basinn">{CC_GLOBAL?'lengths':'バ身'}</span></td>
								<td onClick={() => setChartData('meanrun')}>{mean.toFixed(2)}<span class="unit-basinn">{CC_GLOBAL?'lengths':'バ身'}</span></td>
								<td onClick={() => setChartData('medianrun')}>{median.toFixed(2)}<span class="unit-basinn">{CC_GLOBAL?'lengths':'バ身'}</span></td>
							</tr>
						</tbody>
					</table>
					<div id="resultsHelp">Negative numbers mean <strong style="color:#2a77c5">Umamusume 1</strong> is faster, positive numbers mean <strong style="color:#c52a2a">Umamusume 2</strong> is faster.</div>
					<Histogram width={500} height={333} data={results} />
				</div>
				<div id="infoTables">
					<table>
						<caption style="color:#2a77c5">Umamusume 1</caption>
						<tbody>
							<tr><th>Time to finish</th><td>{chartData.t[0][chartData.t[0].length-1].toFixed(4) + ' s'}</td></tr>
							<tr><th>Start delay</th><td>{chartData.sdly[0].toFixed(4) + ' s'}</td></tr>
							<tr><th>Top speed</th><td>{chartData.v[0].reduce((a,b) => Math.max(a,b), 0).toFixed(2) + ' m/s'}</td></tr>
						</tbody>
						{chartData.sk[0].size > 0 &&
							<tbody>
								{Array.from(chartData.sk[0].entries()).map(([id,ars]) => ars.flatMap(pos =>
									<tr>
										<th>{skillnames[id][0]}</th>
										<td>{`${pos[0].toFixed(2)} m – ${pos[1].toFixed(2)} m`}</td>
									</tr>))}
							</tbody>}
					</table>
					<table>
						<caption style="color:#c52a2a">Umamusume 2</caption>
						<tbody>
							<tr><th>Time to finish</th><td>{chartData.t[1][chartData.t[1].length-1].toFixed(4) + ' s'}</td></tr>
							<tr><th>Start delay</th><td>{chartData.sdly[1].toFixed(4) + ' s'}</td></tr>
							<tr><th>Top speed</th><td>{chartData.v[1].reduce((a,b) => Math.max(a,b), 0).toFixed(2) + ' m/s'}</td></tr>
						</tbody>
						{chartData.sk[1].size > 0 &&
							<tbody>
								{Array.from(chartData.sk[1].entries()).map(([id,ars]) => ars.flatMap(pos =>
									<tr>
										<th>{skillnames[id][0]}</th>
										<td>{`${pos[0].toFixed(2)} m – ${pos[1].toFixed(2)} m`}</td>
									</tr>))}
							</tbody>}
					</table>
				</div>
			</div>
		);
	} else if (mode == Mode.Chart && tableData.size > 0) {
		resultsPane = (
			<div id="resultsPaneWrapper">
				<div id="resultsPane" class="mode-chart">
					<BasinnChart data={tableData.values().toArray()} hidden={uma1.skills}
						onSelectionChange={basinnChartSelection}
						onRunTypeChange={setChartData}
						onDblClickRow={addSkillFromTable}
						onInfoClick={showPopover} />
				</div>
			</div>
		);
	} else if (CC_GLOBAL) {
		resultsPane = (
			<div id="resultsPaneWrapper">
				<div id="resultsPane">
					<IntroText />
				</div>
			</div>
		);
	} else {
		resultsPane = null;
	}

	return (
		<Language.Provider value={props.lang}>
			<IntlProvider definition={strings}>
				<div id="topPane" class={chartData ? 'hasResults' : ''}>
					<RaceTrack courseid={courseId} width={960} height={240} xOffset={20} yOffset={15} yExtra={20} mouseMove={rtMouseMove} mouseLeave={rtMouseLeave} regions={skillActivations}>
						<VelocityLines data={chartData} courseDistance={course.distance} width={960} height={250} xOffset={20} showHp={showHp} />
						<g id="rtMouseOverBox" style="display:none">
							<text id="rtV1" x="25" y="10" fill="#2a77c5" font-size="10px"></text>
							<text id="rtV2" x="25" y="20" fill="#c52a2a" font-size="10px"></text>
						</g>
					</RaceTrack>
					<div id="runPane">
						<fieldset>
							<legend>Mode:</legend>
							<div>
								<input type="radio" id="mode-compare" name="mode" value="compare" checked={mode == Mode.Compare} onClick={() => updateUiState(UiStateMsg.SetModeCompare)} />
								<label for="mode-compare">Compare</label>
							</div>
							<div>
								<input type="radio" id="mode-chart" name="mode" value="chart" checked={mode == Mode.Chart} onClick={() => updateUiState(UiStateMsg.SetModeChart)} />
								<label for="mode-chart">Skill chart</label>
							</div>
						</fieldset>
						<label for="nsamples">Samples:</label>
						<input type="number" id="nsamples" min="1" max="10000" value={nsamples} onInput={(e) => setSamples(+e.currentTarget.value)} />
						<label for="seed">Seed:</label>
						<div id="seedWrapper">
							<input type="number" id="seed" value={seed} onInput={(e) => setSeed(+e.currentTarget.value)} />
							<button title="Randomize seed" onClick={() => setSeed(Math.floor(Math.random() * (-1 >>> 0)) >>> 0)}>🎲</button>
						</div>
						<div>
							<label for="poskeep">Simulate pos keep</label>
							<input type="checkbox" id="poskeep" checked={usePosKeep} onClick={togglePosKeep} />
						</div>
						<div>
							<label for="showhp">Show HP consumption</label>
							<input type="checkbox" id="showhp" checked={showHp} onClick={toggleShowHp} />
						</div>
						{
							mode == Mode.Compare
							? <button id="run" onClick={doComparison} tabindex={1}>COMPARE</button>
							: <button id="run" onClick={doBasinnChart} tabindex={1}>RUN</button>
						}
						<a href="#" onClick={copyStateUrl}>Copy link</a>
						<RacePresets courseId={courseId} racedef={racedef} set={(courseId, racedef) => { setCourseId(courseId); setRaceDef(racedef); }} />
					</div>
					<div id="buttonsRow">
						<TrackSelect key={courseId} courseid={courseId} setCourseid={setCourseId} tabindex={2} />
						<div id="buttonsRowSpace" />
						<TimeOfDaySelect value={racedef.time} set={racesetter('time')} />
						<div>
							<GroundSelect value={racedef.ground} set={racesetter('ground')} />
							<WeatherSelect value={racedef.weather} set={racesetter('weather')} />
						</div>
						<SeasonSelect value={racedef.season} set={racesetter('season')} />
					</div>
				</div>
				{resultsPane}
				{expanded && <div id="umaPane" />}
				<div id={expanded ? 'umaOverlay' : 'umaPane'}>
					<div class={!expanded && currentIdx == 0 ? 'selected' : ''}>
						<HorseDef key={uma1.outfitId} state={uma1} setState={setUma1} courseDistance={course.distance} tabstart={() => 4}>
							{expanded ? 'Umamusume 1' : umaTabs}
						</HorseDef>
					</div>
					{expanded &&
						<div id="copyUmaButtons">
							<div id="copyUmaToRight" title="Copy uma 1 to uma 2" onClick={copyUmaToRight} />
							<div id="copyUmaToLeft" title="Copy uma 2 to uma 1" onClick={copyUmaToLeft} />
							<div id="swapUmas" title="Swap umas" onClick={swapUmas}>⮂</div>
						</div>}
					{mode == Mode.Compare && <div class={!expanded && currentIdx == 1 ? 'selected' : ''}>
						<HorseDef key={uma2.outfitId} state={uma2} setState={setUma2} courseDistance={course.distance} tabstart={() => 4 + horseDefTabs()}>
							{expanded ? 'Umamusume 2' : umaTabs}
						</HorseDef>
					</div>}
					{expanded && <div id="closeUmaOverlay" title="Close panel" onClick={toggleExpand}>✕</div>}
				</div>
				{popoverSkill && <BasinnChartPopover skillid={popoverSkill} results={tableData.get(popoverSkill).results} courseDistance={course.distance} />}
			</IntlProvider>
		</Language.Provider>
	);
}

initTelemetry();
render(<App lang="en-ja" />, document.getElementById('app'));
