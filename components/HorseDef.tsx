import { h, Fragment } from 'preact';
import { useState, useReducer, useMemo, useEffect, useRef } from 'preact/hooks';
import { IntlProvider, Text } from 'preact-i18n';
import { Set as ImmSet } from 'immutable';

import { useLanguage } from '../components/Language';
import { SkillList, Skill, ExpandedSkillDetails } from '../components/SkillList';

import { HorseParameters } from '../uma-skill-tools/HorseTypes';

import { SkillSet, HorseState } from './HorseDefTypes';

import './HorseDef.css';

import umas from '../umas.json';
import icons from '../icons.json';
import skilldata from '../uma-skill-tools/data/skill_data.json';
import skillmeta from '../skill_meta.json';

const STRINGS_ja = Object.freeze({
	'strategy': Object.freeze({
		'nige': '逃げ',
		'senkou': '先行',
		'sasi': '差し',
		'oikomi': '追込',
		'oonige': '大逃げ'
	}),
	'select': Object.freeze({
		'strategy': 'TODO check game for 脚質 vs 作戦',
		'surfaceaptitude': 'コース適正 or バ場適性',
		'distanceaptitude': '距離適正',
		'strategyaptitude': '脚質適正'
	}),
	'skillheader': 'スキル',
	'addskill': '+ スキル追加'
});

const STRINGS_en = Object.freeze({
	'strategy': Object.freeze({
		'nige': 'Runner',
		'senkou': 'Leader',
		'sasi': 'Betweener',
		'oikomi': 'Chaser',
		'oonige': 'Oonige'
	}),
	'select': Object.freeze({
		'strategy': 'Strategy:',
		'surfaceaptitude': 'Surface aptitude:',
		'distanceaptitude': 'Distance aptitude:',
		'strategyaptitude': 'Strategy aptitude:'
	}),
	'skillheader': 'Skills',
	'addskill': 'Add Skill'
});

const STRINGS_global = Object.freeze({
	'strategy': Object.freeze({
		'nige': 'Front Runner',
		'senkou': 'Pace Chaser',
		'sasi': 'Late Surger',
		'oikomi': 'End Closer',
		'oonige': 'Runaway'
	}),
	'select': Object.freeze({
		'strategy': 'Style:',
		'surfaceaptitude': 'Surface aptitude:',
		'distanceaptitude': 'Distance aptitude:',
		'strategyaptitude': 'Style aptitude:'
	}),
	'skillheader': 'Skills',
	'addskill': 'Add Skill'
});

const umaAltIds = Object.keys(umas).flatMap(id => Object.keys(umas[id].outfits));
const umaNamesForSearch = {};
umaAltIds.forEach(id => {
	const u = umas[id.slice(0,4)];
	umaNamesForSearch[id] = (u.outfits[id] + ' ' + u.name[1]).toUpperCase().replace(/\./g, '');
});

function searchNames(query) {
	const q = query.toUpperCase().replace(/\./g, '');
	return umaAltIds.filter(oid => umaNamesForSearch[oid].indexOf(q) > -1);
}

export function UmaSelector(props) {
	const randomMob = useMemo(() => `/uma-tools/icons/mob/trained_mob_chr_icon_${8000 + Math.floor(Math.random() * 624)}_000001_01.png`, []);
	const u = props.value && umas[props.value.slice(0,4)];

	const input = useRef(null);
	const suggestionsContainer = useRef(null);
	const [open, setOpen] = useState(false);
	const [activeIdx, setActiveIdx] = useState(-1);
	function update(q) {
		return {input: q, suggestions: searchNames(q)};
	}
	const [query, search] = useReducer((_,q) => update(q), u && u.name[1], update);

	function confirm(oid) {
		setOpen(false);
		props.select(oid);
		const uname = umas[oid.slice(0,4)].name[1];
		search(uname);
		setActiveIdx(-1);
		if (input.current != null) {
			input.current.value = uname;
			input.current.blur();
		}
	}

	function focus() {
		input.current && input.current.select();
	}

	function setActiveAndScroll(idx) {
		setActiveIdx(idx);
		if (!suggestionsContainer.current) return;
		const container = suggestionsContainer.current;
		const li = container.querySelector(`[data-uma-id="${query.suggestions[idx]}"]`);
		const ch = container.offsetHeight - 4;  // 4 for borders
		if (li.offsetTop < container.scrollTop) {
			container.scrollTop = li.offsetTop;
		} else if (li.offsetTop >= container.scrollTop + ch) {
			const h = li.offsetHeight;
			container.scrollTop = (li.offsetTop / h - (ch / h - 1)) * h;
		}
	}

	function handleClick(e) {
		const li = e.target.closest('.umaSuggestion');
		if (li == null) return;
		e.stopPropagation();
		confirm(li.dataset.umaId);
	}

	function handleInput(e) {
		search(e.target.value);
	}

	function handleKeyDown(e) {
		const l = query.suggestions.length;
		switch (e.keyCode) {
			case 13:
				if (activeIdx > -1) confirm(query.suggestions[activeIdx]);
				break;
			case 38:
				setActiveAndScroll((activeIdx - 1 + l) % l);
				break;
			case 40:
				setActiveAndScroll((activeIdx + 1 + l) % l);
				break;
		}
	}

	function handleBlur(e) {
		if (e.target.value.length == 0) props.select('');
		setOpen(false);
	}

	return (
		<div class="umaSelector">
			<div class="umaSelectorIconsBox" onClick={focus}>
				<img src={props.value ? icons[props.value] : randomMob} />
				<img src="/uma-tools/icons/utx_ico_umamusume_00.png" />
			</div>
			<div class="umaEpithet"><span>{props.value && u.outfits[props.value]}</span></div>
			<div class="umaSelectWrapper">
				<input type="text" class="umaSelectInput" value={query.input} tabindex={props.tabindex} onInput={handleInput} onKeyDown={handleKeyDown} onFocus={() => setOpen(true)} onBlur={handleBlur} ref={input} />
				<ul class={`umaSuggestions ${open ? 'open' : ''}`} onMouseDown={handleClick} ref={suggestionsContainer}>
					{query.suggestions.map((oid, i) => {
						const uid = oid.slice(0,4);
						return (
							<li key={oid} data-uma-id={oid} class={`umaSuggestion ${i == activeIdx ? 'selected' : ''}`}>
								<img src={icons[oid]} loading="lazy" /><span>{umas[uid].outfits[oid]} {umas[uid].name[1]}</span>
							</li>
						);
					})}
				</ul>
			</div>
		</div>
	);
}

function rankForStat(x: number) {
	if (x > 1200) {
		// over 1200 letter (eg UG) goes up by 100 and minor number (eg UG8) goes up by 10
		return Math.min(18 + Math.floor((x - 1200) / 100) * 10 + Math.floor(x / 10) % 10, 97);
	} else if (x >= 1150) {
		return 17; // SS+
	} else if (x >= 1100) {
		return 16; // SS
	} else if (x >= 400) {
		// between 400 and 1100 letter goes up by 100 starting with C (8)
		return 8 + Math.floor((x - 400) / 100);
	} else {
		// between 1 and 400 letter goes up by 50 starting with G+ (0)
		return Math.floor(x / 50);
	}
}

export function Stat(props) {
	return (
		<div class="horseParam">
			<img src={`/uma-tools/icons/statusrank/ui_statusrank_${(100 + rankForStat(props.value)).toString().slice(1)}.png`} />
			<input type="number" min="1" max="2000" value={props.value} tabindex={props.tabindex} onInput={(e) => props.change(+e.currentTarget.value)} />
		</div>
	);
}

const APTITUDES = Object.freeze(['S','A','B','C','D','E','F','G']);
export function AptitudeIcon(props) {
	const idx = 7 - APTITUDES.indexOf(props.a);
	return <img src={`/uma-tools/icons/utx_ico_statusrank_${(100 + idx).toString().slice(1)}.png`} loading="lazy" />;
}

export function AptitudeSelect(props){
	const [open, setOpen] = useState(false);
	function setAptitude(e) {
		e.stopPropagation();
		props.setA(e.currentTarget.dataset.horseAptitude);
		setOpen(false);
	}
	function selectByKey(e: KeyboardEvent) {
		const k = e.key.toUpperCase();
		if (APTITUDES.indexOf(k) > -1) {
			props.setA(k);
		}
	}
	return (
		<div class="horseAptitudeSelect" tabindex={props.tabindex} onClick={() => setOpen(!open)} onBlur={setOpen.bind(null, false)} onKeyDown={selectByKey}>
			<span><AptitudeIcon a={props.a} /></span>
			<ul style={open ? "display:block" : "display:none"}>
				{APTITUDES.map(a => <li key={a} data-horse-aptitude={a} onClick={setAptitude}><AptitudeIcon a={a} /></li>)}
			</ul>
		</div>
	);
}

export function StrategySelect(props) {
	return (
		<select class="horseStrategySelect" value={props.s} tabindex={props.tabindex} onInput={(e) => props.setS(e.currentTarget.value)} style={CC_GLOBAL ? "text-align:left" : null}>
			<option value="Nige"><Text id="strategy.nige" /></option>
			<option value="Senkou"><Text id="strategy.senkou" /></option>
			<option value="Sasi"><Text id="strategy.sasi" /></option>
			<option value="Oikomi"><Text id="strategy.oikomi" /></option>
			<option value="Oonige"><Text id="strategy.oonige" /></option>
		</select>
	);
}

const nonUniqueSkills = Object.keys(skilldata).filter(id => skilldata[id].rarity < 3 || skilldata[id].rarity > 5);
const universallyAccessiblePinks = ['92111091' /* welfare kraft alt pink unique inherit */].concat(Object.keys(skilldata).filter(id => id[0] == '4'));

export function isGeneralSkill(id: string) {
	return skilldata[id].rarity < 3 || universallyAccessiblePinks.indexOf(id) > -1;
}

function assertIsSkill(sid: string): asserts sid is keyof typeof skilldata {
	console.assert(skilldata[sid] != null);
}

function uniqueSkillForUma(oid: typeof umaAltIds[number]): keyof typeof skilldata {
	const i = +oid.slice(1, -2), v = +oid.slice(-2);
	const sid = (100000 + 10000 * (v - 1) + i * 10 + 1).toString();
	assertIsSkill(sid);
	return sid;
}

function skillOrder(a, b) {
	const x = skillmeta[a].order, y = skillmeta[b].order;
	return +(y < x) - +(x < y) || +(b < a) - +(a < b);
}

let totalTabs = 0;
export function horseDefTabs() {
	return totalTabs;
}

export function HorseDef(props) {
	const lang = useLanguage();
	const {state, setState} = props;
	const [skillPickerOpen, setSkillPickerOpen] = useState(false);
	const [expanded, setExpanded] = useState(() => ImmSet());
	// essentially what we want to do is:
	//   - when the user selects oonige, the strategy should be set to oonige
	//   - when the user removes oonige, the strategy should be set to whatever they had selected before
	//   - if the user selects oonige and then changes the strategy manually and then adds another skill, the strategy should stay
	//     on whatever they selected and not activate oonige again
	//   - if the user then removes oonige and adds it again, it should be reset to oonige
	const [oldStrategyState, updateOldStrategyState] = useReducer((ss, msg: boolean | string) => {
		if (typeof msg == 'boolean') {
			return {...ss, oonigeIsNew: msg};
		}
		return {...ss, old: msg};
	}, {oonigeIsNew: true, old: props.state.get('strategy')});

	const tabstart = props.tabstart();
	let tabi = 0;
	function tabnext() {
		if (++tabi > totalTabs) totalTabs = tabi;
		return tabstart + tabi - 1;
	}

	const umaId = state.outfitId;
	const selectableSkills = useMemo(() => nonUniqueSkills.filter(id => skilldata[id].rarity != 6 || id.startsWith(umaId) || universallyAccessiblePinks.indexOf(id) != -1), [umaId]);

	function setter(prop: keyof HorseState) {
		return (x) => setState(state.set(prop, x));
	}
	function setSkills(skills) {
		let st = state;
		// groupId for 大逃げ skill
		if (skills.has('20205') && oldStrategyState.oonigeIsNew) {
			st = st.set('strategy', 'Oonige');
			updateOldStrategyState(false);
		} else if (!skills.has('20205')) {
			st = st.set('strategy', oldStrategyState.old);
			updateOldStrategyState(true);
		}
		setState(st.set('skills', skills));
	}
	function setStrategy(strat) {
		updateOldStrategyState(strat);
		setState(state.set('strategy', strat));
	}

	function setUma(id) {
		let newSkills = state.skills.filter(isGeneralSkill);
		if (id) {
			const uid = uniqueSkillForUma(id);
			newSkills = newSkills.set(skillmeta[uid].groupId, uid);
		}
		setState(
			state.set('outfitId', id)
				.set('skills', newSkills)
		);
	}

	function openSkillPicker(e) {
		e.stopPropagation();
		setSkillPickerOpen(true);
	}

	function setSkillsAndClose(skills) {
		setSkills(skills);
		setSkillPickerOpen(false);
	}

	function handleSkillClick(e) {
		e.stopPropagation();
		const se = e.target.closest('.skill, .expandedSkill');
		if (se == null) return;
		if (e.target.classList.contains('skillDismiss')) {
			// can't just remove skillmeta[skillid].groupId because debuffs will have a fake groupId
			setSkills(state.skills.delete(state.skills.findKey(id => id == se.dataset.skillid)));
		} else if (se.classList.contains('expandedSkill')) {
			setExpanded(expanded.delete(se.dataset.skillid));
		} else {
			setExpanded(expanded.add(se.dataset.skillid));
		}
	}

	useEffect(function () {
		window.requestAnimationFrame(() =>
			document.querySelectorAll('.horseExpandedSkill').forEach(e => {
				(e as HTMLElement).style.gridRow = 'span ' + Math.ceil((e.firstChild as HTMLElement).offsetHeight / 64);
			})
		);
	}, [expanded]);

	const skillList = useMemo(function () {
		const u = uniqueSkillForUma(umaId);
		return Array.from(state.skills.values()).sort(skillOrder).map(id =>
			expanded.has(id)
				? <li key={id} class="horseExpandedSkill">
					  <ExpandedSkillDetails id={id} distanceFactor={props.courseDistance} dismissable={id != u} />
				  </li>
				: <li key={id} style="">
					  <Skill id={id} selected={false} dismissable={id != u} />
				  </li>
		);
	}, [state.skills, umaId, expanded, props.courseDistance]);

	return (
		<IntlProvider definition={lang == 'ja' ? STRINGS_ja : STRINGS_global}>
			<div class="horseDef">
				<div class="horseDefHeader">{props.children}</div>
				<UmaSelector value={umaId} select={setUma} tabindex={tabnext()} />
				<div class="horseParams">
					<div class="horseParamHeader"><img src="/uma-tools/icons/status_00.png" /><span><Text id="common.stat.1" /></span></div>
					<div class="horseParamHeader"><img src="/uma-tools/icons/status_01.png" /><span><Text id="common.stat.2" /></span></div>
					<div class="horseParamHeader"><img src="/uma-tools/icons/status_02.png" /><span><Text id="common.stat.3" /></span></div>
					<div class="horseParamHeader"><img src="/uma-tools/icons/status_03.png" /><span><Text id="common.stat.4" /></span></div>
					<div class="horseParamHeader"><img src="/uma-tools/icons/status_04.png" /><span><Text id="common.stat.5" /></span></div>
					<Stat value={state.speed} change={setter('speed')} tabindex={tabnext()} />
					<Stat value={state.stamina} change={setter('stamina')} tabindex={tabnext()} />
					<Stat value={state.power} change={setter('power')} tabindex={tabnext()} />
					<Stat value={state.guts} change={setter('guts')} tabindex={tabnext()} />
					<Stat value={state.wisdom} change={setter('wisdom')} tabindex={tabnext()} />
				</div>
				<div class="horseAptitudes">
					<div>
						<span><Text id="select.surfaceaptitude" /></span>
						<AptitudeSelect a={state.surfaceAptitude} setA={setter('surfaceAptitude')} tabindex={tabnext()} />
					</div>
					<div>
						<span><Text id="select.distanceaptitude" /></span>
						<AptitudeSelect a={state.distanceAptitude} setA={setter('distanceAptitude')} tabindex={tabnext()} />
					</div>
					<div>
						<span><Text id="select.strategy" /></span>
						<StrategySelect s={state.strategy} setS={setStrategy} tabindex={tabnext()} />
					</div>
					<div>
						<span><Text id="select.strategyaptitude" /></span>
						<AptitudeSelect a={state.strategyAptitude} setA={setter('strategyAptitude')} tabindex={tabnext()} />
					</div>
				</div>
				<div class="horseSkillHeader"><Text id="skillheader" /></div>
				<div class="horseSkillListWrapper" onClick={handleSkillClick}>
					<ul class="horseSkillList">
						{skillList}
						<li key="add">
							<div class="skill addSkillButton" onClick={openSkillPicker} tabindex={tabnext()}>
								<span>+</span><Text id="addskill" />
							</div>
						</li>
					</ul>
				</div>
				<div class={`horseSkillPickerOverlay ${skillPickerOpen ? "open" : ""}`} onClick={setSkillPickerOpen.bind(null, false)} />
				<div class={`horseSkillPickerWrapper ${skillPickerOpen ? "open" : ""}`}>
					<SkillList ids={selectableSkills} selected={state.skills} setSelected={setSkillsAndClose} isOpen={skillPickerOpen} />
				</div>
			</div>
		</IntlProvider>
	);
}
