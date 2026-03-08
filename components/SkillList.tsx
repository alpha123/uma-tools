import { h, Fragment, cloneElement } from 'preact';
import { useState, useContext, useMemo, useEffect, useRef, useId } from 'preact/hooks';
import { IntlProvider, Text, Localizer } from 'preact-i18n';

import { useLens } from '../optics';

import { getParser } from '../uma-skill-tools/ConditionParser';
import * as Matcher from '../uma-skill-tools/tools/ConditionMatcher';
import { SkillRarity } from '../uma-skill-tools/RaceSolver';
import { ImmediatePolicy, RandomPolicy, UniformRandomPolicy, LogNormalRandomPolicy, ErlangRandomPolicy, StraightRandomPolicy, AllCornerRandomPolicy } from '../uma-skill-tools/ActivationSamplePolicy';

import { useLanguage } from './Language';
import { Tooltip } from './Tooltip';
import { isDebuffSkill, SamplePolicyDesc } from './HorseDefTypes';

import { extendStrings, COMMON_ja, COMMON_en, COMMON_global } from '../strings/common';

import './SkillList.css';

import skilldata from '../uma-skill-tools/data/skill_data.json';
import skillnames from '../uma-skill-tools/data/skillnames.json';
import skillmeta from '../skill_meta.json';

const Parser = getParser(Matcher.mockConditions);

const STRINGS_ja = Object.freeze({
	'skillfilters': Object.freeze({
		'search': '',  // TODO translate
		'white': '白スキル',
		'gold': '金スキル',
		'pink': '進化スキル',
		'unique': '固有スキル',
		'inherit': '継承した固有スキル',
		'nige': COMMON_ja['strategy'][1],
		'senkou': COMMON_ja['strategy'][2],
		'sasi': COMMON_ja['strategy'][3],
		'oikomi': COMMON_ja['strategy'][4],
		'short': COMMON_ja['distance'][1],
		'mile': COMMON_ja['distance'][2],
		'medium': COMMON_ja['distance'][3],
		'long': COMMON_ja['distance'][4],
		'turf': '芝',
		'dirt': 'ダート',
		'phase0': '序盤',
		'phase1': '中盤',
		'phase2': '終盤',
		'phase3': 'ラストスパート',
		'finalcorner': '最終コーナー',
		'finalstraight': '最終直線'
	}),
	'skilleffecttypes': Object.freeze({
		'1': 'スピードアップ',
		'2': 'スタミナアップ',
		'3': 'パワーアップ',
		'4': '根性アップ',
		'5': '賢さアップ',
		'9': '体力回復',
		'13': '掛かり時間',
		'21': '現在速度（減速なし）',
		'22': '現在速度',
		'27': '目標速度',
		'28': 'レーン移動速度',
		'29': '掛かりの確率',
		'31': '加速',
		'37': 'Activate random gold skill',
		'42': 'スキルの効果時間上がり'
	}),
	'skilldetails': Object.freeze({
		'accel': '{{n}}m/s²',
		'basinn': '{{n}}バ身',
		'conditions': '発動条件',
		'distance_type': COMMON_ja['distance'],
		'baseduration': '基準持続時間',
		'effectiveduration': '効果時間（{{distance}}m）',
		'durationincrease': '{{n}}倍',
		'effects': '効果',
		'grade': Object.freeze({100: 'G1', 200: 'G2', 300: 'G3', 400: 'OP', 700: 'Pre-OP', 800: 'Maiden', 900: 'デビュー', 999: '毎日'}),
		'ground_condition': COMMON_ja['ground'],
		'ground_type': Object.freeze(['', '芝', 'ダート']),
		'id': 'ID: ',
		'meters': '{{n}}m',
		'motivation': Object.freeze(['', '絶不調', '不調', '普通', '好調', '絶好調']),
		'order_rate': 'チャンミ：{{cm}}、リグヒ：{{loh}}',
		'preconditions': '前提条件',
		'rotation': Object.freeze(['', '右回り', '左回り']),
		'running_style': COMMON_ja['strategy'],
		'season': COMMON_ja['season'],
		'seconds': '{{n}}s',
		'slope': Object.freeze(['平地', '上り坂', '下り坂']),
		'speed': '{{n}}m/s',
		'time': COMMON_ja['time'],
		'weather': COMMON_ja['weather']
	}),
	'activationlabel': '発動：',
	'samplepolicies': Object.freeze({
		'immediate': 'Immediate',
		'fixed': 'Fixed distance',
		'random': 'Random (Uniform)',
		'log-normal': 'Random (Log-normal)',
		'erlang': 'Random (Erlang)',
		'straight-random': 'straight_random',
		'all-corner-random': 'all_corner_random'
	})
});

const STRINGS_en = Object.freeze({
	'skillfilters': Object.freeze({
		'search': 'Search by skill name or conditions',
		'white': 'White skills',
		'gold': 'Gold skills',
		'pink': 'Evolved skills',
		'unique': 'Unique skills',
		'inherit': 'Inherited uniques',
		'nige': COMMON_en['strategy'][1],
		'senkou': COMMON_en['strategy'][2],
		'sasi': COMMON_en['strategy'][3],
		'oikomi': COMMON_en['strategy'][4],
		'short': COMMON_en['distance'][1],
		'mile': COMMON_en['distance'][2],
		'medium': COMMON_en['distance'][3],
		'long': COMMON_en['distance'][4],
		'turf': 'Turf',
		'dirt': 'Dirt',
		'phase0': 'Opening leg',
		'phase1': 'Middle leg',
		'phase2': 'Final leg',
		'phase3': 'Last spurt',
		'finalcorner': 'Final corner',
		'finalstraight': 'Final straight'
	}),
	'skilleffecttypes': Object.freeze({
		'1': 'Speed up',
		'2': 'Stamina up',
		'3': 'Power up',
		'4': 'Guts up',
		'5': 'Wisdom up',
		'9': 'Recovery',
		'13': 'Kakari duration',
		'21': 'Current speed',
		'22': 'Current speed with natural deceleration',
		'27': 'Target speed',
		'28': 'Lane movement speed',
		'29': 'Kakari chance',
		'31': 'Acceleration',
		'37': 'Activate random gold skill',
		'42': 'Increase skill duration'
	}),
	'skilldetails': Object.freeze({
		'accel': '{{n}}m/s²',
		'basinn': '{{n}} bashin',
		'conditions': 'Conditions:',
		'distance_type': COMMON_en['distance'],
		'baseduration': 'Base duration:',
		'effectiveduration': 'Effective duration ({{distance}}m):',
		'durationincrease': '{{n}}×',
		'effects': 'Effects:',
		'grade': Object.freeze({100: 'G1', 200: 'G2', 300: 'G3', 400: 'OP', 700: 'Pre-OP', 800: 'Maiden', 900: 'Debut', 999: 'Daily races'}),
		'ground_condition': COMMON_en['ground'],
		'ground_type': Object.freeze(['', 'Turf', 'Dirt']),
		'id': 'ID: ',
		'meters': '{{n}}m',
		'motivation': Object.freeze(['', 'Terrible', 'Bad', 'Normal', 'Good', 'Perfect']),
		'order_rate': 'CM: {{cm}}, LOH: {{loh}}',
		'preconditions': 'Preconditions:',
		'rotation': Object.freeze(['', 'Clockwise', 'Counterclockwise']),
		'running_style': COMMON_en['strategy'],
		'season': COMMON_en['season'],
		'seconds': '{{n}}s',
		'slope': Object.freeze(['Flat', 'Uphill', 'Downhill']),
		'speed': '{{n}}m/s',
		'time': COMMON_en['time'],
		'weather': COMMON_en['weather']
	}),
	'activationlabel': 'Activation:',
	'samplepolicies': Object.freeze({
		'immediate': 'Immediate',
		'fixed': 'Fixed distance',
		'random': 'Random (Uniform)',
		'log-normal': 'Random (Log-normal)',
		'erlang': 'Random (Erlang)',
		'straight-random': 'straight_random',
		'all-corner-random': 'all_corner_random'
	})
});

const STRINGS_global = extendStrings(STRINGS_en, {
	'skillfilters': extendStrings(STRINGS_en['skillfilters'], {
		'nige': COMMON_global['strategy'][1],
		'senkou': COMMON_global['strategy'][2],
		'sasi': COMMON_global['strategy'][3],
		'oikomi': COMMON_global['strategy'][4],
		'short': COMMON_global['distance'][1],
		'mile': COMMON_global['distance'][2],
		'medium': COMMON_global['distance'][3],
		'long': COMMON_global['distance'][4],
		'phase0': 'Early-race',
		'phase1': 'Mid-race',
		'phase2': 'Late-race',
	}),
	'skilleffecttypes': extendStrings(STRINGS_en['skilleffecttypes'], {
		'5': 'Wit up',
		'13': 'Rushed duration',
		'29': 'Rushed chance'
	}),
	'skilldetails': extendStrings(STRINGS_en['skilldetails'], {
		'distance_type': COMMON_global['distance'],
		'ground_condition': COMMON_global['ground'],
		'running_style': COMMON_global['strategy'],
		'season': COMMON_global['season'],
		'weather': COMMON_global['weather'],
		'time': COMMON_global['time']
	})
});

const STRINGS = {
	'ja': STRINGS_ja,
	'en': STRINGS_en,
	'en-ja': STRINGS_en,
	'en-global': STRINGS_global
};

function C(s: string) {
	return Parser.parseAny(Parser.tokenize(s));
}

const filterOps = Object.freeze({
	'nige': [C('running_style==1')],
	'senkou': [C('running_style==2')],
	'sasi': [C('running_style==3')],
	'oikomi': [C('running_style==4')],
	'short': [C('distance_type==1')],
	'mile': [C('distance_type==2')],
	'medium': [C('distance_type==3')],
	'long': [C('distance_type==4')],
	'turf': [C('ground_type==1')],
	'dirt': [C('ground_type==2')],
	'phase0': [C('phase==0'), C('phase_random==0'), C('phase_firsthalf_random==0'), C('phase_laterhalf_random==0')],
	'phase1': [C('phase==1'), C('phase>=1'), C('phase_random==1'), C('phase_firsthalf_random==1'), C('phase_laterhalf_random==1')],
	'phase2': [C('phase==2'), C('phase>=2'), C('phase_random==2'), C('phase_firsthalf_random==2'), C('phase_laterhalf_random==2'), C('phase_firstquarter_random==2'), C('is_lastspurt==1')],
	'phase3': [C('phase==3'), C('phase_random==3'), C('phase_firsthalf_random==3'), C('phase_laterhalf_random==3')],
	'finalcorner': [C('is_finalcorner==1'), C('is_finalcorner_laterhalf==1'), C('is_finalcorner_random==1')],
	'finalstraight': [C('is_last_straight==1'), C('is_last_straight_onetime==1')]
});

const parsedConditions = {};
Object.keys(skilldata).forEach(id => {
	parsedConditions[id] = skilldata[id].alternatives.map(ef => Parser.parse(Parser.tokenize(ef.condition)));
});

function matchRarity(id, testRarity) {
	const r = skilldata[id].rarity;
	switch (testRarity) {
	case 'white':
		return r == SkillRarity.White && id[0] != '9';
	case 'gold':
		return r == SkillRarity.Gold;
	case 'pink':
		return r == SkillRarity.Evolution;
	case 'unique':
		return r > SkillRarity.Gold && r < SkillRarity.Evolution;
	case 'inherit':
		return id[0] == '9';
	default:
		return true;
	}
}

const classnames = Object.freeze(['', 'skill-white', 'skill-gold', 'skill-unique', 'skill-unique', 'skill-unique', 'skill-pink']);

export function Skill(props) {
	return (
		<div class={`skill ${classnames[skilldata[props.id].rarity]} ${props.selected ? 'selected' : ''}`} data-skillid={props.id}>
			<img class="skillIcon" src={`/uma-tools/icons/skill/utx_ico_skill_${skillmeta[props.id].iconId}.png`} loading="lazy" /> 
			<span class="skillName"><Text id={`skillnames.${props.id}`} /></span>
			{props.dismissable && <span class="skillDismiss">✕</span>}
		</div>
	);
}

interface ConditionFormatter {
	name: string
	formatArg(arg: number): any
}

function fmtSeconds(arg: number) {
	return <Text id="skilldetails.seconds" plural={arg} fields={{n: arg}} />;
}

function fmtPercent(arg: number) {
	return `${arg}%`;
}

function fmtMeters(arg: number) {
	return <Text id="skilldetails.meters" plural={arg} fields={{n: arg}} />;
}

function fmtString(strId: string) {
	return function (arg: number) {
		return <Tooltip title={arg.toString()} tall={useLanguage() == 'ja'}><Text id={`skilldetails.${strId}.${arg}`} /></Tooltip>;
	};
}

const conditionFormatters = new Proxy({
	accumulatetime: fmtSeconds,
	bashin_diff_behind(arg: number) {
		return <Localizer><Tooltip title={<Text id="skilldetails.meters" plural={arg * 2.5} fields={{n: arg * 2.5}} />}><Text id="skilldetails.basinn" plural={arg} fields={{n: arg}} /></Tooltip></Localizer>;
	},
	bashin_diff_infront(arg: number) {
		return <Localizer><Tooltip title={<Text id="skilldetails.meters" plural={arg * 2.5} fields={{n: arg * 2.5}} />}><Text id="skilldetails.basinn" plural={arg} fields={{n: arg}} /></Tooltip></Localizer>;
	},
	behind_near_lane_time: fmtSeconds,
	behind_near_lane_time_set1: fmtSeconds,
	blocked_all_continuetime: fmtSeconds,
	blocked_front_continuetime: fmtSeconds,
	blocked_side_continuetime: fmtSeconds,
	course_distance: fmtMeters,
	distance_diff_rate: fmtPercent,
	distance_diff_top(arg: number) {
		return <Localizer><Tooltip title={<Text id="skilldetails.basinn" plural={arg / 2.5} fields={{n: arg / 2.5}} />}><Text id="skilldetails.meters" plural={arg} fields={{n: arg}} /></Tooltip></Localizer>;
	},
	distance_diff_top_float(arg: number) {
		return <Localizer><Tooltip title={<Text id="skilldetails.basinn" plural={arg / 25} fields={{n: arg / 25}} />}><Text id="skilldetails.meters" plural={arg} fields={{n: (arg / 10).toFixed(1)}} /></Tooltip></Localizer>;
	},
	distance_rate: fmtPercent,
	distance_rate_after_random: fmtPercent,
	distance_type: fmtString('distance_type'),
	grade: fmtString('grade'),
	ground_condition: fmtString('ground_condition'),
	ground_type: fmtString('ground_type'),
	hp_per: fmtPercent,
	infront_near_lane_time: fmtSeconds,
	motivation: fmtString('motivation'),
	order_rate(arg: number) {
		return <Localizer><Tooltip title={<Text id="skilldetails.order_rate" fields={{cm: Math.round(arg / 100 * 9), loh: Math.round(arg / 100 * 12)}} />}>{arg}</Tooltip></Localizer>;
	},
	overtake_target_no_order_up_time: fmtSeconds,
	overtake_target_time: fmtSeconds,
	random_lot: fmtPercent,
	remain_distance: fmtMeters,
	rotation: fmtString('rotation'),
	running_style: fmtString('running_style'),
	season: fmtString('season'),
	slope: fmtString('slope'),
	time: fmtString('time'),
	track_id(arg: number) {
		return <Tooltip title={arg} tall={useLanguage() == 'ja'}><Text id={`tracknames.${arg}`} /></Tooltip>;
	},
	weather: fmtString('weather')
}, {
	get(o: object, prop: string) {
		if (o.hasOwnProperty(prop)) {
			return {name: prop, formatArg: o[prop]};
		}
		return {
			name: prop,
			formatArg(arg: number) {
				return arg.toString();
			}
		}; 
	}
});

interface OpFormatter {
	format(): any
}

class AndFormatter {
	constructor(readonly left: OpFormatter, readonly right: OpFormatter) {}
	
	format() {
		return (
			<Fragment>
				{this.left.format()}
				<span class="operatorAnd">&amp;</span>
				{this.right.format()}
			</Fragment>
		);
	}
}

class OrFormatter {
	constructor(readonly left: OpFormatter, readonly right: OpFormatter) {}
	
	format() {
		return (
			<Fragment>
				{this.left.format()}
				<span class="operatorOr">@<span class="operatorOrText">or</span></span>
				{this.right.format()}
			</Fragment>
		);
	}
}

function CmpFormatter(op: string) {
	return class {
		constructor(readonly cond: ConditionFormatter, readonly arg: number) {}
		
		format() {
			return (
				<div class="condition">
					<span class="conditionName">{this.cond.name}</span><span class="conditionOp">{op}</span><span class="conditionArg">{this.cond.formatArg(this.arg)}</span>
				</div>
			);
		}
	};
}

const FormatParser = getParser<ConditionFormatter,OpFormatter>(conditionFormatters, {
	and: AndFormatter,
	or: OrFormatter,
	eq: CmpFormatter('=='),
	neq: CmpFormatter('!='),
	lt: CmpFormatter('<'),
	lte: CmpFormatter('<='),
	gt: CmpFormatter('>'),
	gte: CmpFormatter('>=')
});

function forceSign(n: number) {
	return n <= 0 ? n.toString() : '+' + n;
}

const formatStat = forceSign;

function formatSpeed(n: number) {
	return <Text id="skilldetails.speed" plural={n} fields={{n: forceSign(n)}} />;
}

const formatEffect = Object.freeze({
	1: formatStat,
	2: formatStat,
	3: formatStat,
	4: formatStat,
	5: formatStat,
	9: n => `${(n * 100).toFixed(1)}%`,
	13: s => fmtSeconds(forceSign(s)),
	21: formatSpeed, 
	22: formatSpeed,
	27: formatSpeed,
	29: n => forceSign(n) + '%',
	31: n => <Text id="skilldetails.accel" plural={n} fields={{n: forceSign(n)}} />,
	42: n => <Text id="skilldetails.durationincrease" plural={n} fields={{n}} />
});

const RealParser = getParser();
function defaultSamplePolicyForSkill(id) {
	// TODO
	// Each alternative may resolve to a different ActivationSamplePolicy, so correctly we should have one
	// SamplePolicyEditor for each alternative in ExpandedSkillDetails below. unfortunately, there's currently no
	// good way to pass per-alternative samplePolicy overrides, and doing so would require slightly invasive changes
	// to RaceSolverBuilder.
	// This is mostly okay since not many skills actually have alternatives with different samplePolicies, but it
	// does mean that technically if the second alternative has a different samplePolicy and the first one doesn't
	// activate on this course, then this display lies about the default. (Editing it will be fine since it overrides
	// all alternatives.)
	const sp = RealParser.parse(RealParser.tokenize(skilldata[id].alternatives[0].condition)).samplePolicy;
	if (sp == ImmediatePolicy) {
		return {policy: 'immediate'};
	} else if (sp == RandomPolicy || sp instanceof UniformRandomPolicy) {
		// i wish i had written about why these are separate things; conceptually the reason is that the former is used
		// for true random conditions (e.g. _random) and the latter is used for non-random conditions that happen to be
		// best modeled by a uniform distribution.
		// they should (in theory) have the same median/mean behavior, though their implementations are different enough
		// that it's hard for me to prove that is the case. also, RandomPolicy places fixed 10m triggers, while
		// UniformRandomPolicy places triggers that stretch to the end of the region; this is unlikely to matter.
		// iirc, the point is only that they reconcile differently, which isn't relevant to the user at all, so lie
		// about UniformRandomPolicy being the same as RandomPolicy to avoid having two effectively identical options.
		// (note that what is displayed as "Random (Uniform)" in the UI is RandomPolicy and not UniformRandomPolicy)
		// XXX because their implementations are different this might result in the unintuitive behavior that changing a
		// UniformRandomPolicy skill to something else and then back to random might cause it to activate in different
		//  places (since it's not actually the original sample policy in spite of being indistinguishable in the UI)
		return {policy: 'random'};
	} else if (sp instanceof LogNormalRandomPolicy) {
		return {policy: 'log-normal', mu: sp.mu, sigma: sp.sigma};
	} else if (sp instanceof ErlangRandomPolicy) {
		return {policy: 'erlang', k: sp.k, lambda: sp.lambda};
	} else if (sp == StraightRandomPolicy) {
		return {policy: 'straight-random'};
	} else if (sp == AllCornerRandomPolicy) {
		return {policy: 'all-corner-random'};
	} else {
		console.assert(false);
	}
	// fixed will never occur as a default
}

function makePolicy(type: SamplePolicyDesc['policy'], distance: number): SamplePolicyDesc {
	switch (type) {
		case 'immediate':
		case 'random':
		case 'straight-random':
		case 'all-corner-random':
			return {policy: type};
		case 'fixed':
			return {policy: 'fixed', pos: Math.floor(distance / 2)};
		case 'log-normal':
			return {policy: 'log-normal', mu: 0, sigma: 0.25};
		case 'erlang':
			return {policy: 'erlang', k: 3, lambda: 2.0};
	}
}

function SamplePolicyEditor(props) {
	let [desc, setDesc] = useLens(props.desc);
	if (desc == null) desc = props.fallback;

	const selid = useId();
	const param1id = useId();
	const param2id = useId();

	function updateType(e) {
		setDesc(makePolicy(e.currentTarget.value, props.courseDistance));
	}

	function update(p) {
		return (e) => {
			let value = +e.currentTarget.value;
			if (p == 'sigma' || p == 'lambda') value = Math.max(value, Number.MIN_VALUE);
			else if (p == 'k') value = Math.max(value, 1);
			setDesc({...desc, [p]: value});
		};
	}

	let params = null;
	switch (desc.policy) {
		case 'fixed':
			params = <Fragment>
				<input type="number" id={param1id} min="0" max={props.courseDistance} value={desc.pos} onInput={update('pos')} />
				<label for={param1id}>m</label>
			</Fragment>;
			break;
		case 'log-normal':
			// currently we disable μ for log-normal and λ for erlang because due to the way the simulator works these
			// parameters dont actually do anything, and it's somewhat confusing for them to be visible but useless.
			params = <Fragment>
				{/*<label for={param1id}>μ=</label>
				*<input type="number" id={param1id} step="0.01" value={desc.mu.toFixed(2)} onInput={update('mu')} />*/}
				<label for={param2id}>σ=</label>
				{/* mathematically, min for both this and λ below should exclude 0, but no way to do that for input type="number" */}
				<input type="number" id={param2id} min="0" step="0.01" value={desc.sigma.toFixed(2)} onInput={update('sigma')} />
			</Fragment>;
			break;
		case 'erlang':
			params = <Fragment>
				<label for={param1id}>k=</label>
				<input type="number" id={param1id} min="1" value={desc.k} onInput={update('k')} />
				{/*<label for={param2id}>λ=</label>
				<input type="number" id={param2id} min="0" step="0.05" value={desc.lambda.toFixed(2)} onInput={update('lambda')} />*/}
			</Fragment>;
			break;
	}
	return (
		<div class="skillDetailsSection skillActivationEditor">
			<label for={selid}><Text id="activationlabel" /></label>
			<select id={selid} onChange={updateType}>
				{['immediate', 'fixed', 'random', 'log-normal', 'erlang', 'straight-random', 'all-corner-random'].map(k =>
					<option value={k} selected={k == desc.policy}><Text id={`samplepolicies.${k}`} /></option>
				)}
			</select>
			<div class="skillActivationParams">{params}</div>
		</div>
	);
}

export function ExpandedSkillDetails(props) {
	const skill = skilldata[props.id];
	const lang = useLanguage();
	return (
		<IntlProvider definition={STRINGS[lang]}>
			<div class={`expandedSkill ${classnames[skill.rarity]}`} data-skillid={props.id}>
				<div class="expandedSkillHeader">
					<img class="skillIcon" src={`/uma-tools/icons/skill/utx_ico_skill_${skillmeta[props.id].iconId}.png`} />
					<span class="skillName"><Text id={`skillnames.${props.id}`} /></span>
					{props.dismissable && <span class="skillDismiss">✕</span>}
				</div>
				<div class="skillDetails">
					<div>
						<Text id="skilldetails.id" />
						{props.id}
					</div>
					{skill.alternatives.map(alt =>
						<div class="skillDetailsSection">
							{alt.precondition.length > 0 && <Fragment>
								<Text id="skilldetails.preconditions" />
								<div class="skillConditions">
									{FormatParser.parse(FormatParser.tokenize(alt.precondition)).format()}
								</div>
							</Fragment>}
							<Text id="skilldetails.conditions" />
							<div class="skillConditions">
								{FormatParser.parse(FormatParser.tokenize(alt.condition)).format()}
							</div>
							<Text id="skilldetails.effects" />
							<div class="skillEffects">
								{alt.effects.map(ef =>
									<div class="skillEffect">
										<span class="skillEffectType"><Text id={`skilleffecttypes.${ef.type}`}>{ef.type}</Text></span>
										<span class="skillEffectValue">{ef.type in formatEffect ? formatEffect[ef.type](ef.modifier / 10000) : ef.modifier / 10000}</span>
									</div>
								)}
							</div>
							{alt.baseDuration > 0 && <span class="skillDuration"><Text id="skilldetails.baseduration" />{' '}<Text id="skilldetails.seconds" fields={{n: alt.baseDuration / 10000}} /></span>}
							{props.distanceFactor && alt.baseDuration > 0 &&
								<span class="skillDuration">
									<Text id="skilldetails.effectiveduration" fields={{distance: props.distanceFactor}} />{' '}
									<Text id="skilldetails.seconds" fields={{n: +(alt.baseDuration / 10000 * (props.distanceFactor / 1000)).toFixed(2)}} />
								</span>
							}
						</div>
					)}
					{props.samplePolicy != null && <SamplePolicyEditor desc={props.samplePolicy} fallback={defaultSamplePolicyForSkill(props.id)} courseDistance={props.distanceFactor} />}
				</div>
			</div>
		</IntlProvider>
	);
}

// they really just gave up with the ids for scenario pinks
const iconIdPrefixes = Object.freeze({
	'1001': ['1001'],
	'1002': ['1002', '2018'],
	'1003': ['1003'],
	'1004': ['1004'],
	'1005': ['1005'],
	'1006': ['1006'],
	'2002': ['2002', '2011', '2028'],
	'2001': ['2001', '2010', '2014', '2015', '2016', '2019', '2021', '2022', '2024', '2026', '2029', '2031', '2032', '2033'],
	'2004': ['2004', '2012', '2017', '2020', '2025', '2027', '2030'],
	'2005': ['2005', '2013'],
	'2006': ['2006'],
	'2009': ['2009'],
	'3001': ['3001'],
	'3002': ['3002'],
	'3004': ['3004'],
	'3005': ['3005'],
	'3007': ['3007'],
	'4001': ['4001']
});

const groups_filters = Object.freeze({
	'rarity': ['white', 'gold', 'pink', 'unique', 'inherit'],
	'icontype': ['1001', '1002', '1003', '1004', '1005', '1006', '4001', '2002', '2001', '2004', '2005', '2006', '2009', '3001', '3002', '3004', '3005', '3007'],
	'strategy': ['nige', 'senkou', 'sasi', 'oikomi'],
	'distance': ['short', 'mile', 'medium', 'long'],
	'surface': ['turf', 'dirt'],
	'location': ['phase0', 'phase1', 'phase2', 'phase3', 'finalcorner', 'finalstraight']
});

function textSearch(id: string, searchText: string, searchConditions: boolean) {
	const needle = searchText.toUpperCase();
	if ((skillnames[id] || []).some(s => s.toUpperCase().indexOf(needle) > -1)) {
		return 1;
	} else if (searchConditions) {
		let op = null;
		try {
			op = C(searchText);
		} catch (_) {
			return 0;
		}
		return parsedConditions[id].some(alt => Matcher.treeMatch(op, alt)) ? 2 : 0;
	} else {
		return 0;
	}
}

export function SkillList(props) {
	const lang = useLanguage();
	const [visible, setVisible] = useState(() => new Set(props.ids));
	const active = {}, setActive = {};
	Object.keys(groups_filters).forEach(group => {
		active[group] = {};
		setActive[group] = {};
		groups_filters[group].forEach(filter => {
			const [active_, setActive_] = useState(group == 'icontype');
			active[group][filter] = active_;
			setActive[group][filter] = setActive_;
		});
	});
	const searchInput = useRef(null);
	const [searchText, setSearchText] = useState('');

	// group - allow selecting one skill per group
	// single - select each skill individually
	const selectionMode = props.selectionMode || 'group';
	function groupIdFor(id) {
		return selectionMode == 'single' ? id : skillmeta[id].groupId;
	}

	useEffect(function () {
		if (props.isOpen && searchInput.current) {
			searchInput.current.focus();
			searchInput.current.select();
		}
	}, [props.isOpen]);

	function toggleSelected(e) {
		const se = e.target.closest('div.skill');
		if (se == null) return;
		e.stopPropagation();
		let id = se.dataset.skillid;
		const groupId = groupIdFor(id);
		// fake the group ids for debuff skills to allow adding multiple of them. this is because skills are unique per
		// groupId (the keys of the map) and not by skill id, so it's fine to add the same value to multiple keys. groupIds
		// aren't used as keys into anything else (like skill data) so it doesn't really matter what they are, only that
		// they're the same for skills that should be mutually exclusive (which we want for white/gold/pink sets, but not for
		// debuffs)
		const newSelected = new Map(props.selected.entries());
		if (isDebuffSkill(id)) {
			const ndebuffs = Array.from(props.selected.values()).filter(isDebuffSkill).length;
			newSelected.set(groupId + '-' + ndebuffs, id);
		} else {
			newSelected.set(groupId, id);
		}
		props.setSelected(newSelected);
	}

	function updateFilters(e) {
		if (e.target.tagName != 'BUTTON' && e.target.tagName != 'INPUT') return;
		e.stopPropagation();
		const group = e.target.parentElement.dataset.filterGroup;
		const filter = e.target.dataset.filter;
		let newSearchText = searchText;
		if (group == 'search') {
			newSearchText = e.target.value;
			setSearchText(newSearchText);
		} else if (group == 'icontype') {
			if (active.icontype[filter] && !groups_filters.icontype.every(f => active.icontype[f])) {
				groups_filters.icontype.forEach(f => setActive.icontype[f](active.icontype[f] = true));
			} else {
				groups_filters.icontype.forEach(f => setActive.icontype[f](active.icontype[f] = (f == filter)));
			}
		} else {
			setActive[group][filter](active[group][filter]);
			Object.keys(active[group]).forEach(k => setActive[group][k](active[group][k] = !active[group][k] && k == filter))
		}
		const filtered = new Set();
		let allowConditionSearch = true;
		props.ids.forEach(id => {
			// if any names match, don't search conditions
			const passesTextSearch = newSearchText.length > 0 ? textSearch(id, newSearchText, allowConditionSearch) : 3;
			if (allowConditionSearch && passesTextSearch == 1) {  // name matches
				allowConditionSearch = false;
			}
			const pass = passesTextSearch && Object.keys(groups_filters).every(group => {
				const check = groups_filters[group].filter(f => active[group][f]);
				if (check.length == 0) return true;
				if (group == 'rarity') return check.some(f => matchRarity(id, f));
				else if (group == 'icontype') return check.some(f => iconIdPrefixes[f].some(p => skillmeta[id].iconId.startsWith(p)));
				return check.some(f => filterOps[f].some(op => parsedConditions[id].some(alt => Matcher.treeMatch(op, alt))));
			});
			if (pass) {
				filtered.add(id);
			}
		});
		setVisible(filtered);
	}

	function FilterGroup(props) {
		return <div data-filter-group={props.group}>{props.children.map(c => cloneElement(c, {group: props.group}))}</div>;
	}

	function FilterButton(props) {
		return <button data-filter={props.filter} class={`filterButton ${active[props.group][props.filter] ? 'active' : ''}`}><Text id={`skillfilters.${props.filter}`} /></button>
	}
	
	function IconFilterButton(props) {
		return <button data-filter={props.type} class={`iconFilterButton ${active[props.group][props.type] ? 'active': ''}`} style={`background-image:url(/uma-tools/icons/skill/utx_ico_skill_${props.type == '4001' ? '40012' : props.type + '1'}.png)`}></button>
	}

	const items = useMemo(() => {
		return props.ids.map(id => (
			<li key={id} class={visible.has(id) ? '' : 'hidden'}>
				<Skill id={id} selected={props.selected.get(groupIdFor(id)) == id} />
			</li>
		));
	}, [props.ids, props.selected, visible]);

	return (
		<IntlProvider definition={STRINGS[lang]}>
			<div class="filterGroups" onClick={updateFilters}>
				<div data-filter-group="search">
					<Localizer><input type="text" class="filterSearch" value={searchText} placeholder={<Text id="skillfilters.search" />} onInput={updateFilters} ref={searchInput} /></Localizer>
				</div>
				<FilterGroup group="rarity">
					<FilterButton filter="white" />
					<FilterButton filter="gold" />
					<FilterButton filter="pink" />
					<FilterButton filter="unique" />
					<FilterButton filter="inherit" />
				</FilterGroup>
				<FilterGroup group="icontype">
					{groups_filters['icontype'].map(t => <IconFilterButton type={t} />)}
				</FilterGroup>
				<FilterGroup group="strategy">
					<FilterButton filter="nige" />
					<FilterButton filter="senkou" />
					<FilterButton filter="sasi" />
					<FilterButton filter="oikomi" />
				</FilterGroup>
				<FilterGroup group="distance">
					<FilterButton filter="short" />
					<FilterButton filter="mile" />
					<FilterButton filter="medium" />
					<FilterButton filter="long" />
				</FilterGroup>
				<FilterGroup group="surface">
					<FilterButton filter="turf" />
					<FilterButton filter="dirt" />
				</FilterGroup>
				<FilterGroup group="location">
					<FilterButton filter="phase0" />
					<FilterButton filter="phase1" />
					<FilterButton filter="phase2" />
					<FilterButton filter="phase3" />
					<FilterButton filter="finalcorner" />
					<FilterButton filter="finalstraight" />
				</FilterGroup>
			</div>
			<ul class="skillList" onClick={toggleSelected}>{items}</ul>
		</IntlProvider>
	);
}
