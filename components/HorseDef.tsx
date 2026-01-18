import { h, Fragment } from 'preact';
import { useState, useReducer, useMemo, useLayoutEffect, useRef } from 'preact/hooks';
import { memo } from 'preact/compat';
import { IntlProvider, Text } from 'preact-i18n';

import { O, c, id, useLens, useGetter, Delete } from '../optics';

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
	'select': Object.freeze({
		'strategy': '作戦',
		'surfaceaptitude': 'バ場適性',
		'distanceaptitude': '距離適正',
		'strategyaptitude': '脚質適正'
	}),
	'skillheader': 'スキル',
	'addskill': '+ スキル追加'
});

const STRINGS_en = Object.freeze({
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
	const [value, setOutfitId] = useLens(props.outfitId);
	const u = value && umas[value.slice(0,4)];

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
		setOutfitId(oid);
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
		if (e.target.value.length == 0) setOutfitId('');
		setOpen(false);
	}

	return (
		<div class="umaSelector">
			<div class="umaSelectorIconsBox" onClick={focus}>
				<img src={value ? icons[value] : randomMob} />
				<img src="/uma-tools/icons/utx_ico_umamusume_00.png" />
			</div>
			<div class="umaEpithet"><span>{value && u.outfits[value]}</span></div>
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
	const [value, setValue] = useLens(props.value);
	return (
		<div class="horseParam">
			<img src={`/uma-tools/icons/statusrank/ui_statusrank_${(100 + rankForStat(value)).toString().slice(1)}.png`} />
			<input type="number" min="1" max="2000" value={value} tabindex={props.tabindex} onInput={(e) => setValue(+e.currentTarget.value)} />
		</div>
	);
}

const APTITUDES = Object.freeze(['S','A','B','C','D','E','F','G']);
export function AptitudeIcon(props) {
	const idx = 7 - APTITUDES.indexOf(props.a);
	return <img src={`/uma-tools/icons/utx_ico_statusrank_${(100 + idx).toString().slice(1)}.png`} loading="lazy" />;
}

export function AptitudeSelect(props){
	const [a, setA] = useLens(props.a);
	const [open, setOpen] = useState(false);
	function setAptitude(e) {
		e.stopPropagation();
		setA(e.currentTarget.dataset.horseAptitude);
		setOpen(false);
	}
	function selectByKey(e: KeyboardEvent) {
		const k = e.key.toUpperCase();
		if (APTITUDES.indexOf(k) > -1) {
			setA(k);
			setOpen(false);
		}
	}
	return (
		<div class="horseAptitudeSelect" tabindex={props.tabindex} onClick={() => setOpen(!open)} onBlur={setOpen.bind(null, false)} onKeyDown={selectByKey}>
			<span><AptitudeIcon a={a} /></span>
			<ul style={open ? "display:block" : "display:none"}>
				{APTITUDES.map(a => <li key={a} data-horse-aptitude={a} onClick={setAptitude}><AptitudeIcon a={a} /></li>)}
			</ul>
		</div>
	);
}

export function StrategySelect(props) {
	const [s, setS] = useLens(props.s);
	return (
		<select class="horseStrategySelect" value={s} tabindex={props.tabindex} onInput={(e) => setS(e.currentTarget.value)} style={CC_GLOBAL ? "text-align:left" : null}>
			<option value="Nige"><Text id="common.strategy.1" /></option>
			<option value="Senkou"><Text id="common.strategy.2" /></option>
			<option value="Sasi"><Text id="common.strategy.3" /></option>
			<option value="Oikomi"><Text id="common.strategy.4" /></option>
			<option value="Oonige"><Text id="common.strategy.5" /></option>
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

export const HorseDef = memo(function HorseDef(props) {
	const lang = useLanguage();
	const [skillPickerOpen, setSkillPickerOpen] = useState(false);
	const [expanded, setExpanded] = useState(new Set());
	const strategy = useGetter(props.state.strategy);
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
	}, {oonigeIsNew: true, old: strategy});
	const [skills, setSkills] = useLens(useMemo(() => props.state._lens(x => x.skills, (f,state) => {
		const newSkills = f(state.skills);
		let strategy = state.strategy;
		// groupId for 大逃げ skill
		if (newSkills.has('20205') && oldStrategyState.oonigeIsNew) {
			strategy = 'Oonige';
			updateOldStrategyState(false);
		} else if (!newSkills.has('20205')) {
			strategy = oldStrategyState.old;
			updateOldStrategyState(true);
		}
		return {...state, skills: newSkills, strategy};
	}), [props.state, oldStrategyState]));

	const tabstart = props.tabstart();
	let tabi = 0;
	function tabnext() {
		if (++tabi > totalTabs) totalTabs = tabi;
		return tabstart + tabi - 1;
	}

	const l_umaId = useMemo(() => props.state._lens(x => x.outfitId, (f,state) => {
		const id = f(state.outfitId);
		const newSkills = new Map();
		state.skills.forEach((id,g) => isGeneralSkill(id) && newSkills.set(g, id));
		if (id) {
			const uid = uniqueSkillForUma(id);
			newSkills.set(skillmeta[uid].groupId, uid);
		}
		return {...state, outfitId: id, skills: newSkills};
	}), [props.state]);
	const umaId = useGetter(l_umaId);
	const selectableSkills = useMemo(() => nonUniqueSkills.filter(id => skilldata[id].rarity != 6 || id.startsWith(umaId) || universallyAccessiblePinks.indexOf(id) != -1), [umaId]);

	const l_strategy = useMemo(() => props.state.strategy._lens(id, (f,strat) => {
		const newStrat = f(strat);
		updateOldStrategyState(newStrat);
		return newStrat;
	}), [props.state.strategy]);

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
			const k = Array.from(skills.entries()).find(([g,id]) => id == se.dataset.skillid)[0];
			skills.delete(k);
			setSkills(new Map(skills));
		} else if (se.classList.contains('expandedSkill')) {
			expanded.delete(se.dataset.skillid);
			setExpanded(new Set(expanded));
		} else {
			expanded.add(se.dataset.skillid);
			setExpanded(new Set(expanded));
		}
	}

	useLayoutEffect(function () {
		document.querySelectorAll('.horseExpandedSkill').forEach(e => {
			(e as HTMLElement).style.gridRow = 'span ' + Math.ceil((e.firstChild as HTMLElement).offsetHeight / 64);
		});
	}, [expanded]);

	const skillList = useMemo(function () {
		const u = uniqueSkillForUma(umaId);
		return Array.from(skills.values()).sort(skillOrder).map(id =>
			expanded.has(id)
				? <li key={id} class="horseExpandedSkill">
					  <ExpandedSkillDetails id={id} distanceFactor={props.courseDistance} dismissable={id != u} />
				  </li>
				: <li key={id} style="">
					  <Skill id={id} selected={false} dismissable={id != u} />
				  </li>
		);
	}, [skills, umaId, expanded, props.courseDistance]);

	return (
		<IntlProvider definition={lang == 'ja' ? STRINGS_ja : STRINGS_global}>
			<div class="horseDef">
				<div class="horseDefHeader">{props.children}</div>
				<UmaSelector outfitId={l_umaId} tabindex={tabnext()} />
				<div class="horseParams">
					<div class="horseParamHeader"><img src="/uma-tools/icons/status_00.png" /><span><Text id="common.stat.1" /></span></div>
					<div class="horseParamHeader"><img src="/uma-tools/icons/status_01.png" /><span><Text id="common.stat.2" /></span></div>
					<div class="horseParamHeader"><img src="/uma-tools/icons/status_02.png" /><span><Text id="common.stat.3" /></span></div>
					<div class="horseParamHeader"><img src="/uma-tools/icons/status_03.png" /><span><Text id="common.stat.4" /></span></div>
					<div class="horseParamHeader"><img src="/uma-tools/icons/status_04.png" /><span><Text id="common.stat.5" /></span></div>
					<Stat value={props.state.speed} tabindex={tabnext()} />
					<Stat value={props.state.stamina} tabindex={tabnext()} />
					<Stat value={props.state.power} tabindex={tabnext()} />
					<Stat value={props.state.guts} tabindex={tabnext()} />
					<Stat value={props.state.wisdom} tabindex={tabnext()} />
				</div>
				<div class="horseAptitudes">
					<div>
						<span><Text id="select.surfaceaptitude" /></span>
						<AptitudeSelect a={props.state.surfaceAptitude} tabindex={tabnext()} />
					</div>
					<div>
						<span><Text id="select.distanceaptitude" /></span>
						<AptitudeSelect a={props.state.distanceAptitude} tabindex={tabnext()} />
					</div>
					<div>
						<span><Text id="select.strategy" /></span>
						<StrategySelect s={l_strategy} tabindex={tabnext()} />
					</div>
					<div>
						<span><Text id="select.strategyaptitude" /></span>
						<AptitudeSelect a={props.state.strategyAptitude} tabindex={tabnext()} />
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
					<SkillList ids={selectableSkills} selected={skills} setSelected={setSkillsAndClose} isOpen={skillPickerOpen} />
				</div>
			</div>
		</IntlProvider>
	);
}, (prev, next) => prev.courseDistance == next.courseDistance && prev.children == next.children);
