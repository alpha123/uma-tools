import { HorseState, uniqueSkillForUma } from '../components/HorseDefTypes';

import skillmeta from '../skill_meta.json';

// translation of the following J code:

/*

mulsmall =: 0.5 0.8 1 1.3 1.6 1.8 2.1 2.4 2.6 2.8 2.9 3 3.1 3.3 3.4 3.5 3.9 4.1 4.2 4.3 5.2 5.5 6.6 6.8 6.9
mullarge =: 8 8.1 8.3 8.4 8.5 8.6 8.8 8.9 9 9.2 9.3 9.4 9.6 9.7 9.8 10 10.1 10.2 10.3 10.5 10.6 10.7 10.9 11 11.1 11.3 11.4 11.5 11.7 11.8 11.9 12.1 12.2 12.3 12.4 12.6 12.7 12.8 13 13.1 13.2 13.4 13.5 13.6 13.8 13.9 14 14.1 14.3 14.4 14.5 14.7 14.8 14.9 15.1 15.2 15.3 15.5 15.6 15.7 15.9 16 16.1 16.2 16.4 16.5 16.6 16.8 16.9 17 17.2 17.3 17.4 17.6 17.7 17.8 17.9 18.1 18.2 18.3

calc =: {{
'stat blksz' =. y
+/ x (] * [ {.~ #@:]) stat ((]$~<.@:%) , |~) blksz
}}

NB. <= 1200
lo =: {{ <. mulsmall calc (y+1),50 }}
NB. >1200 <1210
mid =: {{ 3841 + >. 7.888 * y - 1200 }}
NB. >=1210
hi =: {{ (y e. 1643 1865) + 3912 + >. mullarge calc (y-1209),10 }}

score =: lo`mid`hi @. (1200 1209&I.)"0

*/

const mulsmall = [0.5, 0.8, 1, 1.3, 1.6, 1.8, 2.1, 2.4, 2.6, 2.8, 2.9, 3, 3.1, 3.3, 3.4, 3.5, 3.9, 4.1, 4.2, 4.3, 5.2, 5.5, 6.6, 6.8, 6.9];
const mullarge = [8, 8.1, 8.3, 8.4, 8.5, 8.6, 8.8, 8.9, 9, 9.2, 9.3, 9.4, 9.6, 9.7, 9.8, 10, 10.1, 10.2, 10.3, 10.5, 10.6, 10.7, 10.9, 11, 11.1, 11.3, 11.4, 11.5, 11.7, 11.8, 11.9, 12.1, 12.2, 12.3, 12.4, 12.6, 12.7, 12.8, 13, 13.1, 13.2, 13.4, 13.5, 13.6, 13.8, 13.9, 14, 14.1, 14.3, 14.4, 14.5, 14.7, 14.8, 14.9, 15.1, 15.2, 15.3, 15.5, 15.6, 15.7, 15.9, 16, 16.1, 16.2, 16.4, 16.5, 16.6, 16.8, 16.9, 17, 17.2, 17.3, 17.4, 17.6, 17.7, 17.8, 17.9, 18.1, 18.2, 18.3];

function calc(mul: number[], stat: number, blksz: number) {
	const n = Math.floor(stat / blksz);
	return Array.from({length: n+1}, (_,i) => i == n ? stat % blksz : blksz).map((x,i) => x * mul[i]).reduce((a,b) => a+b,0);
}

function lo(stat: number) {
	return Math.floor(calc(mulsmall, stat + 1, 50));
}

function mid(stat: number) {
	return 3841 + Math.ceil(7.888 * (stat - 1200));
}

const EXCEPTIONS = [1643, 1865];
function hi(stat: number) {
	return +(EXCEPTIONS.indexOf(stat) > -1) + 3912 + Math.ceil(calc(mullarge, stat - 1209, 10));
}

// TODO values > 2000
export function scoreForStat(stat: number) {
	if (stat < 1201) return lo(stat);
	else if (stat < 1210) return mid(stat);
	else return hi(stat);
}

// NB. aptitude order: short mile middle long nige senko sashi oikomi turf dirt
function aptIdx(tag: number) {
	if (tag >= 500 && tag < 600) return -1;/*7 + (tag - 500)*/ // turf and dirt skill score not actually affected by aptitude
	else if (tag >= 100 && tag < 200) return 3 + (tag - 100);  // strategy (101-104)
	else if (tag >= 200 && tag < 300) return -1 + (tag - 200); // distance (201-204)
	return -1;
}

// designed to match https://yonkim.azurewebsites.net/ and https://gamewith.jp/uma-musume/article/show/279309, but note that
// they occasionally disagree with each other by one point. for example さらなる高みへ with senkou = BC and middle = DEF
// scores as 156 here and yonkim and 157 on gamewith. i am not entirely sure what causes that.
const AptitudeMultiplier = Object.freeze({'S':1.1,'A':1.1,'B':0.9,'C':0.9,'D':0.8,'E':0.8,'F':0.8,'G':0.7} as const);
export function scoreForSkill(skillid: string, aptitudes: (keyof typeof AptitudeMultiplier)[10]) {
	const sk = skillmeta[skillid];
	const tg = Object.groupBy(sk.tags, t => Math.floor(t / 100))
	let aptCoef = Object.values(tg).map(g => g.reduce((acc,t) => {
		const idx = aptIdx(t);
		return idx == -1 ? 1 : Math.max(acc, AptitudeMultiplier[aptitudes[idx]]);
	}, 0)).reduce((a,b) => a * b);
	return Math.round(sk.score * aptCoef);
}

export function scoreUma(uma: HorseState) {
	// uniques have a grade_value score in the db for some reason but don't count toward score
	const uid = uniqueSkillForUma(uma.outfitId, uma.starCount);
	return (120 + 50 * +(uma.starCount > 2)) * uma.uniqueLv +
		scoreForStat(uma.speed) + scoreForStat(uma.stamina) + scoreForStat(uma.power) +
		scoreForStat(uma.guts) + scoreForStat(uma.wisdom) +
		Array.from(uma.skills.values()).reduce((acc,id) => id == uid ? acc : acc + scoreForSkill(id, uma.aptitudes), 0);
}

// TODO can we find some formula that generates this? it's almost regular but not quite.
export const RankThresholds = Object.freeze([
	300, 600, 900, 1300, 1800, 2300, 2900, 3500, 4900, 6500, 8200, 10000, 12100, 14500, 15900, 17500, 19200, 19600, 20000,
	20400, 20800, 21200, 21600, 22100, 22500, 23000, 23400, 23900, 24300, 24800, 25300, 25800, 26300, 26800, 27300, 27800,
	28300, 28800, 29400, 29900, 30400, 31000, 31500, 32100, 32700, 33200, 33800, 34400, 35000, 35600, 36200, 36800, 37500,
	38100, 38700, 39400, 40000, 40700, 41300, 42000, 42700, 43400, 44000, 44700, 45400, 46200, 46900, 47600, 48300, 49000,
	49800, 50500, 51300, 52000, 52800, 53600, 54400, 55200, 55900, 56700, 57500, 58400, 59200, 60000, 60800, 61700, 62500,
	63400, 64200, 65100, 66400, 67700, 69000, 70300, 71600, 72900, 74400, 76000, 76600, 77200, 77800, 78500, 79100, 79700,
	80400, 81000, 81700, 82300, 83000, 83600, 84300, 84900, 85600, 86200, 86700, 87300, 87900, 88500, 89100, 89700, 90300,
	90900, 91400, 92000, 92600, 93200, 93800, 94400, 95000, 95600, 96300, 96900, 97500, 98000, 98500, 99000, 99600, 100100,
	100600, 101100, 101700, 102200, 102700, 103200, 103800, 104300, 104800, 105400, 105900, 106400, 106900, 107500, 108000,
	108500, 109100, 109600, 110100, 110700, 111200, 111800, 112300, 112800, 113400, 113900, 114400, 115000, 115500, 116100,
	116600, 117100, 117700, 118200, 118800, 119300, 119900, 120400, 121000, 121500, 122000, 122600, 123100, 123700, 124200,
	124800, 125300, 125900, 126400, 127000, 127500, 128100, 128700, 129200, 129800, 130300, 130900, 131400, 132000, 132500,
	133100, 133700, 134200, 134800, 135300, 135900, 136500, 137000, 137600, 138100, 138700, 139300, 139800, 140400, 141000,
	141500, 142100, 142700, 143200, 143800, 144400, 144900, 145500, 146100, 146600, 147200, 147800, 148400, 148900, 149500,
	150100, 150700, 151200, 151800, 152400, 153000, 153500, 154100, 154700, 155300, 155900, 156400, 157000, 157600, 158200,
	158800, 159300, 159900, 160500, 161100, 161700, 162300, 162900, 163400, 164000, 164600, 165200, 165800, 166400, 167000,
	167600, 168200, 168700, 169300, 169900, 170500, 171100, 171700, 172300, 172900, 173500, 174100, 174700, 175300, 175900,
	176500, 177100, 177700, 178300, 178900, 179500, 180100, 180700, 181300, 181900, 182500, 183100, 183700, 184300, 184900,
	185500, 186200, 186800, 187400, 188000, 188600, 189200, 189800, 190400, Infinity
]);
