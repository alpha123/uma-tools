import { Record, Map as ImmMap } from 'immutable';

import skills from '../uma-skill-tools/data/skill_data.json';
import skillmeta from '../skill_meta.json';

export function SkillSet(ids): ImmMap<(typeof skill_meta)['groupId'], keyof typeof skills> {
	return ImmMap(ids.map(id => [skillmeta[id].groupId, id]));
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
