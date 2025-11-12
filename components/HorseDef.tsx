import { h, Fragment } from 'preact';
import { useState, useReducer, useMemo, useEffect, useRef } from 'preact/hooks';
import { IntlProvider, Text, Localizer } from 'preact-i18n';
import { Set as ImmSet } from 'immutable';

import { SkillList, Skill, ExpandedSkillDetails } from '../components/SkillList';

import { HorseParameters } from '../uma-skill-tools/HorseTypes';

import { SkillSet, HorseState } from './HorseDefTypes';

import './HorseDef.css';

import umas from '../umas.json';
import icons from '../icons.json';
import skills from '../uma-skill-tools/data/skill_data.json';

function skilldata(id: string) {
	return skills[id.split('-')[0]];
}

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
								<img src={icons[oid]} /><span>{umas[uid].outfits[oid]} {umas[uid].name[1]}</span>
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

function StatIcon({ type }) {
    const d = {
        speed: "M27.709,23.226c1.279-2.223,1.974-4.743,1.974-7.37c-0.026-0.02-0.044-0.048-0.073-0.064c-0.022-0.014-0.05-0.032-0.076-0.047C24.791,9.64,19.9,7.6,14.842,7.6c-5.062,0-9.953,2.042-14.695,8.14c-0.026,0.015-0.054,0.033-0.076,0.047C0.044,15.808,0.026,15.836,0,15.856c-0.021,2.625,0.67,5.138,1.962,7.331c1.285,2.182,3.107,4.003,5.365,5.253C7.352,28.455,7.379,28.46,7.408,28.46c2.167,1.24,4.665,1.96,7.333,1.962c0.004,0,0.008-0.002,0.012-0.002c2.668-0.002,5.166-0.721,7.333-1.962c0.029,0,0.057-0.005,0.086-0.017c2.258-1.25,4.08-3.071,5.365-5.253C28.381,28.318,29.072,25.805,29.093,23.18C29.093,23.155,29.093,23.13,29.093,23.106C29.072,20.48,28.381,17.967,27.093,15.744c-0.009-0.018-0.009-0.037-0.021-0.055c-0.633-1.076-1.394-2.086-2.299-2.992c-0.215-0.215-0.496-0.322-0.778-0.322s-0.562,0.107-0.778,0.322c-0.43,0.43-0.43,1.125,0,1.555c0.527,0.527,0.993,1.1,1.412,1.723c0.302,0.525,0.975,0.707,1.501,0.403l1.839-1.062c0.62,1.244,1.123,2.569,1.479,3.965H2.222c0.358-1.391,0.859-2.71,1.48-3.951l1.839,1.062c0.525,0.303,1.198,0.123,1.5-0.403c0.42-0.623,0.885-1.196,1.412-1.723c0.43-0.43,0.43-1.125,0-1.555c-0.43-0.43-1.125-0.43-1.555,0c-0.905,0.905-1.666,1.915-2.299,2.992c-1.279,2.223-1.974,4.743-1.974,7.379s0.695,5.156,1.974,7.379c1.279,2.223,3.021,4.103,5.293,5.334c2.271,1.231,4.836,1.936,7.575,1.936c2.738,0,5.304-0.705,7.575-1.936c2.271-1.231,4.014-3.111,5.293-5.334C28.381,28.318,29.072,25.805,29.093,23.18C29.093,23.155,29.093,23.13,29.093,23.106z",
        stamina: "M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314",
        power: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z",
        guts: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z",
        wisdom: "M15.5,2.1c-0.2-0.2-0.5-0.3-0.8-0.3c-0.6,0-1.1,0.4-1.2,1c-0.1,0.5,0.2,1.1,0.7,1.2c0.1,0,0.2,0,0.3,0c0.3,0,0.6-0.1,0.8-0.4c1.1,0.9,1.7,2.2,1.7,3.6c0,0.7-0.1,1.3-0.4,1.9c-0.5,1.2-1.5,2-2.8,2.2c-0.6,0.1-1.2,0.1-1.8,0.1c-1,0-2-0.2-2.9-0.5c-0.5-0.2-1.1,0.1-1.3,0.6c-0.2,0.5,0.1,1.1,0.6,1.3c1.1,0.4,2.3,0.6,3.5,0.6c0.8,0,1.5-0.1,2.2-0.2c2.1-0.3,3.9-1.6,4.7-3.5c0.4-1,0.6-2,0.6-3.1C20,5.6,18.4,3.4,15.5,2.1z M5.5,13.1c-0.5,0.2-0.8,0.7-0.6,1.3c0.1,0.3,0.4,0.6,0.7,0.6c0.1,0,0.2,0,0.3,0c0.5-0.2,0.8-0.7,0.6-1.3C6.4,13.3,5.9,13,5.5,13.1z M9.5,11.1c-0.5,0.2-0.8,0.7-0.6,1.3c0.1,0.3,0.4,0.6,0.7,0.6c0.1,0,0.2,0,0.3,0c0.5-0.2,0.8-0.7,0.6-1.3C10.4,11.3,9.9,11,9.5,11.1z M9.4,8.9C9,9,8.7,9.5,8.9,10c0.1,0.3,0.4,0.5,0.7,0.5c0.1,0,0.2,0,0.3,0C10.4,10.2,10.7,9.7,10.5,9.2C10.3,8.8,9.8,8.7,9.4,8.9z M6.4,15.9c-0.5,0.2-0.8,0.7-0.6,1.3c0.1,0.3,0.4,0.5,0.7,0.5c0.1,0,0.2,0,0.3,0c0.5-0.2,0.8-0.7,0.6-1.3C7.3,16.1,6.8,15.8,6.4,15.9z M12.5,20.1c-0.5,0.2-0.8,0.7-0.6,1.3c0.1,0.3,0.4,0.6,0.7,0.6c0.1,0,0.2,0,0.3,0c0.5-0.2,0.8-0.7,0.6-1.3C13.4,20.3,12.9,20,12.5,20.1z M12.5,13.1c-0.5,0.2-0.8,0.7-0.6,1.3c0.1,0.3,0.4,0.6,0.7,0.6c0.1,0,0.2,0,0.3,0c0.5-0.2,0.8-0.7,0.6-1.3C13.4,13.3,12.9,13,12.5,13.1z M4,8.2C3.5,8.1,3,8.4,2.9,8.9c-0.1,0.5,0.2,1.1,0.7,1.2c0.1,0,0.2,0,0.3,0c0.5,0,0.9-0.3,1-0.8C5.1,8.9,4.6,8.4,4,8.2z M10.5,20.1c-0.5,0.2-0.8,0.7-0.6,1.3c0.1,0.3,0.4,0.6,0.7,0.6c0.1,0,0.2,0,0.3,0c0.5-0.2,0.8-0.7,0.6-1.3C11.4,20.3,10.9,20,10.5,20.1z M8.5,17.1c-0.5,0.2-0.8,0.7-0.6,1.3c0.1,0.3,0.4,0.6,0.7,0.6c0.1,0,0.2,0,0.3,0c0.5-0.2,0.8-0.7,0.6-1.3C9.4,17.3,8.9,17,8.5,17.1z M14.5,17.1c-0.5,0.2-0.8,0.7-0.6,1.3c0.1,0.3,0.4,0.6,0.7,0.6c0.1,0,0.2,0,0.3,0c0.5-0.2,0.8-0.7,0.6-1.3C15.4,17.3,14.9,17,14.5,17.1z M18.5,11.1c-0.5,0.2-0.8,0.7-0.6,1.3c0.1,0.3,0.4,0.6,0.7,0.6c0.1,0,0.2,0,0.3,0c0.5-0.2,0.8-0.7,0.6-1.3C19.4,11.3,18.9,11,18.5,11.1z M16.5,14.1c-0.5,0.2-0.8,0.7-0.6,1.3c0.1,0.3,0.4,0.6,0.7,0.6c0.1,0,0.2,0,0.3,0c0.5-0.2,0.8-0.7,0.6-1.3C17.4,14.3,16.9,14,16.5,14.1z",
    }[type];

    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path d={d} />
        </svg>
    );
}

export function Stat(props) {
	return (
		<div class="horseParam">
			<StatIcon type={props.type} />
			<input type="number" min="1" max="2000" value={props.value} tabindex={props.tabindex} onInput={(e) => props.change(+e.currentTarget.value)} />
		</div>
	);
}

const APTITUDES = Object.freeze(['S','A','B','C','D','E','F','G']);
export function AptitudeIcon(props) {
	const idx = 7 - APTITUDES.indexOf(props.a);
	return <img src={`/uma-tools/icons/utx_ico_statusrank_${(100 + idx).toString().slice(1)}.png`} />;
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
	if (CC_GLOBAL) {
		return (
			<select class="horseStrategySelect" value={props.s} tabindex={props.tabindex} onInput={(e) => props.setS(e.currentTarget.value)}>
				<option value="Nige">Front Runner</option>
				<option value="Senkou">Pace Chaser</option>
				<option value="Sasi">Late Surger</option>
				<option value="Oikomi">End Closer</option>
			</select>
		);
	}
	return (
		<select class="horseStrategySelect" value={props.s} tabindex={props.tabindex} onInput={(e) => props.setS(e.currentTarget.value)}>
			<option value="Nige">逃げ</option>
			<option value="Senkou">先行</option>
			<option value="Sasi">差し</option>
			<option value="Oikomi">追込</option>
			<option value="Oonige">大逃げ</option>
		</select>
	);
}

const nonUniqueSkills = Object.keys(skills).filter(id => skilldata(id).rarity < 3 || skilldata(id).rarity > 5);

function assertIsSkill(sid: string): asserts sid is keyof typeof skills {
	console.assert(skilldata(sid) != null);
}

function uniqueSkillForUma(oid: typeof umaAltIds[number]): keyof typeof skills {
	const i = +oid.slice(1, -2), v = +oid.slice(-2);
	const sid = (100000 + 10000 * (v - 1) + i * 10 + 1).toString();
	assertIsSkill(sid);
	return sid;
}

let totalTabs = 0;
export function horseDefTabs() {
	return totalTabs;
}

export function HorseDef(props) {
	const {state, setState} = props;
	const [skillPickerOpen, setSkillPickerOpen] = useState(false);
	const [expanded, setExpanded] = useState(() => ImmSet());

	const tabstart = props.tabstart();
	let tabi = 0;
	function tabnext() {
		if (++tabi > totalTabs) totalTabs = tabi;
		return tabstart + tabi - 1;
	}

	const umaId = state.outfitId;
	const selectableSkills = useMemo(() => nonUniqueSkills.filter(id => skilldata(id).rarity != 6 || id.startsWith(umaId)), [umaId]);

	function setter(prop: keyof HorseState) {
		return (x) => setState(state.set(prop, x));
	}
	const setSkills = setter('skills');

	function setUma(id) {
		let newSkills = state.skills.filter(id => skilldata(id).rarity < 3);
		if (id) newSkills = newSkills.add(uniqueSkillForUma(id));
		setState(
			state.set('outfitId', id)
				.set('skills', newSkills)
		);
	}

	function openSkillPicker(e) {
		e.stopPropagation();
		setSkillPickerOpen(true);
	}

	function setSkillsAndClose(ids) {
		setSkills(SkillSet(ids));
		setSkillPickerOpen(false);
	}

	function handleSkillClick(e) {
		e.stopPropagation();
		const se = e.target.closest('.skill, .expandedSkill');
		if (se == null) return;
		if (e.target.classList.contains('skillDismiss')) {
			setSkills(state.skills.delete(se.dataset.skillid))
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
		return Array.from(state.skills).map(id =>
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
		<div class="horseDef modern">
			<div class="horseDefHeader">{props.children}</div>
			<UmaSelector value={umaId} select={setUma} tabindex={tabnext()} />
			<div class="horseParams">
				<div class="horseParamHeader"><span>Speed</span></div>
				<div class="horseParamHeader"><span>Stamina</span></div>
				<div class="horseParamHeader"><span>Power</span></div>
				<div class="horseParamHeader"><span>Guts</span></div>
				<div class="horseParamHeader"><span>{CC_GLOBAL?'Wit':'Wisdom'}</span></div>
				<Stat type="speed" value={state.speed} change={setter('speed')} tabindex={tabnext()} />
				<Stat type="stamina" value={state.stamina} change={setter('stamina')} tabindex={tabnext()} />
				<Stat type="power" value={state.power} change={setter('power')} tabindex={tabnext()} />
				<Stat type="guts" value={state.guts} change={setter('guts')} tabindex={tabnext()} />
				<Stat type="wisdom" value={state.wisdom} change={setter('wisdom')} tabindex={tabnext()} />
			</div>
			<div class="horseAptitudes">
				<div>
					<span>Surface aptitude:</span>
					<AptitudeSelect a={state.surfaceAptitude} setA={setter('surfaceAptitude')} tabindex={tabnext()} />
				</div>
				<div>
					<span>Distance aptitude:</span>
					<AptitudeSelect a={state.distanceAptitude} setA={setter('distanceAptitude')} tabindex={tabnext()} />
				</div>
				<div>
					<span>{CC_GLOBAL ? 'Style:' : 'Strategy:'}</span>
					<StrategySelect s={state.strategy} setS={setter('strategy')} tabindex={tabnext()} />
				</div>
				<div>
					<span>{CC_GLOBAL ? 'Style aptitude:' : 'Strategy aptitude:'}</span>
					<AptitudeSelect a={state.strategyAptitude} setA={setter('strategyAptitude')} tabindex={tabnext()} />
				</div>
			</div>
			<div class="horseSkillHeader">Skills</div>
			<div class="horseSkillListWrapper" onClick={handleSkillClick}>
				<ul class="horseSkillList">
					{skillList}
					<li key="add">
						<div class="skill addSkillButton" onClick={openSkillPicker} tabindex={tabnext()}>
							<span>+</span>Add Skill
						</div>
					</li>
				</ul>
			</div>
			<div class={`horseSkillPickerOverlay ${skillPickerOpen ? "open" : ""}`} onClick={setSkillPickerOpen.bind(null, false)} />
			<div class={`horseSkillPickerWrapper ${skillPickerOpen ? "open" : ""}`}>
				<SkillList ids={selectableSkills} selected={new Set(state.skills)} setSelected={setSkillsAndClose} isOpen={skillPickerOpen} />
			</div>
		</div>
	);
}
