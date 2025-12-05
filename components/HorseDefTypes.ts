import { Record, Map as ImmMap } from 'immutable';

import skills from '../uma-skill-tools/data/skill_data.json';
import skillmeta from '../skill_meta.json';

export function isDebuffSkill(id: string) {
	// iconId 3xxxx is the debuff icons
	// i think this basically matches the intuitive behavior of being able to add multiple debuff skills and not other skills;
	// e.g. there are some skills with both a debuff component and a positive component and typically it doesnt make sense to
	// add multiple of those
	return skillmeta[id].iconId[0] == '3';
}

export function SkillSet(ids): ImmMap<(typeof skill_meta)['groupId'], keyof typeof skills> {
	return ImmMap(ids.reduce((acc, id) => {
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

export class HorseState extends Record({
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
	skills: SkillSet([])
}) {}
