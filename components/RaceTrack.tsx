import { h, Fragment } from 'preact';
import { useState, useContext, useMemo, useCallback } from 'preact/hooks';
import { IntlProvider, Text, useText } from 'preact-i18n';

import { CourseData, CourseHelpers, Surface, Orientation } from '../uma-skill-tools/CourseData';
import { Region, RegionList } from '../uma-skill-tools/Region';

import { useLanguage } from './Language';
import { TRACKNAMES_ja, TRACKNAMES_en } from '../strings/common';

import courses from '../uma-skill-tools/data/course_data.json';
import tracknames from '../uma-skill-tools/data/tracknames.json';

import './RaceTrack.css';

export const enum RegionDisplayType { Immediate, Regions, Textbox };

const STRINGS_ja = Object.freeze({
	'racetrack': Object.freeze({
		'thresholds': '補正ステータス：',
		'none': '​',
		'inner': ' （内）',
		'outer': ' （外）',
		'outin': ' （外→内）',
		'orientation': Object.freeze(['', '右', '左', '', '直']),
		'turf': '芝',
		'dirt': 'ダート',
		'straight': '直線',
		'corner': 'コーナー{{n}}',
		'uphill': '上り坂',
		'downhill': '下り坂',
		'phase0': '序盤',
		'phase1': '中盤',
		'phase2': '終盤',
		'phase3': 'ラストスパート',
		'short': Object.freeze({
			'straight': '直',
			'corner': 'コ{{n}}',
			'uphill': '上',
			'downhill': '下'
		})
	}),
	'tracknames': TRACKNAMES_ja,
	'coursedesc': '{{surface}}{{distance}}m{{inout}}'
});

const STRINGS_en = Object.freeze({
	'racetrack': Object.freeze({
		'thresholds': 'Stat thresholds: ',
		'none': '​',
		'inner': ' (inner)',
		'outer': ' (outer)',
		'outin': ' (outer→inner)',
		'orientation': Object.freeze(['', '(clockwise)', '(counterclockwise)', '', '(straight)']),
		'turf': 'Turf',
		'dirt': 'Dirt',
		'straight': 'Straight →',
		'corner': 'Corner ⮌{{n}}',
		'uphill': 'Uphill ↗',
		'downhill': 'Downhill ↘',
		'phase0': 'Opening leg',
		'phase1': 'Middle leg',
		'phase2': 'Final leg',
		'phase3': 'Last spurt',
		'short': Object.freeze({
			'straight': '→',
			'corner': '⮌{{n}}',
			'uphill': '↗',
			'downhill': '↘'
		})
	}),
	'tracknames': TRACKNAMES_en,
	'coursedesc': Object.freeze({  // 1 = turf 2 = dirt
		'one': '{{distance}}m{{inout}}',
		'many': '{{surface}} {{distance}}m{{inout}}'
	}) 
});

const inoutKey = Object.freeze(['', 'none', 'inner', 'outer', 'outin']);

const coursesByTrack = (function () {
	const o = Object.create(null);
	Object.keys(courses).forEach(cid => {
		const tid = courses[cid].raceTrackId;
		if (tid in o) {
			o[tid].push(+cid);
		} else {
			o[tid] = [+cid];
		}
	});
	return Object.freeze(o);
})();

export function TrackSelect(props) {
	const lang = useLanguage();
	let [trackid, setTrackid] = useState(courses[props.courseid].raceTrackId);
	const changeCourse = useCallback((e) => props.setCourseid(+e.target.value), [props.setCourseid]);
	
	function changeTrack(e) {
		const newTrackId = +e.target.value;
		setTrackid(newTrackId);
		props.setCourseid(coursesByTrack[newTrackId][0]);
	}

	return (
		<IntlProvider definition={lang == 'ja' ? STRINGS_ja : STRINGS_en}>
			<div class="trackSelect">
				<select value={trackid} onChange={changeTrack} tabindex={props.tabindex}>
					{Object.keys(tracknames).map(tid => <option value={tid}><Text id={`tracknames.${tid}`} /></option>)}
				</select>
				<select value={props.courseid} onChange={changeCourse} tabindex={props.tabindex + 1}>
					{coursesByTrack[trackid].map(cid =>
						<option value={cid}>
							<Text id="coursedesc" plural={courses[cid].surface} fields={{
								'distance': courses[cid].distance,
								'inout': <Text id={`racetrack.${inoutKey[courses[cid].course]}`} />,
								'surface': <Text id={courses[cid].surface == Surface.Turf ? 'racetrack.turf' : 'racetrack.dirt'} />
							}} />
						</option>
					)}
				</select>
			</div>
		</IntlProvider>
	);
}

function DistanceMarker(props) {
	const y = props.up ? props.y - 11.5 : props.y;
	/*return (
		<Fragment>
			<rect x={`${props.d > 999 ? props.x - 3 : props.x - 2.5}%`} y={`${props.y - 5.3}%`} height="7.5%" width={props.d > 999 ? "6%" : "5%"} fill="rgb(121,64,22)" rx="8" ry="8" />
			<text x={`${props.x}%`} y={`${props.y}%`} font-size="10px" text-anchor="middle" fill="white">{`${props.d}m`}</text>
		</Fragment>
	);*/
	return (
		<Fragment>
			<text class="distanceMarker" x={`${props.x}%`} y={`${y - (props.up ? -0.8 : 0.8)}%`} font-size="10px" text-anchor="middle" dominant-baseline={props.up ? "hanging" : "auto"} fill="rgb(121,64,22)">{`${props.d}m`}</text>
			<line x1={`${props.x}%`} y1={`${y}%`} x2={`${props.x}%`} y2={`${y + (props.up ? -2.5 : 2.5)}%`} stroke="rgb(121,64,22)" />
		</Fragment>
	);
}

function SectionText(props) {
	return <text class="sectionText" x="50%" y="50%" height="40%" width="100%" fill="rgb(121,64,22)"><Text id={`racetrack${props.w < 0.085 ? '.short' : ''}.${props.id}`} fields={props.fields} /></text>;
}

export function RaceTrack(props) {
	const lang = useLanguage();
	const course = CourseHelpers.getCourse(props.courseid);

	const xOffset = props.xOffset || 0, yOffset = props.yOffset || 0, xExtra = props.xExtra || 0, yExtra = props.yExtra || 0;

	function doMouseMove(e) {
		const svg = e.currentTarget;
		if (e.offsetX < xOffset) return;
		const line = svg.querySelector('.mouseoverLine');
		const text = svg.querySelector('.mouseoverText');
		const w = svg.getBoundingClientRect().width - xOffset;
		const x = e.offsetX - xOffset;
		const y = e.offsetY - yOffset;
		line.setAttribute('x1', x);
		line.setAttribute('x2', x);
		text.setAttribute('x', x > w - 45 ? x - 45 : x + 5);
		text.setAttribute('y', y);
		text.textContent = Math.round(x / w * courses[svg.dataset.courseid].distance) + 'm';
		props.mouseMove && props.mouseMove(x / w);
	}

	function doMouseLeave(e) {
		const svg = e.currentTarget;
		const line = svg.querySelector('.mouseoverLine');
		const text = svg.querySelector('.mouseoverText');
		line.setAttribute('x1', -5);
		line.setAttribute('x2', -5);
		text.setAttribute('x', -5);
		text.setAttribute('y', -5);
		props.mouseLeave && props.mouseLeave();
	}

	const trackNameHeader = useMemo(() =>
		<div class="racetrackName">
			<Text id={`tracknames.${course.raceTrackId}`} />{' '}<Text id="coursedesc" plural={course.surface} fields={{
				'distance': course.distance,
				'inout': <Text id={`racetrack.${inoutKey[courses[props.courseid].course]}`} />,
				'surface': <Text id={course.surface == Surface.Turf ? 'racetrack.turf' : 'racetrack.dirt'} />
			}} />{' '}<Text id={`racetrack.orientation.${course.turn}`} />
		</div>
	, [props.courseid]);

	const almostEverything = useMemo(function () {
		const flatLevel = 50;
		const [_, highestPoint, lowestPoint] = course.slopes.reduce((x,s) => {
			const [last,highest,lowest] = x;
			const us = last + s.slope / 10000 * s.length;
			if (us > highest) {
				return [us,us,lowest];
			} else if (us < lowest) {
				return [us,highest,us];
			} else {
				return [us,highest,lowest];
			}
		}, [0,1,0]);
		const range = highestPoint - (lowestPoint + highestPoint > -30 ? 0 : lowestPoint);
		const full = course.slopes.slice();
		let lastEnd = 0;
		course.slopes.forEach((s,i) => {
			if (s.start != lastEnd) {
				full.push({start: lastEnd, length: s.start - lastEnd, slope: 0});
			}
			lastEnd = s.start + s.length;
		});
		if (lastEnd < course.distance) {
			full.push({start: lastEnd, length: course.distance - lastEnd, slope: 0});
		}
		full.sort((a,b) => a.start - b.start);
		const slopeEndHeights = [50];
		const slopes = full.reduce((elems,s,i) => {
			const lastEndHeight = slopeEndHeights[slopeEndHeights.length - 1];
			const thisEndHeight = lastEndHeight - (s.slope / 10000 * s.length) / range * 40;
			slopeEndHeights.push(thisEndHeight);
			if (s.slope == 0) {
				elems.push(<rect x={`${s.start / course.distance * 100}%`} y={`${lastEndHeight * 0.262}%`} width={`${s.length / course.distance * 100}%`} height="26.2%" fill="rgb(211,243,68)" />);
			} else {
				elems.push(
					<svg class={`hillArea ${s.slope < 0 ? 'downhill' : 'uphill'}`} x={`${s.start / course.distance * 100}%`} y="0" width={`${s.length / course.distance * 100}%`} height="26.2%" viewBox="0 0 100 100" preserveAspectRatio="none">
						<polygon points={`0,${lastEndHeight} 0,100 100,100 100,${thisEndHeight}`} fill="rgb(211,243,68)" />
					</svg>
				);
			}
			return elems;
		}, []);

		const sections = course.straights.concat(course.corners.map(c => ({start: c.start, end: c.start + c.length}))).sort((a,b) => a.start - b.start);

		const phase1Start = Math.round(CourseHelpers.phaseStart(course.distance,1))
		    , phase2Start = Math.round(CourseHelpers.phaseStart(course.distance,2))
		    , phase3Start = Math.round(CourseHelpers.phaseStart(course.distance,3));
		let upi = 0, downi = 0;
		return (
			<Fragment>
				{slopes}
				<rect x="0" y="26.2%" width="100%" height="1.8%" fill="rgb(140,170,10)" />
				<svg class="sectionsBg" x="0" y="28%" width="100%" height="18%">
					<rect x="0" y="0" height="90%" width="100%" fill="rgb(239,229,241)" />
					<rect x="0" y="90%" height="10%" width="100%" fill="rgb(163,106,175)" />
				</svg>
				{course.slopes.map(s =>
					<svg class="slope" x={`${s.start / course.distance * 100}%`} y="28%" width={`${s.length / course.distance * 100}%`} height="18%">
						<rect x="0" y="0" height="90%" width="100%" fill={s.slope > 0 ? (upi % 2 == 0 ? "rgb(234,207,147)" : "rgb(229,196,120)") : (downi % 2 == 0 ? "rgb(82,195,184)" : "rgb(116,206,198)")} />
						<rect x="0" y="90%" height="10%" width="100%" fill={s.slope > 0 ? (upi++ % 2 == 0 ? "rgb(191,143,37)" : "rgb(175,132,33)") : (downi++ % 2 == 0 ? "rgb(42,123,115)" : "rgb(50,142,134)")} />
						<SectionText id={s.slope > 0 ? "uphill" : "downhill"} w={s.length / course.distance} />
					</svg>
				)}
				{course.slopes.map((s,i) => {
					const nodes = [];
					let markedStart = false;
					if (s.start != 0 && (i == 0 || s.start != course.slopes[i-1].start + course.slopes[i-1].length)) {
						markedStart = true;
						nodes.push(<DistanceMarker d={s.start} x={s.start / course.distance * 100} y={42} up={i > 0 && s.start - (course.slopes[i-1].start + course.slopes[i-1].length) < course.distance * 0.05} />);
					}
					if (s.start + s.length != course.distance) {
						nodes.push(<DistanceMarker d={s.start + s.length} x={(s.start + s.length) / course.distance * 100} y={42} up={markedStart && s.length < course.distance * 0.05} />);
					}
					return <Fragment>{nodes}</Fragment>;
				})}
				<svg class="sectionsBg" x="0" y="46%" width="100%" height="18%">
					<rect x="0" y="0" height="90%" width="100%" fill="rgb(232,232,232)" />
					<rect x="0" y="90%" height="10%" width="100%" fill="rgb(139,139,139)" />
				</svg>
				{course.straights.map((s,i) =>
					<svg class="straight" x={`${s.start / course.distance * 100}%`} y="46%" width={`${(s.end - s.start) / course.distance * 100}%`} height="18%">
						<rect x="0" y="0" height="90%" width="100%" fill={i % 2 == 0 ? "rgb(209,235,255)" : "rgb(185,224,255)"} />
						<rect x="0" y="90%" height="10%" width="100%" fill={i % 2 == 0 ? "rgb(23,154,255)" : "rgb(9,146,254)"} />
						<SectionText id="straight" w={(s.end - s.start) / course.distance * 100} />
					</svg>
				)}
				{course.corners.map((c,i) =>
					<svg class="corner" x={`${c.start / course.distance * 100}%`} y="46%" width={`${c.length / course.distance * 100}%`} height="18%">
						<rect x="0" y="0" height="90%" width="100%" fill={i % 2 == 0 ? "rgb(255,216,185)" : "rgb(254,228,209)"} />
						<rect x="0" y="90%" height="10%" width="100%" fill={i % 2 == 0 ? "rgb(254,117,9)" : "rgb(250,121,27)"} />
						<SectionText id="corner" w={c.length / course.distance} fields={{n: 4 - (course.corners.length - i - 1) % 4}} />
					</svg>
				)}
				{sections.map((s,i) => {
					const nodes = [];
					let markedStart = false;
					if (s.start != 0 && (i == 0 || s.start != sections[i-1].end)) {
						markedStart = true;
						nodes.push(<DistanceMarker d={s.start} x={s.start / course.distance * 100} y={60} up={i > 0 && s.start - sections[i-1].end < course.distance * 0.05} />);
					}
					if (s.end != course.distance) {
						nodes.push(<DistanceMarker d={s.end} x={s.end / course.distance * 100} y={60} up={markedStart && s.end - s.start < course.distance * 0.05} />);
					}
					return <Fragment>{nodes}</Fragment>;
				})}
				<svg class="phase phase0" x="0" y="64%" width="16.67%" height="18%">
					<rect x="0" y="0" height="90%" width="100%" fill="rgb(0,154,111)" /> {/*rgb(0,158,115)*/}
					<rect x="0" y="90%" height="10%" width="100%" fill="rgb(0,92,66)" /> {/*rgb(0,94,69)*/}
					<SectionText id="phase0" w={0.1667} />
				</svg>
				<svg class="phase phase1" x="16.67%" y="64%" width="50%" height="18%">
					<rect x="0" y="0" height="90%" width="100%" fill="rgb(242,233,103)" /> {/*rgb(240,228,66)*/}
					<rect x="0" y="90%" height="10%" width="100%" fill="rgb(190,179,16)" /> {/*rgb(170,159,13)*/}
					<SectionText id="phase1" w={0.5} />
				</svg>
				<svg class="phase phase2" x="66.67%" y="64%" width="16.67%" height="18%">
					<rect x="0" y="0" height="90%" width="100%" fill="rgb(209,134,175)" /> {/*rgb(204,121,167)*/}
					<rect x="0" y="90%" height="10%" width="100%" fill="rgb(149,56,107)" /> {/*rgb(141,53,102)*/}
					<SectionText id="phase2" w={0.1667} />
				</svg>
				<svg class="phase phase3" x="83.33%" y="64%" width="16.67%" height="18%">
					<rect x="0" y="0" height="90%" width="100%" fill="rgb(199,109,159)" /> {/*rgb(186,73,136)*/}
					<rect x="0" y="90%" height="10%" width="100%" fill="rgb(133,51,96)" /> {/*rgb(112,42,81)*/}
					<SectionText id="phase3" w={0.1667} />
				</svg>
				<DistanceMarker d={phase1Start} x="16.67" y={78} />
				<DistanceMarker d={phase2Start} x="66.67" y={78} />
				<DistanceMarker d={phase3Start} x="83.33" y={78} />
				<rect x="0" y="82%" height="18%" width="100%" fill="rgb(228,235,240)" />
				{Array.from({length: 25}, (_,i) => i).map(i => <line x1={`${i / 24 * 100}%`} y1="96%" x2={`${i / 24 * 100}%`} y2="100%" stroke="rgb(107,145,173)" stroke-width={i == 0 || i == 24 ? "4" : "2"} />)}
				{Array.from({length: 24}, (_,i) => i + 1).map(i => <text x={`${(1/48 + (i-1)/24) * 100}%`} y="91%" font-size="10px" text-anchor="middle" dominant-baseline="central" fill="rgb(107,145,173)">{i}</text>)}
				<rect x="0" y="98.2%" height="1.8%" width="100%" fill="rgb(107,145,173)" />
			</Fragment>
		);
	}, [props.courseid]);

	const regions = useMemo(function () {
		return props.regions.reduce((state,desc) => {
			if (desc.type == RegionDisplayType.Immediate && desc.regions.length > 0) {
				let x = desc.regions[0].start / course.distance * 100;
				while (state.seen.has(x)) {
					x += (3 + +(x == 0)) / props.width * 100;
				}
				state.seen.add(x);
				state.elem.push(<line x1={`${x}%`} y1="0" x2={`${x}%`} y2="100%" stroke={desc.color.stroke} stroke-width={x == 0 ? 4 : 2} />);
			} else if (desc.type == RegionDisplayType.Textbox) {
				const rects = desc.regions.map(r => {
					const x = r.start / course.distance * 100;
					const w = (r.end - r.start) / course.distance * 100;
					let i = 0;
					while (i < 10) {
						if (state.rungs[i].some(b =>
							(r.start >= b.start && r.start < b.end) || (r.end > b.start && r.end <= b.end)
								|| (b.start >= r.start && b.start < r.end) || (b.end > r.start && b.end <= r.end)
						)) {
							++i;
						} else {
							break;
						}
					}
					state.rungs[i % 10].push(r);
					const y = 90 - 10 * i;
					return (
						<svg class="textbox" x={x+'%'} y={y+'%'} width={w+'%'} height="10%">
							<rect x="0" y="0" width="100%" height="100%" fill={desc.color.fill} stroke={desc.color.stroke} />
							<text x="0" y="50%" font-size="12px" dominant-baseline="central">{desc.text}</text>
						</svg>
					);
				});
				state.elem.push(<Fragment>{rects}</Fragment>);
			} else {
				state.elem.push(
					<Fragment>
						{desc.regions.map(r =>
							<rect x={`${r.start / course.distance * 100}%`} y={`${100 - desc.height}%`} width={`${(r.end - r.start) / course.distance * 100}%`} height={`${desc.height}%`} fill={desc.color.fill} stroke={desc.color.stroke} />
						)}
					</Fragment>
				);
			}
			return state;
		}, {seen: new Set(), rungs: Array(10).fill(0).map(_ => []), elem: []}).elem;
	}, [props.regions, course.distance]);

	const statStrings = useText({1: 'common.stat.1', 2: 'common.stat.2', 3: 'common.stat.3', 4: 'common.stat.4', 5: 'common.stat.5'});
	const {noneStat, joiner} = useText({noneStat: 'common.stat.0', joiner: 'common.joiner'});
	const statThresholds = course.courseSetStatus.length == 0 ? noneStat : course.courseSetStatus.map(s => statStrings[s]).join(joiner);

	return (
		<IntlProvider definition={lang == 'ja' ? STRINGS_ja : STRINGS_en}>
			<div class="racetrackWrapper" style={`width:${props.width + xOffset + xExtra}px`}>
				{trackNameHeader}
				<svg version="1.1" width={props.width + xOffset + xExtra} height={props.height + yOffset + yExtra} xmlns="http://www.w3.org/2000/svg" class="racetrackView" data-courseid={props.courseid} onMouseMove={doMouseMove} onMouseLeave={doMouseLeave}>
					<svg x={props.xOffset} y={props.yOffset} width={props.width} height={props.height}>
						{almostEverything}
						{regions}
						<line class="mouseoverLine" x1="-5" y1="0" x2="-5" y2="100%" stroke="rgb(121,64,22)" stroke-width="2" />
						<text class="mouseoverText" x="-5" y="-5" fill="rgb(121,64,22)"></text>
					</svg>
					{props.children}
				</svg>
				{<div class="racetrackStatThresholds"><Text id="racetrack.thresholds" />{statThresholds}</div>}
			</div>
		</IntlProvider>
	);
}
