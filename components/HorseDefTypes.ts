import { Record } from 'immutable';
import { SortedSet } from 'immutable-sorted';

import skill_meta from '../skill_meta.json';

function skillmeta(id: string) {
	// handle the fake skills (e.g., variations of Sirius unique) inserted by make_skill_data with ids like 100701-1
	return skill_meta[id.split('-')[0]];
}

function skillComparator(a, b) {
	const x = skillmeta(a).order, y = skillmeta(b).order;
	return +(y < x) - +(x < y) || +(b < a) - +(a < b);
}

export function SkillSet(iterable): SortedSet<keyof typeof skills> {
	return SortedSet(iterable, skillComparator);
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

const CANON_SCHEME_VERSION: [number, number, number] = [0, 0, 0];

export const {
	canonicalize_horse_state, horse_state_from_canonical,
	from_base64url, into_base64url,
	from_base64url_horse_state,
	..._rest
} = (() => {

	const STRATEGY_MAP = {
		nige: 'Nige',
		senkou: 'Senkou',
		sasi: 'Sasi',
		oikomi: 'Oikomi',

		'runner': 'Nige',
		'pace chaser': 'Senkou',
		'betweener': 'Sasi',
		'chaser': 'Oikomi',
	} as const;

	const enum CanonStratType {
		ENUM = 0,
		STR = 1,
	}
	const strat_ord = [
		'Nige', 'Senkou', 'Sasi', 'Oikomi',
	] as const;
	const strat_to_canon = (strat: StratValue) => {
		if(strat_ord.includes(strat)) {
			return [CanonStratType.ENUM, strat_ord.indexOf(strat)];
		}
		return [CanonStratType.STR, strat];
	};
	const canon_strat_to_str = (canon_strat: [number, number]) => {
		const [type, val] = canon_strat;
		if(type === CanonStratType.ENUM) {
			return strat_ord[val] as unknown as StratValue;
		}
		return val as unknown as StratValue;
	};

	const APITUDES_MAP = {
		s: 'S', a: 'A', b: 'B',
		c: 'C', d: 'D',
		e: 'E', f: 'F', g: 'G',
	} as const;
	const enum CanonApitudeType {
		ENUM = 0,
		STR = 1,
	}
	const apitude_ord = [
		'S', 'A', 'B', 'C', 'D', 'E', 'F', 'G',
	] as const;
	const apitude_to_canon = (apitude: APT) => {
		const apitude_str = APITUDES_MAP[apitude];
		if(apitude_ord.includes(apitude_str)) {
			return [CanonApitudeType.ENUM, apitude_ord.indexOf(apitude_str)];
		}
		return [CanonApitudeType.STR, apitude_str];
	}
	const canon_apitude_to_str = (canon_apitude: [number, number]) => {
		const [type, val] = canon_apitude;
		if(type === CanonApitudeType.ENUM) {
			return apitude_ord[val] as unknown as APT;
		}
		return val as unknown as APT;
	}

	type APT = keyof typeof APITUDES_MAP;
	type StratValue = typeof STRATEGY_MAP[keyof typeof STRATEGY_MAP];

	function canonicalize_horse_state(state: HorseState) {
		const {
			strategy, outfitId, skills, 
			speed, stamina, power, guts, wisdom, 
			distanceAptitude, surfaceAptitude, strategyAptitude, 
			...rest
		} = state.toJS();
		if(Object.keys(rest).length > 0) {
			console.error('canonicalize_horse_state ignoring canon some fields', {rest});
		}
		const canon_strategy = (
			strategy? STRATEGY_MAP[strategy.toLowerCase()] : 'Senkou'
		) as StratValue;
		const stats = [
			speed, stamina, power, guts, wisdom
		] as const;
		const skill_arr = SortedSet(skills, skillComparator).toArray();

		const apitudes = (
			([distanceAptitude, surfaceAptitude, strategyAptitude] as const)
			.map(x => apitude_to_canon(x.toLowerCase() as APT))
		);
		function numarray_like(x: string, delim: string='-'): string | number[]{
			const nums = x.split(delim).map(Number);
			if(nums.some(isNaN)) {
				return x;
			}
			return nums;
		}
		const tryOutfitNum = (() => {
			if(typeof outfitId !== 'string') {
				if(outfitId === undefined || outfitId === null) {
					return null;
				}
				return outfitId;
			}
			if(!outfitId) {
				return null;
			}
			return numarray_like(outfitId);
		})();

		const trySkills = (() => {
			const skills_as_nums = skill_arr.map(e => {
				if(typeof e !== 'string') {
					return e;
				}
				return numarray_like(e);
			});
			return skills_as_nums as (number[] | string | unknown)[];
		})();
		return {
			// policy: major bumps fail, minor bumps throw warnings to user,
			// fix/hotfix bumps are logged perhaps via console.warning
			version: CANON_SCHEME_VERSION,
			outfit: tryOutfitNum,
			strat: strat_to_canon(canon_strategy),
			stats,
			skills: trySkills,
			apt:apitudes,
		}
	}

	function horse_state_from_canonical(
		canon: AssumedCanonHorseState, 
		on_info: (info: string) => Promise<void>,
		on_warning: (warning: string) => Promise<void>,
		on_error: (error: string) => Promise<void>,
	): HorseState | undefined {
		const background_jobs: Array<Promise<any>> = [];
		if (canon.version === undefined) {
			on_warning(
				`scheme_version is undefined, optimistically serializing ${CANON_SCHEME_VERSION}`
			);
		} else {
			const [major, minor, patch] = canon.version as AssumedCanonHorseState['version'];
			if (major !== CANON_SCHEME_VERSION[0]) {
				background_jobs.push(
					on_error(`scheme_version mismatch: ${major} !== ${CANON_SCHEME_VERSION[0]}`)
				);
				// NB: background jobs are properly "detached" based on JS engine.
				return undefined;
			}
			if (minor !== CANON_SCHEME_VERSION[1]) {
				background_jobs.push(
					on_warning(`scheme_version mismatch: ${minor} !== ${CANON_SCHEME_VERSION[1]}`)
				);
			}
			if (patch !== CANON_SCHEME_VERSION[2]) {
				background_jobs.push(
					on_info(`scheme_version mismatch: ${patch} !== ${CANON_SCHEME_VERSION[2]}`)
				);
			}
		}

		const strategy = canon_strat_to_str(canon.strat as [number, number]);
		if (strategy === undefined) {
			background_jobs.push(
				on_error(`strategy not found: ${canon.strat}`)
			);
			return undefined;
		}

		const stats = canon.stats as [number, number, number, number, number];
		const [speed, stamina, power, guts, wisdom] = stats;
		const skills = canon.skills as (number[] | string | unknown)[];
		const [distanceAptitude, surfaceAptitude, strategyAptitude] = (canon.apt).map(canon_apitude_to_str);
		const outfitId = canon.outfit as string | number[];
		const decodeOutfitId = (() => {
			if(Array.isArray(outfitId)) {
				return outfitId.map(String).join('-');
			}
			if(typeof outfitId !== 'string') {
				if(outfitId === undefined || outfitId === null) {
					return null;
				}
				on_error(`outfitId is not a string: ${outfitId}`);
				return undefined;
			}
			return outfitId;
		})();
		if (decodeOutfitId === undefined) {
			return undefined;
		}
		const horse = {
			outfitId: decodeOutfitId??"",
			strategy,
			speed, stamina, power, guts, wisdom,
			distanceAptitude, surfaceAptitude, strategyAptitude,
		};
		const skills_as_strs = skills.map(e => {
			if(Array.isArray(e)) {
				return e.map(String).join('-');
			}
			return e as SkillId;
		});
		return new HorseState(horse).set('skills', SkillSet(skills_as_strs));
	}

	async function into_base64url(canon: globalThis.Record<string, unknown>) {
		/*const encoded = msgpack.encode(canon)*/
		const encoded = new TextEncoder().encode(JSON.stringify(canon));

		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(encoded);
				controller.close();
			}
		});
		const gzipReader = stream.pipeThrough(new CompressionStream('gzip')).getReader();
		let buf = new Uint8Array();
		while (true) {
			const readResult = await gzipReader.read();
			if(readResult && readResult.done) {
				break;
			}
			buf = new Uint8Array([...buf, ...readResult.value]);
		}
		const base64 = btoa(String.fromCharCode(...buf));
		const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		return base64url;
	}
	async function from_base64url(base64url: string) {
		// Convert base64url to base64
		const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
		// Add padding if needed
		const padded = base64 + '==='.slice((base64.length + 3) % 4);
		
		// Convert base64 to binary string
		const binaryString = atob(padded);
		
		// Convert binary string to Uint8Array
		const gzippedData = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			gzippedData[i] = binaryString.charCodeAt(i);
		}
		
		// Decompress gzip
		const ungzippedReader = (new ReadableStream({
			start(controller) {
				controller.enqueue(gzippedData);
				controller.close();
			}
		})).pipeThrough(new DecompressionStream('gzip')).getReader();
		
		let chunks = new Array<Uint8Array>();
		while (true) {
			const readResult = await ungzippedReader.read();
			if(readResult && readResult.done) {
				break;
			}
			chunks.push(readResult.value);
		}
		
		// Combine all chunks into one Uint8Array
		const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
		const combined = new Uint8Array(totalLength);
		let offset = 0;
		for (const chunk of chunks) {
			combined.set(chunk, offset);
			offset += chunk.length;
		}
		
		const canon = (
			/*msgpack.decode(combined)*/
			(JSON.parse((new TextDecoder()).decode(combined)))
		) as globalThis.Record<string, unknown>;
		return canon;
	}

	async function from_base64url_horse_state(base64url: string) {
		const canon = await from_base64url(base64url);
		return horse_state_from_canonical(
			canon, 
			async (info: string) => {console.log(info);},
			async (warning: string) => {console.log(warning);},
			async (error: string) => {console.log(error);},
		);
	}
	return {canonicalize_horse_state, horse_state_from_canonical, into_base64url, from_base64url, from_base64url_horse_state};
})();

export type AssumedCanonHorseState = ReturnType<typeof canonicalize_horse_state>;
