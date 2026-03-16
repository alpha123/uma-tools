import { h, Fragment, render } from 'preact';
import { useState, useReducer, useMemo, useEffect, useRef, useId, useCallback } from 'preact/hooks';
import { memo } from 'preact/compat';
import { Text, MarkupText, Localizer, IntlProvider } from 'preact-i18n';
import * as d3 from 'd3';
import { computePosition, flip } from '@floating-ui/dom';

import { CourseHelpers } from '../uma-skill-tools/CourseData';
import { RaceParameters, Mood, GroundCondition, Weather, Season, Time, Grade } from '../uma-skill-tools/RaceParameters';
import type { GameHpPolicy } from '../uma-skill-tools/HpPolicy';

import { O, c, K, State, makeState, useLens, useGetter, useSetter } from '../optics';

import { Language, LanguageSelect, useLanguageSelect } from '../components/Language';
import { ExpandedSkillDetails } from '../components/SkillList';
import { RaceTrack, TrackSelect, RegionDisplayType } from '../components/RaceTrack';
import { HorseState, SkillSet, DEFAULT_HORSE_STATE } from '../components/HorseDefTypes';
import { HorseDef, horseDefTabs, isGeneralSkill } from '../components/HorseDef';
import { SkillList } from '../components/SkillList';
import { extendStrings, TRACKNAMES_ja, TRACKNAMES_en, COMMON_STRINGS } from '../strings/common';

import { getActivateableSkills, skillGroups, isPurpleSkill, getNullRow, BasinnChart } from './BasinnChart';
import { StaCalcResults } from './StaCalc';

import { initTelemetry, postEvent } from './telemetry';

import { IntroText } from './IntroText';

import skilldata from '../uma-skill-tools/data/skill_data.json';
import skillnames from '../uma-skill-tools/data/skillnames.json';
import skillmeta from '../skill_meta.json';

import './app.css';

const DEFAULT_SAMPLES = 500;
const DEFAULT_SEED = 2615953739;

const UI_ja = Object.freeze({
	'lengthsunit': 'バ身',
	'resultshelp': '負の数とは<strong class="uma1">第一ウマ娘</strong>の方が速い。正の数とは<strong class="uma2">第二ウマ娘</strong>の方が速い。',
	'uma': 'ウマ娘',
	'uma1': '第一ウマ娘',
	'uma2': '第二ウマ娘',
	'debuffer': 'デバフ',
	'mode': Object.freeze({
		'compare': '真っ向勝負',
		'chart': 'スキル効果値',
		'stacalc': 'Stamina calculator'
	}),
	'sidebar': Object.freeze({
		'samples': '標本数',
		'seed': '乱数シード',
		'poskeep': 'Simulate pos keep',
		'intchecks': 'Wisdom checks for skills',
		'showhp': 'Show HP consumption',
		'run': Object.freeze({
			'compare': '比べる',
			'chart': '実行する',
			'stacalc': 'Calculate'
		}),
		'copylink': 'リンクをコピー'
	}),
	'basinnchartselection': Object.freeze({
		'all': '全スキル',
		'inherit': '継承固有スキル',
		'selected': '選択したスキル',
		'addskill': '+ スキル追加'
	}),
	'kakari': '掛かり'
});
const UI_en = Object.freeze({
	'lengthsunit': 'bashin',
	'resultshelp': 'Negative numbers mean <strong class="uma1">Umamusume 1</strong> is faster, positive numbers mean <strong class="uma2">Umamusume 2</strong> is faster.',
	'uma': 'Umamusume',
	'uma1': 'Umamusume 1',
	'uma2': 'Umamusume 2',
	'debuffer': 'Debuffer',
	'mode': Object.freeze({
		'compare': 'Compare',
		'chart': 'Skill table',
		'stacalc': 'Stamina calculator'
	}),
	'sidebar': Object.freeze({
		'samples': 'Samples:',
		'seed': 'Seed:',
		'poskeep': 'Simulate pos keep',
		'intchecks': 'Wisdom checks for skills',
		'showhp': 'Show HP consumption',
		'run': Object.freeze({
			'compare': 'COMPARE',
			'chart': 'RUN',
			'stacalc': 'CALCULATE'
		}),
		'copylink': 'Copy link'
	}),
	'basinnchartselection': Object.freeze({
		'all': 'All skills',
		'inherit': 'Inherited uniques',
		'selected': 'Selected skills',
		'addskill': '+ Add Skill'
	}),
	'kakari': 'Kakari'
});
const UI_global = extendStrings(UI_en, {
	'lengthsunit': 'lengths',
	'sidebar': extendStrings(UI_en['sidebar'], {
		'intchecks': 'Wit checks for skills'
	}),
	'kakari': 'Rushed'
});

const UI_STRINGS = Object.freeze({
	'ja': UI_ja,
	'en': UI_en,
	'en-ja': UI_en,
	'en-global': UI_global
});

interface RaceParams {
	mood: Mood
	ground: GroundCondition
	weather: Weather
	season: Season
	time: Time
	grade: Grade
}

const DEFAULT_RACE_PARAMS = {
	mood: 2 as Mood,
	ground: GroundCondition.Good,
	weather: Weather.Sunny,
	season: Season.Spring,
	time: Time.Midday,
	grade: Grade.G1
};

function shallowEquals(o1, o2) {
	if (o1 == null || o2 == null) return o1 === o2;
	// assume o1 and o2 have the same shape
	return Object.keys(o1).reduce((b,k) => b && Object.is(o1[k], o2[k]), true);
}

function horseEquals(h1, h2) {
	return h1 == h2 || Object.keys(h1).reduce((b,k) => {
		if (!b) return false;
		if (k == 'skills') {
			const s1 = h1.skills, s2 = h2.skills;
			return s1.size == s2.size && Array.from(s1.keys()).reduce((b,k) => b && s1.get(k) == s2.get(k), true);
		} else if (k == 'samplePolicies') {
			return Array.from(h1.skills.values()).every(id => shallowEquals(h1.samplePolicies.get(id), h2.samplePolicies.get(id))) && Array.from(h2.skills.values()).every(id => shallowEquals(h1.samplePolicies.get(id), h2.samplePolicies.get(id)));
		} else {
			return Object.is(h1[k], h2[k]);
		}
	}, true);
}

const enum EventType { CM, LOH }

//  ja: 良   稍重     重   不良
//  en: good yielding soft heavy
// gbl: firm good     soft heavy
const presets = (CC_GLOBAL ? [
	{type: EventType.CM, name: 'Pisces Cup', date: '2026-03-30', courseId: 10914, season: Season.Spring, ground: GroundCondition.Heavy, weather: Weather.Rainy, time: Time.Midday},
	{type: EventType.CM, name: 'Aquarius Cup', date: '2026-03-06', courseId: 10611, season: Season.Winter, ground: GroundCondition.Good, weather: Weather.Sunny, time: Time.Midday},
	{type: EventType.CM, name: 'Capricorn Cup', date: '2026-02-13', courseId: 10701, season: Season.Winter, ground: GroundCondition.Soft, weather: Weather.Snowy, time: Time.Midday},
	{type: EventType.CM, name: 'Sagittarius Cup', date: '2026-01-23', courseId: 10506, season: Season.Winter, ground: GroundCondition.Good, weather: Weather.Sunny, time: Time.Midday},
	{type: EventType.CM, name: 'Scorpio Cup', date: '2026-01-01', courseId: 10604, season: Season.Autumn, ground: GroundCondition.Soft, weather: Weather.Rainy, time: Time.Midday},
	{type: EventType.CM, name: 'Libra Cup', date: '2025-12-12', courseId: 10810, season: Season.Autumn, ground: GroundCondition.Good, weather: Weather.Sunny, time: Time.Midday},
	{type: EventType.CM, name: 'Virgo Cup', date: '2025-11-20', courseId: 10903, season: Season.Autumn, ground: GroundCondition.Good, weather: Weather.Sunny, time: Time.Midday},
	{type: EventType.CM, name: 'Leo Cup', date: '2025-10-30', courseId: 10906, season: Season.Summer, ground: GroundCondition.Good, weather: Weather.Sunny, time: Time.Midday},
	{type: EventType.CM, name: 'Cancer Cup', date: '2025-10-07', courseId: 10602, season: Season.Summer, ground: GroundCondition.Yielding, weather: Weather.Sunny, time: Time.Midday},
	{type: EventType.CM, name: 'Gemini Cup', date: '2025-09-11', courseId: 10811, season: Season.Spring, ground: GroundCondition.Good, weather: Weather.Sunny, time: Time.Midday},
	{type: EventType.CM, name: 'Taurus Cup', date: '2025-08-21', courseId: 10606, season: Season.Spring, ground: GroundCondition.Good, weather: Weather.Sunny, time: Time.Midday}
] : [
	{type: EventType.LOH, date: '2026-05-31' /* TODO date */, courseId: 10801, season: Season.Spring, time: Time.Midday},
	{type: EventType.CM, date: '2026-04-30' /* TODO date */, courseId: 11709, season: Season.Spring, ground: GroundCondition.Good, weather: Weather.Sunny, time: Time.Midday},
	{type: EventType.CM, date: '2026-03-22', courseId: 11703, season: Season.Spring, ground: GroundCondition.Good, weather: Weather.Sunny, time: Time.Midday},
	{type: EventType.LOH, date: '2026-02-15', courseId: 10602, season: Season.Winter, time: Time.Midday},
	{type: EventType.CM, date: '2026-01-22', courseId: 10506, season: Season.Winter, ground: GroundCondition.Good, weather: Weather.Sunny, time: Time.Midday},
	{type: EventType.CM, date: '2025-12-21', courseId: 10903, season: Season.Winter, ground: GroundCondition.Good, weather: Weather.Sunny, time: Time.Midday},
	{type: EventType.LOH, date: '2025-11-21', courseId: 11502, season: Season.Autumn, time: Time.Midday},
	{type: EventType.CM, date: '2025-10-23', courseId: 10302, season: Season.Autumn, ground: GroundCondition.Good, weather: Weather.Cloudy, time: Time.Midday},
	{type: EventType.CM, date: '2025-09-22', courseId: 10807, season: Season.Autumn, ground: GroundCondition.Good, weather: Weather.Sunny, time: Time.Midday},
	{type: EventType.LOH, date: '2025-08-15', courseId: 10105, season: Season.Summer, Time: Time.Midday},
	{type: EventType.CM, date: '2025-07-25', courseId: 10906, ground: GroundCondition.Yielding, weather: Weather.Cloudy, season: Season.Summer, time: Time.Midday},
	{type: EventType.CM, date: '2025-06-21', courseId: 10606, ground: GroundCondition.Good, weather: Weather.Sunny, season: Season.Spring, time: Time.Midday}
])
	.map(def => ({
		type: def.type,
		name: def.name,
		date: new Date(def.date),
		courseId: def.courseId,
		racedef: {
			mood: 2 as Mood,
			ground: def.type == EventType.CM ? def.ground : GroundCondition.Good,
			weather: def.type == EventType.CM ? def.weather : Weather.Sunny,
			season: def.season,
			time: def.time,
			grade: Grade.G1
		}
	}))
	.sort((a,b) => +b.date - +a.date);

const DEFAULT_PRESET = presets[Math.max(presets.findIndex((now => p => p.date < now)(new Date())) - 1, 0)];
const DEFAULT_COURSE_ID = DEFAULT_PRESET.courseId;

function id(x) { return x; }

function toggle(b) { return !b; }

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
	const [t, setT] = useLens(props.t);
	function click(e) {
		e.stopPropagation();
		if (!('timeofday' in e.target.dataset)) return;
		setT(+e.target.dataset.timeofday);
	}
	// + 2 because for some reason the icons are 00-02 (noon/evening/night) but the enum values are 1-4 (morning(?) noon evening night)
	return (
		<div class="timeofdaySelect" onClick={click}>
			<Localizer>
				{Array(3).fill(0).map((_,i) =>
					<img src={`/uma-tools/icons/utx_ico_timezone_0${i}.png`} title={<Text id={`common.time.${i+2}`} />}
						class={i+2 == t ? 'selected' : ''} data-timeofday={i+2} />)}
			</Localizer>
		</div>
	);
}

function GroundSelect(props) {
	const [g, setG] = useLens(props.g);
	return (
		<select class="groundSelect" value={g} onInput={(e) => setG(+e.currentTarget.value)}>
			<option value="1"><Text id="common.ground.1" /></option>
			<option value="2"><Text id="common.ground.2" /></option>
			<option value="3"><Text id="common.ground.3" /></option>
			<option value="4"><Text id="common.ground.4" /></option>
		</select>
	);
}

function WeatherSelect(props) {
	const [w, setW] = useLens(props.w);
	function click(e) {
		e.stopPropagation();
		if (!('weather' in e.target.dataset)) return;
		setW(+e.target.dataset.weather);
	}
	return (
		<div class="weatherSelect" onClick={click}>
			<Localizer>
				{Array(4).fill(0).map((_,i) =>
					<img src={`/uma-tools/icons/utx_ico_weather_0${i}.png`} title={<Text id={`common.weather.${i+1}`} />}
						class={i+1 == w ? 'selected' : ''} data-weather={i+1} />)}
			</Localizer>
		</div>
	);
}

function SeasonSelect(props) {
	const [s, setS] = useLens(props.s);
	function click(e) {
		e.stopPropagation();
		if (!('season' in e.target.dataset)) return;
		setS(+e.target.dataset.season);
	}
	return (
		<div class="seasonSelect" onClick={click}>
			<Localizer>
				{Array(4 + +!CC_GLOBAL /* global doesnt have late spring for some reason */).fill(0).map((_,i) =>
					<img src={`/uma-tools/icons${CC_GLOBAL?'/global':''}/utx_txt_season_0${i}.png`} title={<Text id={`common.season.${i+1}`} />}
						class={i+1 == s ? 'selected' : ''} data-season={i+1} />)}
			</Localizer>
		</div>
	);
}

const [UMA1_COLOR, UMA2_COLOR] = (function (cs) {
	return [cs.getPropertyValue('--uma1-color'), cs.getPropertyValue('--uma2-color')];
})(window.getComputedStyle(document.documentElement));

const Histogram = memo(function Histogram(props) {
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
		<rect key={i} fill={b.x1 <= 0 || !props.splitColors ? UMA1_COLOR : UMA2_COLOR} stroke="black" x={x(b.x0)} y={y(b.length)} width={x(b.x1) - x(b.x0)} height={height - xH - y(b.length)} />
	);
	return (
		<svg id="histogram" width={width} height={height}>
			<g>{rects}</g>
			<g ref={axes}></g>
		</svg>
	);
});

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
			<Histogram width={500} height={333} data={props.results} splitColors={true} />
		</div>
	);
}

const VelocityLines = memo(function VelocityLines(props) {
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
	const colors = [UMA1_COLOR, UMA2_COLOR];
	return (
		<Fragment>
			<g transform={`translate(${props.xOffset},5)`}>
				{data && data.v.map((v,i) =>
					<path fill="none" stroke={colors[i]} stroke-width="2.5" d={
						d3.line().x(j => x(data.p[i][j])).y(j => y(v[j]))(data.p[i].map((_,j) => j))
					} />
				).concat(props.showHp ? data.hp.map((hp,i) =>
					<path fill="none" stroke={colors[i]} stroke-width="2.5" stroke-dasharray="5,2" d={
						d3.line().x(j => x(data.p[i][j])).y(j => hpY(hp[j]))(data.p[i].map((_,j) => j))
					} />
				) : [])}
			</g>
			<g ref={axes} />
		</Fragment>
	);
});

const ResultsTable = memo(function ResultsTable(props) {
	const {caption, class:cls, chartData, idx, spurtRate} = props;
	return (
		<table class={cls}>
			<caption><div>{caption}</div></caption>
			<tbody>
				<tr><th>Time to finish</th><td>{chartData.t[idx][chartData.t[idx].length-1].toFixed(4) + ' s'}</td></tr>
				<tr><th>Full spurt rate</th><td>{(spurtRate * 100).toFixed(2) + '%'}</td></tr>
				<tr><th>Start delay</th><td>{chartData.sdly[idx].toFixed(4) + ' s'}</td></tr>
				<tr><th>Top speed</th><td>{chartData.v[idx].reduce((a,b) => Math.max(a,b), 0).toFixed(2) + ' m/s'}</td></tr>
				<tr><th>Time in downhill speedup mode</th><td>{chartData.dh[idx].toFixed(2) + ' s'}</td></tr>
			</tbody>
			{chartData.sk[idx].size > 0 &&
				<tbody>
					{Array.from(chartData.sk[idx].entries()).flatMap(([id,ars]) => id == 'kakari' ? [] : ars.map(pos =>
						<tr>
							<th><img src={`/uma-tools/icons/skill/utx_ico_skill_${skillmeta[id].iconId}.png`} /><span>{skillnames[id][0]}</span></th>
							<td>{pos[1] == -1 ? `${pos[0].toFixed(2)} m` : `${pos[0].toFixed(2)} m – ${pos[1].toFixed(2)} m`}</td>
						</tr>))}
				</tbody>}
		</table>
	);
});

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

function serializeUma(uma) {
	return {...uma, skills: Array.from(uma.skills.values()), samplePolicies: Object.fromEntries(uma.samplePolicies)};
}

async function serialize(courseId: number, nsamples: number, seed: number, usePosKeep: boolean, useIntChecks: boolean, racedef: RaceParams, uma1: HorseState, uma2: HorseState, debufUma: HorseState, chartMode: string | null, chartSkills: string[] | null) {
	const o = {
		courseId,
		nsamples,
		seed,
		usePosKeep,
		useIntChecks,
		racedef,
		uma1: serializeUma(uma1),
		uma2: serializeUma(uma2),
	};
	if (chartMode != null) o.chartMode = chartMode;
	if (chartSkills != null) o.chartSkills = chartSkills;
	// not serializing this unless it has been modified means that when DEFAULT_HORSE_STATE changes (eg with stat cap updates)
	// we'll load a different uma, but given that presumably DEFAULT_HORSE_STATE will never include any debuffs that doens't
	// actually matter
	if (!horseEquals(debufUma, DEFAULT_HORSE_STATE)) {
		o.debufUma = serializeUma(debufUma);
	}
	const json = JSON.stringify(o);
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

const NEW_HORSE_FIELDS = Object.freeze({mood: 2 /* v5 */, popularity: 1 /* v5 */});

function deserializeUma(umaObj) {
	return Object.assign({}, NEW_HORSE_FIELDS, umaObj, {skills: SkillSet(umaObj.skills), samplePolicies: /* v6 */ new Map(Object.entries(umaObj.samplePolicies))});
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
					seed: o.seed || DEFAULT_SEED,  // field added later (v2), could be undefined when loading state from existing links
					usePosKeep: o.usePosKeep,
					useIntChecks: o.useIntChecks || false,  // v3
					racedef: o.racedef,
					uma1: deserializeUma(o.uma1),
					uma2: deserializeUma(o.uma2),
					debufUma: deserializeUma(o.debufUma || serializeUma(DEFAULT_HORSE_STATE)),  // v7
					// optional fields (only added when serialized from basinn chart screen)
					chartMode: o.chartMode || 'all',  // v6
					chartSkills: o.chartSkills || null  // v4
				};
			} catch (_) {
				return {
					courseId: DEFAULT_COURSE_ID,
					nsamples: DEFAULT_SAMPLES,
					seed: DEFAULT_SEED,
					usePosKeep: true,
					useIntChecks: false,
					racedef: DEFAULT_RACE_PARAMS,
					uma1: DEFAULT_HORSE_STATE,
					uma2: DEFAULT_HORSE_STATE,
					debufUma: DEFAULT_HORSE_STATE,
					chartMode: 'all',
					chartSkills: null
				};
			}
		} else {
			json += decoder.decode(result.value);
		}
	}
}

const RacePresets = memo(function RacePresets(props) {
	const [courseId, setCourseId] = useLens(props.courseId);
	const [racedef, setRacedef] = useLens(props.racedef);
	const selectedIdx = presets.findIndex(p => p.courseId == courseId && shallowEquals(p.racedef, racedef));
	function change(e) {
		const i = +e.currentTarget.value;
		if (i > -1) {
			setCourseId(presets[i].courseId);
			setRacedef(presets[i].racedef);
		}
	}
	return (
		<fieldset class="presetSelect">
			<legend>Preset</legend>
			<select onChange={change}>
				<option value="-1"></option>
				{presets.map((p,i) => <option value={i} selected={i == selectedIdx}>{p.name || (p.date.getUTCFullYear() + '-' + (100 + p.date.getUTCMonth() + 1).toString().slice(-2) + (p.type == EventType.CM ? ' CM' : ' LOH'))}</option>)}
			</select>
		</fieldset>
	);
}, K(true));

const allSkills = Object.keys(skilldata);
const baseSkillsToTest = allSkills.filter(id => isGeneralSkill(id) && !isPurpleSkill(id));

function getNullTableData(skills) {
	const filler = new Map();
	skills.forEach(id => filler.set(id, getNullRow(id)));
	return filler;
}

function pathValue(base, routeDesc, default_) {
	const k = Object.keys(routeDesc);
	const url = window.location.pathname.slice(base.length);
	const i = k.findIndex(path => url.indexOf(path) != -1);
	return i == -1 ? default_ : routeDesc[k[i]];
}

function useRoute<T>(base: string, getRouteDesc: () => Record<string,T>, default_: T, deps: any[]=[]): [T, (value: T) => void] {
	const routeDesc = useMemo(getRouteDesc, deps);
	const reverse = useMemo(() => {
		const reverse = new Map();
		Object.keys(routeDesc).forEach((path,value) => reverse.set(value, path));
		return reverse;
	}, [routeDesc]);
	const [lastNav, setLastNav] = useState(default_);
	const [current, setCurrent] = useState(() => pathValue(base, routeDesc, default_));
	useEffect(function () {
		function pageshow() {
			const v = pathValue(base, routeDesc, default_);
			setCurrent(v);
			setLastNav(v);
		}
		function popstate(e) {
			setCurrent(e.state != null ? e.state : lastNav);
		}
		window.addEventListener('pageshow', pageshow);
		window.addEventListener('popstate', popstate);
		return function () {
			window.removeEventListener('pageshow', pageshow);
			window.removeEventListener('popstate', popstate);
		};
	}, [routeDesc, lastNav]);
	const navigate = useCallback(function (value) {
		window.history.pushState(value, '', base + reverse.get(value) + window.location.hash);
		setCurrent(value);
	}, [routeDesc]);
	return [current, navigate];
}

const enum Mode { Compare, Chart, StaCalc }

const NULL_RESULTS = Object.freeze({results: [], runData: null});

function Umalator(props) {
	//const [language, setLanguage] = useLanguageSelect();
	const [racedef] = useLens(O.racedef);
	const [nsamples, setSamples] = useLens(O.nsamples);
	const [seed, setSeed] = useLens(O.seed);
	const [usePosKeep, setPosKeep] = useLens(O.usePosKeep); const togglePosKeep = () => setPosKeep(toggle);
	const [useIntChecks, setIntChecks] = useLens(O.useIntChecks); const toggleIntChecks = () => setIntChecks(toggle);
	const [showHp, setShowHp] = useLens(O.useShowHp); const toggleShowHp = () => setShowHp(toggle);
	const [courseId, setCourseId_] = useLens(O.courseId);
	const [displaying, setChartData] = useLens(O.displayedRun);
	const course = useMemo(() => CourseHelpers.getCourse(courseId), [courseId]);

	const [mode, setMode] = useRoute(CC_GLOBAL ? '/uma-tools/umalator-global' : '/uma-tools/umalator', () => ({
		'/compare': Mode.Compare,
		'/skills': Mode.Chart,
		'/stamina': Mode.StaCalc
	}), Mode.Compare);

	const [compareResults, setCompareResults] = useState(NULL_RESULTS);
	const [chartSelectionResults, setChartSelectionResults] = useState(NULL_RESULTS);
	const [stacalcResults, setStacalcResults] = useState(NULL_RESULTS);
	const {results, runData} = [compareResults, chartSelectionResults, stacalcResults][mode];
	const chartData = runData && runData[displaying];

	const [tableData, setTableData] = useLens(O.tableData);
	function updateTableData(newData) {
		setTableData(data => {
			const merged = new Map();
			data.forEach((v,k) => merged.set(k,v));
			newData.forEach((v,k) => merged.set(k,v));
			return merged;
		});
	}

	function setCourseId(cid) {
		setCourseId_(cid);
		setCompareResults(NULL_RESULTS);
		setChartSelectionResults(NULL_RESULTS);
		setStacalcResults(NULL_RESULTS);
	}

	const [uma1, setUma1] = useLens(O.uma1);
	const [uma2, setUma2] = useLens(O.uma2);
	const [debufUma, setDebufUma] = useLens(O.debufUma);

	const [currentIdx_, setCurrentIdx] = useState(0);
	const currentIdx = mode == Mode.Chart ? 0 : currentIdx_;
	const [expanded_, setExpanded] = useState(false);
	const expanded = mode != Mode.Chart && expanded_;
	function toggleExpand(e: Event) {
		e.stopPropagation();
		postEvent('toggleExpand', {expand: !expanded});
		setExpanded(!expanded_);
	}

	const [forceFullSpurt, toggleForceFullSpurt] = useReducer(b => !b, true);

	const loadedChartSkills = useGetter(O.chartSkills);
	const [chartSkills, setChartSkills] = useState(loadedChartSkills || []);
	const [chartMode, setChartMode] = useLens(O.chartMode);
	const chartSkillsMap = useMemo(() => {
		const m = new Map();
		chartSkills.forEach(id => m.set(id,id));
		return m;
	}, [chartSkills]);
	const [chartSkillPickerOpen, setChartSkillPickerOpen] = useState(false);
	const [popoverSkill, setPopoverSkill] = useState('');

	// update when state is loaded from url
	useEffect(() => {
		setTableData(getNullTableData(chartSkillsForMode(chartMode)));
	}, []);

	const [lastChartRun, setLastChartRun] = useState({
		uma: uma1,
		courseId,
		racedef,
		skills: [],
		fresh: true
	});

	function chartSkillsForMode(mode) {
		switch (mode) {
		case 'selected': return chartSkills;
		case 'inherit': return baseSkillsToTest.filter(id => id[0] == '9');
		default: return baseSkillsToTest;
		}
	}

	function switchChartMode(e) {
		const newMode = e.currentTarget.value;
		setChartMode(newMode);
		if (newMode != chartMode) {
			setTableData(getNullTableData(chartSkillsForMode(newMode)));
			setLastChartRun({...lastChartRun, skills: [], fresh: true});
		}
	}

	function setChartSkillsAndClose(skillMap) {
		const newSkills = Array.from(skillMap.values());
		setChartSkills(newSkills);
		const m = new Map(tableData);
		newSkills.forEach(id => {
			if (chartSkills.indexOf(id) == -1) m.set(id, getNullRow(id));
		});
		setTableData(m);
		setChartSkillPickerOpen(false);
	}

	function removeChartSkill(id) {
		setChartSkills(chartSkills.filter(x => x != id));
		const m = new Map(tableData);
		m.delete(id);
		setTableData(m);
		// because we delete from tableData we should update the last run info to reflect that we no longer have the
		// data for that skill
		setLastChartRun({...lastChartRun, skills: lastChartRun.skills.filter(x => x != id)});
	}

	const workers = [1,2,3,4].map(_ => useMemo(() => {
		const w = new Worker('./simulator.worker.js');
		w.addEventListener('message', function (e) {
			const {type, results} = e.data;
			switch (type) {
				case 'compare':
					setCompareResults(results);
					break;
				case 'hpcalc':
					setStacalcResults(results);
					break;
				case 'chart':
					updateTableData(results);
					break;
			}
		});
		return w;
	}, []));

	const copyLinkLink = useRef(null);

	function doSerialize() {
		return serialize(courseId, nsamples, seed, usePosKeep, useIntChecks, racedef, uma1, uma2, debufUma,
			mode == Mode.Chart ? chartMode : null, mode == Mode.Chart && chartMode == 'selected' ? chartSkills : null
		);
	}

	function copyStateUrl(e) {
		e.preventDefault();
		doSerialize().then(hash => {
			const url = window.location.protocol + '//' + window.location.host + window.location.pathname;
			window.navigator.clipboard.writeText(url + '#' + hash);
		});
	}

	function updateCopyLinkHref(e) {
		// don't preventDefault() because we do want the context menu to show, we just want the element's href
		// to be updated so that the browser's ‘Copy Link’ functionality works as expected
		doSerialize().then(hash => {
			if (copyLinkLink.current != null) {
				copyLinkLink.current.href = '#' + hash;
			}
		});
	}

	const leftUma = uma1, rightUma = mode == Mode.StaCalc ? debufUma : uma2;
	const setLeftUma = setUma1, setRightUma = mode == Mode.StaCalc ? setDebufUma : setUma2;
	function copyUmaToRight() {
		postEvent('copyUma', {direction: 'to-right'});
		setRightUma(leftUma);
	}

	function copyUmaToLeft() {
		postEvent('copyUma', {direction: 'to-left'});
		setLeftUma(rightUma);
	}

	function swapUmas() {
		postEvent('copyUma', {direction: 'swap'});
		setLeftUma(rightUma);
		setRightUma(leftUma);
	}

	const strings = {skillnames: {}, tracknames: TRACKNAMES_en, common: COMMON_STRINGS[props.lang], ui: UI_STRINGS[props.lang]};
	const langid = CC_GLOBAL ? 0 : +(props.lang == 'en');
	Object.keys(skillnames).forEach(id => strings.skillnames[id] = skillnames[id][langid]);

	function doComparison() {
		postEvent('doComparison', {});
		workers[0].postMessage({
			msg: 'compare',
			data: {
				nsamples,
				course,
				racedef: racedefToParams(racedef),
				uma1: uma1,
				uma2: uma2,
				options: {seed, usePosKeep, useIntChecks}
			}
		});
	}

	function doStaCalc() {
		postEvent('doStaCalc', {});
		workers[0].postMessage({
			msg: 'hpcalc',
			data: {
				nsamples,
				course,
				racedef: racedefToParams(racedef),
				uma: uma1,
				debufUma,
				options: {seed, usePosKeep, useIntChecks, forceFullSpurt}
			}
		});
	}

	function runBasinnChart(uma, params, skills) {
		const filler = getNullTableData(skills);
		setTableData(filler);
		const nPerWorker = Math.ceil(skills.length/workers.length);
		workers.reduce((skills, w) => {
			w.postMessage({msg: 'chart', data: {skills: skills.slice(0, nPerWorker), course, racedef: params, uma, options: {seed, usePosKeep, useIntChecks: false}}});
			return skills.slice(nPerWorker);
		}, skills);
	}

	function doBasinnChart() {
		postEvent('doBasinnChart', {});
		const params = racedefToParams(racedef, uma1.strategy);
		const skills = chartMode != 'all' ? chartSkillsForMode(chartMode) : getActivateableSkills(baseSkillsToTest.filter(id => {
			const existing = uma1.skills.get(skillmeta[id].groupId);
			const group = skillGroups.get(skillmeta[id].groupId);
			const skillSet = Array.from(uma1.skills.values());
			return !(
				existing == id || group.indexOf(id) < group.indexOf(existing)
				|| id[0] == '9' && skillSet.includes('1' + id.slice(1))  // reject inherited uniques if we already have the regular version
				|| id[0] == '9' && id.length > 6 && skillSet.includes(id.slice(2))  // evolved inherited uniques
			);
		}), uma1, course, params);
		setLastChartRun({uma: uma1, courseId, racedef, skills, fresh: false});
		runBasinnChart(uma1, params, skills);
	}

	function basinnChartSelection(skillId) {
		const r = tableData.get(skillId);
		if (r.runData != null) setChartSelectionResults(r);
	}

	function addSkillFromTable(skillId) {
		postEvent('addSkillFromTable', {skillId});
		setUma1(new (O.skills.get(skillmeta[skillId].groupId))(skillId));
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
		const x = pos * course.distance;
		const i0 = binSearch(chartData.p[0], x);
		document.getElementById('rtV1').textContent = `${chartData.v[0][i0].toFixed(2)} m/s  t=${chartData.t[0][i0].toFixed(2)} s  (${chartData.hp[0][i0].toFixed(0)} hp remaining)`;
		if (chartData.t.length > 1) {
			const i1 = binSearch(chartData.p[1], x);
			document.getElementById('rtV2').textContent = `${chartData.v[1][i1].toFixed(2)} m/s  t=${chartData.t[1][i1].toFixed(2)} s  (${chartData.hp[1][i1].toFixed(0)} hp remaining)`;
		}
	}

	function rtMouseEnter() {
		if (chartData != null) {
			document.getElementById('rtV1').style.display = 'block';
			if (chartData.t.length > 1) document.getElementById('rtV2').style.display = 'block';
		}
	}

	function rtMouseLeave() {
		document.getElementById('rtV1').style.display = 'none';
		document.getElementById('rtV2').style.display = 'none';
	}

	const colors = [
		{stroke: UMA1_COLOR, fill: UMA1_COLOR.replace(/rgb\((.+?)\)/, "rgba($1, 0.7)")},
		{stroke: UMA2_COLOR, fill: UMA2_COLOR.replace(/rgb\((.+?)\)/, "rgba($1, 0.7)")}
	];
	const skillActivations = chartData == null ? [] : chartData.sk.flatMap((a,i) => {
		return Array.from(a.keys()).flatMap(id => {
			if (id != 'kakari' && NO_SHOW.indexOf(skillmeta[id].iconId) > -1) return [];
			else return a.get(id).map(ar => ({
				type: RegionDisplayType.Textbox,
				color: colors[i],
				text: id == 'kakari' ? UI_STRINGS[props.lang]['kakari'] : skillnames[id][0],
				regions: [{start: ar[0], end: ar[1] == -1 ? ar[0] + course.distance * 0.078 /* somewhat arbitrary */ : ar[1]}]
			}));
		});
	});

	const umaTabs = useMemo(() => (
		<Fragment>
			<div class={`umaTab ${currentIdx == 0 ? 'selected' : ''}`} onClick={() => setCurrentIdx(0)}><Text id={mode == Mode.Compare ? "ui.uma1" : "ui.uma"} /></div>
			{mode != Mode.Chart && <div class={`umaTab ${currentIdx == 1 ? 'selected' : ''}`} onClick={() => setCurrentIdx(1)}><Text id={mode == Mode.Compare ? "ui.uma2" : "ui.debuffer"} /><div id="expandBtn" title="Expand panel" onClick={toggleExpand} /></div>}
		</Fragment>
	), [currentIdx, mode]);

	let resultsPane;
	if (mode == Mode.Compare && results.length > 0) {
		const mid = Math.floor(results.length / 2);
		const median = results.length % 2 == 0 ? (results[mid-1] + results[mid]) / 2 : results[mid];
		const mean = results.reduce((a,b) => a+b, 0) / results.length;
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
								<td onClick={() => setChartData('minrun')}>{results[0].toFixed(2)}<span class="unit-basinn"><Text id="ui.lengthsunit" /></span></td>
								<td onClick={() => setChartData('maxrun')}>{results[results.length-1].toFixed(2)}<span class="unit-basinn"><Text id="ui.lengthsunit" /></span></td>
								<td onClick={() => setChartData('meanrun')}>{mean.toFixed(2)}<span class="unit-basinn"><Text id="ui.lengthsunit" /></span></td>
								<td onClick={() => setChartData('medianrun')}>{median.toFixed(2)}<span class="unit-basinn"><Text id="ui.lengthsunit" /></span></td>
							</tr>
						</tbody>
					</table>
					<div id="resultsHelp"><MarkupText id="ui.resultshelp" /></div>
					<Histogram width={500} height={333} data={results} splitColors={true} />
				</div>
				<div id="infoTables">
					<Localizer>
						<ResultsTable caption={<Text id="ui.uma1" />} class="uma1" chartData={chartData} idx={0} spurtRate={runData.nspurt[0] / results.length} />
						<ResultsTable caption={<Text id="ui.uma2" />} class="uma2" chartData={chartData} idx={1} spurtRate={runData.nspurt[1] / results.length} />
					</Localizer>
				</div>
			</div>
		);
	} else if (mode == Mode.StaCalc && results.remainingHp != null) {
		resultsPane = (
			<div id="resultsPaneWrapper">
				<div id="resultsPane" class="mode-stacalc">
					<StaCalcResults course={course} uma={uma1} results={results} nspurt={runData.nspurt} displayedRun={O.displayedRun} Histogram={Histogram} />
				</div>
			</div>
		);
	} else if (mode == Mode.Chart) {
		const dirty = !horseEquals(uma1, lastChartRun.uma) || courseId != lastChartRun.courseId || !shallowEquals(racedef, lastChartRun.racedef) || (chartMode == 'selected' ? chartSkills.some(id => lastChartRun.skills.indexOf(id) == -1) : lastChartRun.fresh);
		resultsPane = (
			<div id="resultsPaneWrapper">
				<div id="resultsPane" class="mode-chart">
					<div id="basinnChartWrapperWrapper">
						<BasinnChart data={Array.from(tableData.values())} hasSkills={lastChartRun.uma.skills}
							dirty={dirty}
							hintLevels={O.hintLevels}
							displayedRun={O.displayedRun}
							dismissable={chartMode == 'selected'}
							onSelectionChange={basinnChartSelection}
							onDblClickRow={addSkillFromTable}
							onInfoClick={showPopover}
							onSkillDismiss={removeChartSkill} />
						<button id="basinnChartRefresh" class={dirty ? '' : 'hidden'} onClick={doBasinnChart}>⟲</button>
					</div>
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
				{expanded && <div id="umaPane" />}
				<div id={expanded ? 'umaOverlay' : 'umaPane'}>
					<div class={!expanded && currentIdx == 0 ? 'selected' : ''}>
						<HorseDef key={uma1.outfitId} state={O.uma1} courseDistance={course.distance} tabstart={() => 4}>
							{expanded ? <Text id={mode == Mode.Compare ? "ui.uma1" : "ui.uma"} /> : umaTabs}
						</HorseDef>
					</div>
					{expanded &&
						<div id="copyUmaButtons">
							<div id="copyUmaToRight" title="Copy uma 1 to uma 2" onClick={copyUmaToRight} />
							<div id="copyUmaToLeft" title="Copy uma 2 to uma 1" onClick={copyUmaToLeft} />
							<div id="swapUmas" title="Swap umas" onClick={swapUmas}>⮂</div>
						</div>}
					{mode != Mode.Chart && <div class={!expanded && currentIdx == 1 ? 'selected' : ''}>
						{mode == Mode.StaCalc
							? <HorseDef key={'d'+debufUma.outfitId} state={O.debufUma} courseDistance={course.distance} tabstart={() => 4 + horseDefTabs()}>
								{expanded ? <Text id="ui.debuffer" /> : umaTabs}
							</HorseDef>
							: <HorseDef key={uma2.outfitId} state={O.uma2} courseDistance={course.distance} tabstart={() => 4 + horseDefTabs()}>
								{expanded ? <Text id="ui.uma2" /> : umaTabs}
							</HorseDef>
						}
					</div>}
					{expanded && <div id="closeUmaOverlay" title="Close panel" onClick={toggleExpand}>✕</div>}
				</div>
				<div id="nonUmaPanes">
					<div id="midPane" class={chartData ? 'hasResults' : ''}>
						<RaceTrack courseid={courseId} width={960} height={240} xOffset={20} yOffset={15} yExtra={20} mouseMove={rtMouseMove} mouseEnter={rtMouseEnter} mouseLeave={rtMouseLeave} regions={skillActivations}>
							<VelocityLines data={chartData} courseDistance={course.distance} width={960} height={250} xOffset={20} showHp={showHp} />
							<g id="rtMouseOverBox">
								<text id="rtV1" x="25" y="10" fill="#2a77c5" font-size="10px" style="display:none"></text>
								<text id="rtV2" x="25" y="20" fill="#c52a2a" font-size="10px" style="display:none"></text>
							</g>
						</RaceTrack>
						<div id="buttonsRow">
							<TrackSelect key={courseId} courseid={courseId} setCourseid={setCourseId} tabindex={2} />
							<RacePresets courseId={O.courseId} racedef={O.racedef} />
							<div id="buttonsRowSpace" />
							<TimeOfDaySelect t={O.racedef.time} />
							<div>
								<GroundSelect g={O.racedef.ground} />
								<WeatherSelect w={O.racedef.weather} />
							</div>
							<SeasonSelect s={O.racedef.season} />
						</div>
						<div id="modeBar">
							<button class={`modeBtn${mode == Mode.Compare ? ' modeBtnActive' : ''}`} onClick={() => setMode(Mode.Compare)}><Text id="ui.mode.compare" /></button>
							<button class={`modeBtn${mode == Mode.Chart ? ' modeBtnActive' : ''}`} onClick={() => setMode(Mode.Chart)}><Text id="ui.mode.chart" /></button>
							<button class={`modeBtn${mode == Mode.StaCalc ? ' modeBtnActive' : ''}`} onClick={() => setMode(Mode.StaCalc)}><Text id="ui.mode.stacalc" /></button>
						</div>
						{resultsPane}
					</div>
					<div id="sidebar">
						<label for="nsamples"><Text id="ui.sidebar.samples" /></label>
						<input type="number" id="nsamples" min="1" max="10000" value={nsamples} onInput={(e) => setSamples(+e.currentTarget.value)} />
						<label for="seed"><Text id="ui.sidebar.seed" /></label>
						<div id="seedWrapper">
							<input type="number" id="seed" value={seed} onInput={(e) => setSeed(+e.currentTarget.value)} />
							<button title="Randomize seed" onClick={() => setSeed(Math.floor(Math.random() * (-1 >>> 0)) >>> 0)}>🎲</button>
						</div>
						<div>
							<label for="poskeep"><Text id="ui.sidebar.poskeep" /></label>
							<input type="checkbox" id="poskeep" checked={usePosKeep} onClick={togglePosKeep} />
						</div>
						<div>
							<label for="intchecks"><Text id="ui.sidebar.intchecks" /></label>
							<input type="checkbox" id="intchecks" checked={useIntChecks} onClick={toggleIntChecks} />
						</div>
						<div>
							<label for="showhp"><Text id="ui.sidebar.showhp" /></label>
							<input type="checkbox" id="showhp" checked={showHp} onClick={toggleShowHp} />
						</div>
						{
							[
								<button id="run" onClick={doComparison} tabindex={1}><Text id="ui.sidebar.run.compare" /></button>,
								<button id="run" onClick={doBasinnChart} tabindex={1}><Text id="ui.sidebar.run.chart" /></button>,
								<button id="run" onClick={doStaCalc} tabindex={1}><Text id="ui.sidebar.run.stacalc" /></button>,
							][mode]
						}
						<a ref={copyLinkLink} href="#" onClick={copyStateUrl} onContextMenu={updateCopyLinkHref}><Text id="ui.sidebar.copylink" /></a>
						{
							mode == Mode.Chart &&
								<div id="extendedOptionsRow">
									<fieldset id="basinnChartSelect">
										<div>
											<input type="radio" id="basinnChartSelectAll" name="basinnChartSelection" value="all" checked={chartMode == 'all'} onClick={switchChartMode} />
											<label for="basinnChartSelectAll"><Text id="ui.basinnchartselection.all" /></label>
										</div>
										<div>
											<input type="radio" id="basinnChartSelectInherit" name="basinnChartSelection" value="inherit" checked={chartMode == 'inherit'} onClick={switchChartMode} />
											<label for="basinnChartSelectInherit"><Text id="ui.basinnchartselection.inherit" /></label>
										</div>
										<div>
											<input type="radio" id="basinnChartSelectSelected" name="basinnChartSelection" value="selected" checked={chartMode == 'selected'} onClick={switchChartMode} />
											<label for="basinnChartSelectSelected"><Text id="ui.basinnchartselection.selected" /></label>
										</div>
									</fieldset>
									<button id="basinnChartAddSkill" style={chartMode == 'selected' ? '' : 'visibility:hidden'} onClick={setChartSkillPickerOpen.bind(null, true)}><Text id="ui.basinnchartselection.addskill" /></button>
									<div class={`horseSkillPickerOverlay ${chartSkillPickerOpen ? "open" : ""}`} onClick={setChartSkillPickerOpen.bind(null, false)} />
									<div class={`horseSkillPickerWrapper ${chartSkillPickerOpen ? "open" : ""}`}>
										<SkillList ids={allSkills} selectionMode="single" selected={chartSkillsMap} setSelected={setChartSkillsAndClose} isOpen={chartSkillPickerOpen} />
									</div>
								</div>
						}
						{
							mode == Mode.StaCalc &&
								<div id="extendedOptionsRow">
									<div>
										<label for="stacalcForceMaxSpurt">Force full spurt</label>
										<input type="checkbox" id="stacalcForceMaxSpurt" checked={forceFullSpurt} onClick={toggleForceFullSpurt} />
									</div>
								</div>
						}
					</div>
				</div>
				{popoverSkill && <BasinnChartPopover skillid={popoverSkill} results={tableData.get(popoverSkill).results} courseDistance={course.distance} />}
			</IntlProvider>
		</Language.Provider>
	);
}

function App(props) {
	const state = makeState(() => ({
		racedef: DEFAULT_PRESET.racedef,
		nsamples: DEFAULT_SAMPLES,
		seed: DEFAULT_SEED,
		usePosKeep: true,
		useIntChecks: false,
		showHp: false,
		uma1: DEFAULT_HORSE_STATE,
		uma2: DEFAULT_HORSE_STATE,
		debufUma: DEFAULT_HORSE_STATE,
		courseId: DEFAULT_COURSE_ID,
		displayedRun: 'meanrun',
		tableData: getNullTableData(baseSkillsToTest),
		hintLevels: new Map(allSkills.map(id => [id,0])),
		chartMode: 'all',
		chartSkills: null
	}));

	// key shenanigans to force unmount/remount when loading state from URL so that sub-components can have their own
	// derived state based on the initial state we load
	const [key, setKey] = useState(false);
	function loadState() {
		if (window.location.hash) {
			deserialize(window.location.hash.slice(1)).then(o => {
				state.setState(Object.assign({}, state.ref.current.state, o));
				setKey(!key);
			});
		}
	}

	useEffect(function () {
		loadState();
		window.addEventListener('hashchange', loadState);
	}, []);

	return (
		<State.Provider value={state}>
			<Umalator key={key} lang={props.lang} />
		</State.Provider>
	);
}

initTelemetry();

// there's an annoying site that embeds the umalator surrounded by a bunch of ads
try {
	// try to detect if we're in a cross-domain iframe by deliberately triggering a CORS violation (we can't inspect any
	// properties of the parent page directly, but we can exploit that to determine if we're being embedded)
	window.parent && window.parent.location.hostname;
	render(<App lang={CC_GLOBAL?"en-global":"en-ja"} />, document.getElementById('app'));
} catch (e) {
	if (e instanceof DOMException) {
		document.getElementById('app').innerHTML = '<p style="font-size:22px"><span style="border:3px solid orange;border-radius:3em;color:orange;display:inline-block;font-weight:bold;height:1.8em;line-height:1.8em;text-align:center;width:1.8em">!</span> You are probably on some kind of scummy ad-infested rehosting site. The official URL for the Umalator is <a href="https://alpha123.github.io/uma-tools/umalator-global/" target="_blank">https://alpha123.github.io/uma-tools/umalator-global/</a>.</p>'
	} else {
		throw e;
	}
}
