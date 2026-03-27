import skills from '../uma-skill-tools/data/skill_data.json';
import skillmeta from '../skill_meta.json';

export function isDebuffSkill(id: string) {
	// iconId 3xxxx is the debuff icons
	// i think this basically matches the intuitive behavior of being able to add multiple debuff skills and not other skills;
	// e.g. there are some skills with both a debuff component and a positive component and typically it doesnt make sense to
	// add multiple of those
	return skillmeta[id].iconId[0] == '3';
}

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

function assertIsSkill(sid: string): asserts sid is keyof typeof skilldata {
	console.assert(skills[sid] != null);
}

export function uniqueSkillForUma(oid: string, starCount: 1 | 2 | 3 | 4 | 5): keyof typeof skills | '' {
	if (oid.length == 0) return '';
	const i = +oid.slice(1, -2), v = +oid.slice(-2);
	const sid = (10000 * (1 + 9 * +(starCount > 2)) + 10000 * (v - 1) + i * 10 + 1).toString();
	assertIsSkill(sid);
	return sid;
}

export function umaForUniqueSkill(sid: keyof typeof skilldata) {
	if (sid.length > 6) return umaForUniqueSkill(sid.slice(2));  // evolved unique inherits are 9\d + un-inherited id
	else if (sid.length == 5) return (Math.floor(+sid / 10) * 100 + +sid % 10).toString();
	return (100000 + +sid.slice(2,-1) * 100 + +sid.slice(1,2) + 1).toString();
}

// pass these plain objects around instead of actual ActivationSamplePolicy instances since we need to send them
// between web workers, so we need something serializable.
export type SamplePolicyDesc = {policy: 'immediate'} | {policy: 'fixed', pos: number}
	| {policy: 'random'} | {policy: 'straight-random'} | {policy: 'all-corner-random'}
	| {policy: 'log-normal', mu: number, sigma: number} | {policy: 'erlang', k: number, lambda: number};

export type Aptitude = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface HorseState {
	outfitId: string
	starCount: 1 | 2 | 3 | 4 | 5
	speed: number
	stamina: number
	power: number
	guts: number
	wisdom: number
	strategy: 'Nige' | 'Senkou' | 'Sasi' | 'Oikomi' | 'Oonige'
	distanceAptitude: Aptitude
	surfaceAptitude: Aptitude
	strategyAptitude: Aptitude
	aptitudes: Aptitude[10]
	skills: Map<(typeof skillmeta)['groupId'], keyof typeof skills>
	samplePolicies: Map<keyof typeof skills, SamplePolicyDesc>
	uniqueLv: number
	mood: -2 | -1 | 0 | 1 | 2;
	popularity: number
}

export const DEFAULT_HORSE_STATE = {
	outfitId: '',
	starCount: 3,
	speed:   CC_GLOBAL ? 1200 : 1850,
	stamina: CC_GLOBAL ? 1200 : 1700,
	power:   CC_GLOBAL ? 800 : 1700,
	guts:    CC_GLOBAL ? 400 : 1200,
	wisdom:  CC_GLOBAL ? 400 : 1300,
	strategy: 'Senkou',
	distanceAptitude: 'S',
	surfaceAptitude: 'A',
	strategyAptitude: 'A',
	// short mile medium long nige senkou sasi oikomi turf dirt
	aptitudes: ['S','S','S','S','A','A','A','A','A','A'],
	skills: SkillSet([]),
	samplePolicies: new Map(),
	uniqueLv: 1,
	mood: 2,
	popularity: 1
};
