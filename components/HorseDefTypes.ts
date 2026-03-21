import skills from '../uma-skill-tools/data/skill_data.json';
import skillmeta from '../skill_meta.json';

export function isDebuffSkill(id: string) {
	// iconId 3xxxx is the debuff icons
	// i think this basically matches the intuitive behavior of being able to add multiple debuff skills and not other skills;
	// e.g. there are some skills with both a debuff component and a positive component and typically it doesnt make sense to
	// add multiple of those
	return skillmeta[id].iconId[0] == '3';
}

export function isPurpleSkill(id) {
	const iconId = skillmeta[id].iconId;
	return iconId[iconId.length-1] == '4';
}

export const skillGroups = Object.keys(skills).sort((a,b) =>
	// sort by:
	//   - rarity (lowest to highest, white → gold → pink)
	//   - if rarity is the same, sort ○ before ◎ (◎ skills always have a lower ID than their ○ counterparts)
	//   - sort purple versions of a skill last (to avoid counting towards the total cost)
	isPurpleSkill(a) - isPurpleSkill(b) || skills[a].rarity - skills[b].rarity || +b - +a
).reduce((groups, id) => {
	const groupId = skillmeta[id].groupId;
	if (groups.has(groupId)) {
		groups.get(groupId).push(id);
	} else {
		groups.set(groupId, [id]);
	}
	return groups;
}, new Map());

export function SkillSet(ids): Map<(typeof skillmeta)['groupId'], keyof typeof skills> {
	return new Map(ids.reduce((acc, id) => {
		const {entries, ndebuff} = acc;
		const groupId = skillmeta[id].groupId;
		if (isDebuffSkill(id)) {
			entries.push([groupId + '-' + ndebuff, id]);
			return {entries, ndebuff: ndebuff + 1};
		} else {
			entries.push([groupId, id]);
			return {entries, ndebuff};
		}
	}, {entries: [], ndebuff: 0}).entries);
}

// pass these plain objects around instead of actual ActivationSamplePolicy instances since we need to send them
// between web workers, so we need something serializable.
export type SamplePolicyDesc = {policy: 'immediate'} | {policy: 'fixed', pos: number}
	| {policy: 'random'} | {policy: 'straight-random'} | {policy: 'all-corner-random'}
	| {policy: 'log-normal', mu: number, sigma: number} | {policy: 'erlang', k: number, lambda: number};

export type Aptitude = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface HorseState {
	outfitId: string
	speed: number
	stamina: number
	power: number
	guts: number
	wisdom: number
	strategy: 'Nige' | 'Senkou' | 'Sasi' | 'Oikomi' | 'Oonige'
	distanceAptitude: Aptitude
	surfaceAptitude: Aptitude
	strategyAptitude: Aptitude
	skills: Map<(typeof skillmeta)['groupId'], keyof typeof skills>
	samplePolicies: Map<keyof typeof skills, SamplePolicyDesc>
	mood: -2 | -1 | 0 | 1 | 2;
	popularity: number
}

export const DEFAULT_HORSE_STATE = {
	outfitId: '',
	speed:   CC_GLOBAL ? 1200 : 1850,
	stamina: CC_GLOBAL ? 1200 : 1700,
	power:   CC_GLOBAL ? 800 : 1700,
	guts:    CC_GLOBAL ? 400 : 1200,
	wisdom:  CC_GLOBAL ? 400 : 1300,
	strategy: 'Senkou',
	distanceAptitude: 'S',
	surfaceAptitude: 'A',
	strategyAptitude: 'A',
	skills: SkillSet([]),
	samplePolicies: new Map(),
	mood: 2,
	popularity: 1
};
