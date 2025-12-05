import tracknames from '../uma-skill-tools/data/tracknames.json';

export const TRACKNAMES_ja = {};
Object.keys(tracknames).forEach(k => TRACKNAMES_ja[k] = tracknames[k][0]);
Object.freeze(TRACKNAMES_ja);

export const TRACKNAMES_en = {};
Object.keys(tracknames).forEach(k => TRACKNAMES_en[k] = tracknames[k][1]);
Object.freeze(TRACKNAMES_en);

export const COMMON_ja = Object.freeze({
	'stat': Object.freeze(['なし', 'スピード', 'スタミナ', 'パワー', '根性', '賢さ']),
	'joiner': '、',
});

export const COMMON_en = Object.freeze({
	'stat': Object.freeze(['None', 'Speed', 'Stamina', 'Power', 'Guts', 'Wisdom']),
	'joiner': ', ',
});

export const COMMON_global = Object.freeze({
	'stat': Object.freeze(['None', 'Speed', 'Stamina', 'Power', 'Guts', 'Wit']),
	'joiner': ', ',
});
