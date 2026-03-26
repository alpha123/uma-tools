import { h, Fragment, render } from 'preact';
import { useState, useMemo, useEffect, useRef } from 'preact/hooks';
import { Text, Localizer, IntlProvider } from 'preact-i18n';
import GLPK from 'glpk.js';

import { O, c, K, State, makeState, useLens, useGetter, useSetter } from '../optics';

import { Language, LanguageSelect, useLanguageSelect } from '../components/Language';
import { SkillList, skillGroups, costForId } from '../components/SkillList';
import { HorseState, SkillSet, uniqueSkillForUma, DEFAULT_HORSE_STATE } from '../components/HorseDefTypes';
import { HorseDef, horseDefTabs } from '../components/HorseDef';
import { extendStrings, TRACKNAMES_ja, TRACKNAMES_en, COMMON_STRINGS } from '../strings/common';

import { scoreUma } from './scorecalc';

import skills from '../uma-skill-tools/data/skill_data.json';
import skillnames from '../uma-skill-tools/data/skillnames.json';
import skillmeta from '../skill_meta.json';
import umas from '../umas.json';
import icons from '../icons.json';
import cards from './cards.json';

import '../UmaUI.css';
import './app.css';

const UI_ja = Object.freeze({
	'cardsearch': 'サポートカードを検索',
	'umaheader': 'ウマ娘詳細',
	'skillheader': 'スキル：{{sp}}Pt'
});
const UI_en = Object.freeze({
	'cardsearch': 'Search',
	'umaheader': 'Umamusume Details',
	'skillheader': 'Skills ({{sp}} SP)'
});
const UI_global = extendStrings(UI_en, {
});

const UI_STRINGS = Object.freeze({
	'ja': UI_ja,
	'en': UI_en,
	'en-ja': UI_en,
	'en-global': UI_global
});

const allCards = Object.keys(cards);
const cards_skills = new Map(Object.keys(cards)/*.filter(id => cards[id].rarity > 0)*/.map(id => [id, new Set(cards[id].event.concat(cards[id].hints))]));
const SEARCH_NAME = {};
allCards.forEach(cid => {
	SEARCH_NAME[cid] = cards[cid].name.map(s => s.toUpperCase().replaceAll(/\.|\s/g, ''));
});

function awakeningsForUma(outfitId) {
	return outfitId ? new Set(umas[outfitId.slice(0,4)].outfits[outfitId].awakenings) : new Set();
}

function Card(props) {
	const {type, rarity} = cards[props.id];
	return (
		<div class="card" data-cardid={props.id}>
			<img src={`/uma-tools/icons/support/support_thumb_${props.id}.png`} loading="lazy" />
			<img src={`/uma-tools/icons/supportcard_rarity_${(100+rarity).toString().slice(1)}.png`} />
			<img src={`/uma-tools/icons/utx_ico_obtain_${(100+type).toString().slice(1)}.png`} />
		</div>
	);
}

function CardList(props) {
	const [selected, setSelected] = useLens(props.selected);

	const [typeFilter, setTypeFilter] = useState(0x7f);
	const [rarityFilter, setRarityFilter] = useState(0x07);
	const searchInput = useRef(null);
	const [searchText, setSearchText] = useState('');

	useEffect(function () {
		if (props.isOpen && searchInput.current) {
			searchInput.current.focus();
			searchInput.current.select();
		}
	}, [props.isOpen]);

	function select(e) {
		const card = e.target.closest('.card');
		if (card == null) return;
		const newSelected = selected.slice();
		newSelected[props.idx] = card.dataset.cardid;
		setSelected(newSelected);
		props.close();
	}

	function updateFilters(e) {
		if (e.target.tagName == 'INPUT') {
			setSearchText(e.target.value);
		} else if (e.target.tagName == 'BUTTON') {
			const idx = +e.target.dataset.filter;
			switch (e.target.parentElement.dataset.filterGroup) {
				case 'type':
					setTypeFilter(typeFilter == (1 << idx) ? 0x7f : 1 << idx);
					break;
				case 'rarity':
					setRarityFilter(rarityFilter == (1 << idx) ? 0x07 : 1 << idx);
					break;
			}
		}
	}

	const items = useMemo(() => {
		const needle = searchText.toUpperCase().replace(/\.|\s/g, '');
		const secondary = /^AY(?:A|AB|ABE)?\s*$/.test(needle) || /アヤベ?\s*$/.test(needle) ? 'ADMIREVEGA' : '';
		return props.ids.map(id => {
			const c = cards[id];
			const visible = (typeFilter & (1 << c.type)) && (rarityFilter & (1 << c.rarity)) && SEARCH_NAME[id].some(s =>
				s.indexOf(needle) > -1 || (secondary && s.indexOf(secondary) > -1));
			return <li key={id} class={visible ? '' : 'hidden'}>
				<Card id={id} />
			</li>;
		})
	}, [props.ids, selected, typeFilter, rarityFilter, searchText]);

	return (
		<Fragment>
			<div class="cardFilters" onClick={updateFilters}>
				<div data-filter-group="search">
					<Localizer><input type="text" class="filterSearch" value={searchText} placeholder={<Text id="ui.cardsearch" />} onInput={updateFilters} ref={searchInput} /></Localizer>
				</div>
				<div data-filter-group="type">
					{Array.from({length: 7}, (_,i) => <button data-filter={i} class={`iconFilterButton${typeFilter & (1 << i) ? ' active' : ''}`} style={`background-image:url(/uma-tools/icons/utx_ico_obtain_${(100+i).toString().slice(1)}.png)`} />)}
				</div>
				<div data-filter-group="rarity">
					{Array.from({length: 3}, (_,i) => <button data-filter={i} class={`iconFilterButton${rarityFilter & (1 << i) ? ' active' : ''}`} style={`background-image:url(/uma-tools/icons/supportcard_rarity_${(100+i).toString().slice(1)}.png`} />)}
				</div>
			</div>
			<ul class="cardList" onClick={select}>
				<div class="card" data-cardid=""><img src="/uma-tools/icons/support/support_thumb_00000.png" /><div></div></div>
				{items}
			</ul>
		</Fragment>
	);
}

function Deck(props) {
	const [cards, setCards] = useLens(props.cards);

	const [cardPickerOpen, setCardPickerOpen] = useState(false);
	const [clickedIdx, setClickedIdx] = useState(-1);

	function addOrChange(e) {
		const slot = e.target.closest('.deckSlot');
		if (slot == null) return;
		setClickedIdx(+slot.dataset.idx);
		setCardPickerOpen(true);
	}
	
	return (
		<div class="deck">
			<div class="cardset" onClick={addOrChange}>
				{cards.map((id,i) => <button class="deckSlot" tabindex={props.tabstart + i} data-idx={i}>
					{id ? <Card id={id} /> : <div class="addCard">
						<img src="/uma-tools/icons/utx_ico_plus_00.png" />
					</div>}
				</button>)}
			</div>
			<div class={`cardPickerOverlay${cardPickerOpen ? ' open' : ''}`} onClick={setCardPickerOpen.bind(null, false)} />
			<div class={`cardPickerWrapper${cardPickerOpen ? ' open' : ''}`}>
				<CardList ids={allCards} selected={O.deck} close={setCardPickerOpen.bind(null, false)} idx={clickedIdx} isOpen={cardPickerOpen} />
			</div>
		</div>
	);
}

function getBaseSkill(id) {
	const grp = skillGroups.get(skillmeta[id].groupId);
	switch (skills[id].rarity) {
		case 1: return grp[0];  // ◎ → ○
		case 6: return grp.find(id => skills[id].rarity == 2);  // pink → gold
		default: return id;
	}
}

function HintTips(props) {
	const id = getBaseSkill(props.id);
	const cards = props.deck.concat(props.extra).filter(cid => cid && cards_skills.get(cid).has(id)).sort((a,b) => +a - +b);
	return (
		<div class="cardHintTip">
			{props.awakenings.has(id) && <img src={`/uma-tools/icons/chara/${icons[props.outfitId][1]}.png`} />}
			{cards.map(cid => <img src={`/uma-tools/icons/support/support_card_s_${cid}.png`} />)}
		</div>
	);
}

function toCardSet(cc, result) {
	const cardids = [];
	Object.keys(result.result.vars).forEach(v => {
		if (v[0] == 'c' && result.result.vars[v]) {
			cardids.push(cc[+v.slice(2)].id);
		}
	});
	return {n: result.result.z, cards: cardids};
}

function runSolver(glpk, skvars, ncc, constraints) {
	const GLPK_OPTIONS = {msglev: glpk.GLP_MSG_ERR, presol: true};
	const allvars = skvars.map((_,i) => `sk${i}`).concat(Array.from({length: ncc}, (_,j) => `cc${j}`));
	return glpk.solve({
		name: 'skillcover',
		objective: {
			direction: glpk.GLP_MAX,
			name: '∑sk',
			vars: skvars,
		},
		subjectTo: constraints,
		binaries: allvars
	}, GLPK_OPTIONS);
}

// solve a maximum coverage problem to find the optimal assignment of cards to maximize the number of skills provided
// by hints/events.
// unfortuately, there are realistic cases where the naive greedy algorithm fails to find an optimal solution.
// for example, given the following skill ids:
//   200012,200952,200362,200382,201312,201601,202712,202742,202802,202982,203122,203172,203312,203422,204162,210141
// a basic greedy solver usually only manages to cover 14, but 15 are possible. thus we pull in GLPK….
// other approaches are possible, for example randomizing card order and re-running the greedy algorithm a few times,
// but it feels less robust. using an actual solver also makes it relatively easy to generate more results.
// 
// btw, there's nothing quite so humbling as implementing a basic branch-and-bound solver that solves nskills=6 instantly,
// 9 in a few seconds, and 16 not within the limits of my patience, and then throwing an actual ILP solver like GLPK at it
// and getting solutions for any size instantly.
async function cover(glpk, target, k) {
	// candidate cards
	const cc = Object.keys(cards).flatMap(cid => {
		const skills = new Set(cards[cid].event.concat(cards[cid].hints)).intersection(target);
		if (skills.size > 0) {
			return [{id: cid, skills}];
		} else {
			return [];
		}
	});
	const skvars = Array.from(target).map((_,i) => ({name: `sk${i}`, coef: 1}));
	const constraints = [{
		name: '∑cc≤k',
		vars: cc.map((_,j) => ({name: `cc${j}`, coef: 1})),
		bnds: {type: glpk.GLP_UP, ub: k, lb: 0}
	}].concat(Array.from(target).map((sid,i) => {
		const vars = [{name: `sk${i}`, coef: 1}];
		cc.forEach((c,j) => {
			if (c.skills.has(sid)) {
				vars.push({name: `cc${j}`, coef: -1});
			}
		});
		if (vars.length > 1) {
			return {
				name: `cov${i}`,
				vars,
				bnds: {type: glpk.GLP_UP, ub: 0, lb: 0}
			};
		} else {
			return {
				name: `cov${i}`,
				vars,
				bnds: {type: glpk.GLP_FX, ub: 0, lb: 0}
			};
		}
	}));
	const result = await runSolver(glpk, skvars, cc.length, constraints);
	const vars = result.result.vars;
	const addl = Object.keys(vars).filter(v => v[0] == 'c' && vars[v]).map(async v => {
		const r2 = await runSolver(glpk, skvars, cc.length, constraints.concat([{
			name: `excl-${v}`,
			vars: [{name: v, coef: 1}],
			bnds: {type: glpk.GLP_FX, ub: 0, lb: 0}
		}]));
		return toCardSet(cc, r2);
	});
	return [toCardSet(cc, result), ...(await Promise.all(addl)).sort((a,b) => b.n - a.n)];
}

function BuildPlanner(props) {
	const [uma, setUma] = useLens(O.uma);
	const [deck, setDeck] = useLens(O.deck);
	const hints = useGetter(O.hints);

	const [glpk, setGlpk] = useState(null);
	useEffect(() => GLPK().then(setGlpk), []);
	
	const lang = +(props.lang == 'en');
	const strings = {skillnames: {}, tracknames: TRACKNAMES_en, common: COMMON_STRINGS[props.lang], ui: UI_STRINGS[props.lang]};
	const langid = CC_GLOBAL ? 0 : +(props.lang == 'en');
	Object.keys(skillnames).forEach(id => strings.skillnames[id] = skillnames[id][langid]);

	const [hover, setHover] = useState([]);
	function updateHover(e) {
		const cardset = e.target.closest('.cardset');
		if (cardset == null) {
			setHover([]);
		} else {
			setHover(cardset.dataset.cardids.split(','));
		}
	}
	function hoverEnd() {
		setHover([]);
	}

	function addCard(e) {
		const card = e.target.closest('.card');
		const next = deck.indexOf('');
		if (card == null || next == -1) return;
		const newDeck = deck.slice();
		newDeck[next] = card.dataset.cardid;
		setDeck(newDeck);
	}

	const totalSpCost = useMemo(() => Array.from(uma.skills.values()).reduce((acc,id) => acc + costForId(id, hints, new Map()), 0), [uma.skills, hints]);

	const awakenings = useMemo(() => awakeningsForUma(uma.outfitId), [uma.outfitId]);
	const deckSkills = useMemo(() => new Set(deck.flatMap(cid => cid ? cards[cid].event.concat(cards[cid].hints) : [])), [deck]);
	const targetSkills = useMemo(() => {
		const s = new Set(Array.from(uma.skills.values()).map(getBaseSkill))
			.difference(awakenings).difference(deckSkills);
		s.delete(uniqueSkillForUma(uma.outfitId, uma.starCount));
		return s;
	}, [uma.skills, awakenings, deckSkills]);
	const [solutions, setSolutions] = useState([]);
	useEffect(async () => {
		const cardsets = glpk ? await cover(glpk, targetSkills, 6 - deck.filter(x => x).length) : [];
		setSolutions(cardsets);
	}, [glpk, targetSkills, deck]);
	
	return (
		<Language.Provider value={props.lang}>
			<IntlProvider definition={strings}>
				<div id="umaPane">
					<HorseDef key={uma.outfitId} state={O.uma} aptitudesMode="full" courseDistance={0} showPolicyEd={false} tabstart={() => 1}
						skillExtra={<HintTips deck={deck} extra={hover} awakenings={awakenings} outfitId={uma.outfitId} />}
						hintLevels={O.hints} skillHeader={<Text id="ui.skillheader" fields={{sp: totalSpCost}} />}
					>
						<Text id="ui.umaheader" />
						{scoreUma(uma)}
					</HorseDef>
				</div>
				<div id="nonUmaPanes">
					<Deck cards={O.deck} tabstart={horseDefTabs()} />
					<div id="solutions" onDblClick={addCard} onMouseEnterCapture={updateHover} onMouseLeave={hoverEnd}>
						{solutions.map(cardset => <div class="cardset" data-cardids={cardset.cards.join(',')}>
							{cardset.cards.map(id => <Card id={id} />)}
							<div class="cardsetinfo">
								<div class="coverage">
									<img src="/uma-tools/icons/hint.png" />
									<span>{cardset.n}/{targetSkills.size}</span>
								</div>
							</div>
						</div>)}
					</div>
				</div>
			</IntlProvider>
		</Language.Provider>
	);
}

const dfsk = [200012,200952,200362,200382,201312,201601,202712,202742,202802,202982,203122,203172,203312,203422,204162,210141];
//const dfsk = [200012,200952,201601,202712,202742,202802,202982,203122,203172,203312,203422];
function App(props) {
	const state = makeState(() => ({
		uma: {...DEFAULT_HORSE_STATE, samplePolicies: null, skills: SkillSet(dfsk.map(x=>x.toString()))},
		deck: ['','','','','',''],
		hints: new Map(Object.keys(skills).map(id => [id,0]))
		//deck: ['30265', '30077']
		//deck: ['10137', '30017', '30173', '30175', '30275', '30283']
		//deck: [30275,30175,10111,10137,30238,10092].map(x=>x.toString())
		//deck :[10137, 30208, 30175, 30275, 30232].map(x=>x.toString())
		//deck:['20032', '30044', '30184', '30259', '30269', '30282']
		//deck:[10098, 10137, 30017, 30175, 30275, 30283].map(x=>x.toString())
		//deck:[20091, 30017, 30105, 30233, 30275, 30283].map(x=>x.toString())
	}));

	return (
		<State.Provider value={state}>
			<BuildPlanner lang={props.lang} />
		</State.Provider>
	);
}

render(<App lang="ja" />, document.getElementById('app'));
