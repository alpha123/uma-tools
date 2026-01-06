import tracknames from '../uma-skill-tools/data/tracknames.json';

export const TRACKNAMES_ja = {};
Object.keys(tracknames).forEach(k => TRACKNAMES_ja[k] = tracknames[k][0]);
Object.freeze(TRACKNAMES_ja);

export const TRACKNAMES_en = {};
Object.keys(tracknames).forEach(k => TRACKNAMES_en[k] = tracknames[k][1]);
Object.freeze(TRACKNAMES_en);

export function extendStrings(o,e) {
	return Object.freeze(Object.assign(window.structuredClone(o), e));
}

export const COMMON_ja = Object.freeze({
	'stat': Object.freeze(['なし', 'スピード', 'スタミナ', 'パワー', '根性', '賢さ']),
	'joiner': '、',
	'ground': Object.freeze(['', '良', '稍重', '重', '不良']),
	'weather': Object.freeze(['', '晴れ', '曇り', '雨', '雪']),
	'season': Object.freeze(['', '早春', '夏', '秋', '冬', '春']),
	'strategy': Object.freeze(['', '逃げ', '先行', '差し', '追込', '大逃げ'])
});

export const COMMON_en = Object.freeze({
	'stat': Object.freeze(['None', 'Speed', 'Stamina', 'Power', 'Guts', 'Wisdom']),
	'joiner': ', ',
	'ground': Object.freeze(['', 'Good', 'Yielding', 'Soft', 'Heavy']),
	'weather': Object.freeze(['', 'Sunny', 'Cloudy', 'Rainy', 'Snowy']),
	'season': Object.freeze(['', 'Early spring', 'Summer', 'Autumn', 'Winter', 'Late spring']),
	'strategy': Object.freeze(['', 'Runner', 'Leader', 'Betweener', 'Chaser', 'Oonige'])
});

export const COMMON_global = Object.freeze({
	'stat': Object.freeze(['None', 'Speed', 'Stamina', 'Power', 'Guts', 'Wit']),
	'joiner': ', ',
	'ground': Object.freeze(['', 'Firm', 'Good', 'Soft', 'Heavy']),
	'weather': Object.freeze(['', 'Sunny', 'Cloudy', 'Rainy', 'Snowy']),
	'season': Object.freeze(['', 'Spring', 'Summer', 'Fall', 'Winter', 'Spring']),
	'strategy': Object.freeze(['', 'Front Runner', 'Pace Chaser', 'Late Surger', 'End Closer', 'Runaway'])
});
