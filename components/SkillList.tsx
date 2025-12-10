import { h, Fragment, cloneElement } from 'preact';
import { useState, useContext, useMemo, useEffect, useRef } from 'preact/hooks';
import { IntlProvider, Text, Localizer } from 'preact-i18n';

import { getParser } from '../uma-skill-tools/ConditionParser';
import * as Matcher from '../uma-skill-tools/tools/ConditionMatcher';
import { SkillRarity } from '../uma-skill-tools/RaceSolver.ts';

import { useLanguage } from './Language';
import { Tooltip } from './Tooltip';
import { isDebuffSkill } from './HorseDefTypes';

import './SkillList.css';

import skilldata from '../uma-skill-tools/data/skill_data.json';
import skillnames from '../uma-skill-tools/data/skillnames.json';
import skillmeta from '../skill_meta.json';

const Parser = getParser(Matcher.mockConditions);

export const STRINGS_ja = Object.freeze({
	'skillfilters': Object.freeze({
		'search': '',  // TODO translate
		'white': '白スキル',
		'gold': '金スキル',
		'pink': '進化スキル',
		'unique': '固有スキル',
		'inherit': '継承した固有スキル',
		'nige': '逃げ',
		'senkou': '先行',
		'sasi': '差し',
		'oikomi': '追込',
		'short': '短距離',
		'mile': 'マイル',
		'medium': '中距離',
		'long': '長距離',
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
		'21': '現在速度（減速なし）',
		'22': '現在速度',
		'27': '目標速度',
		'28': 'レーン移動速度',
		'31': '加速',
		'37': 'Activate random gold skill',
		'42': 'スキルの効果時間上がり'
	}),
	'skilldetails': Object.freeze({
		'accel': '{{n}}m/s²',
		'basinn': '{{n}}バ身',
		'conditions': '発動条件',
		'distance_type': Object.freeze(['', '短距離', 'マイル', '中距離', '長距離']),
		'baseduration': '基準持続時間',
		'effectiveduration': '効果時間（{{distance}}m）',
		'durationincrease': '{{n}}倍',
		'effects': '効果',
		'grade': Object.freeze({100: 'G1', 200: 'G2', 300: 'G3', 400: 'OP', 700: 'Pre-OP', 800: 'Maiden', 900: 'デビュー', 999: '毎日'}),
		'ground_condition': Object.freeze(['', '良', '稍重', '重', '不良']),
		'ground_type': Object.freeze(['', '芝', 'ダート']),
		'id': 'ID: ',
		'meters': '{{n}}m',
		'motivation': Object.freeze(['', '絶不調', '不調', '普通', '好調', '絶好調']),
		'order_rate': 'チャンミ：{{cm}}、リグヒ：{{loh}}',
		'preconditions': '前提条件',
		'rotation': Object.freeze(['', '右回り', '左回り']),
		'running_style': Object.freeze(['', '逃げ', '先行', '差し', '追込']),
		'season': Object.freeze(['', '早春', '夏', '秋', '冬', '春']),
		'seconds': '{{n}}s',
		'slope': Object.freeze(['平地', '上り坂', '下り坂']),
		'speed': '{{n}}m/s',
		'time': Object.freeze(['', '朝', '昼', '夕方', '夜']),
		'weather': Object.freeze(['', '晴れ', '曇り', '雨', '雪'])
	})
});

export const STRINGS_en = Object.freeze({
	'skillfilters': Object.freeze({
		'search': 'Search by skill name or conditions',
		'white': 'White skills',
		'gold': 'Gold skills',
		'pink': 'Evolved skills',
		'unique': 'Unique skills',
		'inherit': 'Inherited uniques',
		'nige': 'Runner',
		'senkou': 'Leader',
		'sasi': 'Betweener',
		'oikomi': 'Chaser',
		'short': 'Short',
		'mile': 'Mile',
		'medium': 'Medium',
		'long': 'Long',
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
		'21': 'Current speed',
		'22': 'Current speed with natural deceleration',
		'27': 'Target speed',
		'28': 'Lane movement speed',
		'31': 'Acceleration',
		'37': 'Activate random gold skill',
		'42': 'Increase skill duration'
	}),
	'skilldetails': Object.freeze({
		'accel': '{{n}}m/s²',
		'basinn': '{{n}} bashin',
		'conditions': 'Conditions:',
		'distance_type': Object.freeze(['', 'Short', 'Mile', 'Medium', 'Long']),
		'baseduration': 'Base duration:',
		'effectiveduration': 'Effective duration ({{distance}}m):',
		'durationincrease': '{{n}}×',
		'effects': 'Effects:',
		'grade': Object.freeze({100: 'G1', 200: 'G2', 300: 'G3', 400: 'OP', 700: 'Pre-OP', 800: 'Maiden', 900: 'Debut', 999: 'Daily races'}),
		'ground_condition': Object.freeze(['', 'Good', 'Yielding', 'Soft', 'Heavy']),
		'ground_type': Object.freeze(['', 'Turf', 'Dirt']),
		'id': 'ID: ',
		'meters': '{{n}}m',
		'motivation': Object.freeze(['', 'Terrible', 'Bad', 'Normal', 'Good', 'Perfect']),
		'order_rate': 'CM: {{cm}}, LOH: {{loh}}',
		'preconditions': 'Preconditions:',
		'rotation': Object.freeze(['', 'Clockwise', 'Counterclockwise']),
		'running_style': Object.freeze(['', 'Runner', 'Leader', 'Betweener', 'Chaser']),
		'season': Object.freeze(['', 'Early spring', 'Summer', 'Autumn', 'Winter', 'Late spring']),
		'seconds': '{{n}}s',
		'slope': Object.freeze(['Flat', 'Uphill', 'Downhill']),
		'speed': '{{n}}m/s',
		'time': Object.freeze(['', 'Morning', 'Mid day', 'Evening', 'Night']),
		'weather': Object.freeze(['', 'Sunny', 'Cloudy', 'Rainy', 'Snowy'])
	})
});

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
			<img class="skillIcon" src={`/uma-tools/icons/${skillmeta[props.id].iconId}.png`} loading="lazy" /> 
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
	21: formatSpeed, 
	22: formatSpeed,
	27: formatSpeed,
	31: n => <Text id="skilldetails.accel" plural={n} fields={{n: forceSign(n)}} />,
	42: n => <Text id="skilldetails.durationincrease" plural={n} fields={{n}} />
});

export function ExpandedSkillDetails(props) {
	const skill = skilldata[props.id];
	const lang = useLanguage();
	return (
		<IntlProvider definition={lang == 'ja' ? STRINGS_ja : STRINGS_en}>
			<div class={`expandedSkill ${classnames[skill.rarity]}`} data-skillid={props.id}>
				<div class="expandedSkillHeader">
					<img class="skillIcon" src={`/uma-tools/icons/${skillmeta[props.id].iconId}.png`} />
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
		const groupId = skillmeta[id].groupId;
		// fake the group ids for debuff skills to allow adding multiple of them. this is because skills are unique per
		// groupId (the keys of the map) and not by skill id, so it's fine to add the same value to multiple keys. groupIds
		// aren't used as keys into anything else (like skill data) so it doesn't really matter what they are, only that
		// they're the same for skills that should be mutually exclusive (which we want for white/gold/pink sets, but not for
		// debuffs)
		let newSelected;
		if (isDebuffSkill(id)) {
			const ndebuffs = props.selected.count(isDebuffSkill);
			newSelected = props.selected.set(groupId + '-' + ndebuffs, id);
		} else {
			newSelected = props.selected.set(groupId, id);
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
			if (groups_filters.icontype.every(f => active.icontype[f])) {
				groups_filters.icontype.forEach(f => f != filter && setActive.icontype[f](active.icontype[f] = false));
			} else {
				setActive.icontype[filter](active.icontype[filter] = !active.icontype[filter]);
				if (!groups_filters.icontype.some(f => active.icontype[f])) {
					groups_filters.icontype.forEach(f => setActive.icontype[f](active.icontype[f] = true));
				}
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
		return <button data-filter={props.type} class={`iconFilterButton ${active[props.group][props.type] ? 'active': ''}`} style={`background-image:url(/uma-tools/icons/${props.type}1.png)`}></button>
	}

	const items = useMemo(() => {
		return props.ids.map(id => (
			<li key={id} class={visible.has(id) ? '' : 'hidden'}>
				<Skill id={id} selected={props.selected.get(skillmeta[id].groupId) == id} />
			</li>
		));
	}, [props.ids, props.selected, visible]);

	return (
		<IntlProvider definition={lang == 'ja' ? STRINGS_ja : STRINGS_en}>
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
