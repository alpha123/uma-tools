import { CourseData } from '../uma-skill-tools/CourseData';
import { Region, RegionList } from '../uma-skill-tools/Region';
import { RaceParameters } from '../uma-skill-tools/RaceParameters';
import { RaceSolver } from '../uma-skill-tools/RaceSolver';
import { RaceSolverBuilder, Perspective } from '../uma-skill-tools/RaceSolverBuilder';
import type { GameHpPolicy } from '../uma-skill-tools/HpPolicy';
import { Rule30CARng } from '../uma-skill-tools/Random';
import { ActivationSamplePolicy, ImmediatePolicy, RandomPolicy, LogNormalRandomPolicy, ErlangRandomPolicy, StraightRandomPolicy, AllCornerRandomPolicy } from '../uma-skill-tools/ActivationSamplePolicy';

import { HorseState, SamplePolicyDesc, uniqueSkillForUma } from '../components/HorseDefTypes';

import skillmeta from '../skill_meta.json';

class FixedDistancePolicy {
	constructor(readonly pos: number) {}
	sample(_0: RegionList, nsamples: number, _1: PRNG) { return Array.from({length: nsamples}, _ => new Region(this.pos, this.pos + 10)); }

	// these should never be called because this policy is only used as an override and never reconciled with anything
	reconcile(other: ActivationSamplePolicy) { console.assert(false); }
	reconcileImmediate(other: ActivationSamplePolicy) { console.assert(false); }
	reconcileDistributionRandom(other: ActivationSamplePolicy) { console.assert(false); }
	reconcileRandom(other: ActivationSamplePolicy) { console.assert(false); }
	reconcileStraightRandom(other: ActivationSamplePolicy) { console.assert(false); }
	reconcileAllCornerRandom(other: ActivationSamplePolicy) { console.assert(false); }
}

export function instantiateSamplePolicy(desc: SamplePolicyDesc | undefined): ActivationSamplePolicy | undefined {
	if (desc == null) return undefined;
	switch (desc.policy) {
		case 'immediate': return ImmediatePolicy;
		case 'random': return RandomPolicy;
		case 'straight-random': return StraightRandomPolicy;
		case 'all-corner-random': return AllCornerRandomPolicy;
		case 'log-normal': return new LogNormalRandomPolicy(desc.mu, desc.sigma);
		case 'erlang': return new ErlangRandomPolicy(desc.k, desc.lambda);
		case 'fixed': return new FixedDistancePolicy(desc.pos);
	}
}

export function getActivator(selfSet: Map<string, [number,number]>, otherSet: Map<String, [number,number]> | null) {
	return function (s, id, persp) {
		const skillSet = persp == Perspective.Self ? selfSet : otherSet;
		if (id == 'downhill') {
			if (!skillSet.has('downhill')) skillSet.set('downhill', 0);
			skillSet.set('downhill', skillSet.get('downhill') - s.accumulatetime.t);
		} else if (skillSet != null && id != 'asitame' && id != 'staminasyoubu') {
			if (!skillSet.has(id)) skillSet.set(id, []);
			skillSet.get(id).push([s.pos, -1]);
		}
	};
}
export function getDeactivator(selfSet: Map<string, [number,number]>, otherSet: Map<String, [number,number]> | null, course) {
	return function (s, id, persp) {
		const skillSet = persp == Perspective.Self ? selfSet : otherSet;
		if (id == 'downhill') {
			skillSet.set('downhill', skillSet.get('downhill') + s.accumulatetime.t);
		} else if (skillSet != null && id != 'asitame' && id != 'staminasyoubu') {
			const ar = skillSet.get(id);  // activation record
			// in the case of adding multiple copies of speed debuffs a skill can activate again before the first
			// activation has finished (as each copy has the same ID), so we can't just access a specific index
			// (-1).
			// assume that multiple activations of a skill always deactivate in the same order (probably true?) so
			// just seach for the first record that hasn't had its deactivation location filled out yet.
			const r = ar.find(x => x[1] == -1);
			// onSkillDeactivate gets called twice for skills that have both speed and accel components, so the end
			// position could already have been filled out and r will be undefined
			if (r != null) r[1] = Math.min(s.pos, course.distance);
		}
	};
}

export function runComparison(nsamples: number, course: CourseData, racedef: RaceParameters, uma1: HorseState, uma2: HorseState, seed: [number,number], options) {
	const standard = new RaceSolverBuilder(nsamples)
		.seed(...seed)
		.course(course)
		.ground(racedef.groundCondition)
		.weather(racedef.weather)
		.season(racedef.season)
		.time(racedef.time);
	if (racedef.orderRange != null) {
		standard
			.order(racedef.orderRange[0], racedef.orderRange[1])
			.numUmas(racedef.numUmas);
	}
	const compare = standard.fork();
	standard.horse(uma1).otherHorse(uma2);
	compare.horse(uma2).otherHorse(uma1);
	const wisdomSeeds = new Map<string, [number,number]>();
	const wisdomRng = new Rule30CARng(...seed);
	for (let i = 0; i < 20; ++i) wisdomRng.pair();   // advance the RNG state a bit because we only seeded the low bits
	// ensure skills common to the two umas are added in the same order regardless of what additional skills they have
	// this is important to make sure the rng for their activations is synced
	// sort first by groupId so that white and gold versions of a skill get added in the same order
	const common = Array.from(new Set(uma1.skills.keys()).intersection(new Set(uma2.skills.keys()))).sort((a,b) => +a - +b);
	const commonIdx = (id) => { let i = common.indexOf(skillmeta[id].groupId); return i > -1 ? i : common.length; };
	const sort = (a,b) => commonIdx(a) - commonIdx(b) || +a - +b;
	const u1id = uniqueSkillForUma(uma1.outfitId, uma1.starCount);
	const u2id = uniqueSkillForUma(uma2.outfitId, uma2.starCount);
	Array.from(uma1.skills.values()).sort(sort).forEach(id => {
		wisdomSeeds.set(id, wisdomRng.pair());
		standard.addSkill(id, Perspective.Self, id == u1id ? uma1.uniqueLv : 1, instantiateSamplePolicy(uma1.samplePolicies.get(id)));
	});
	Array.from(uma2.skills.values()).sort(sort).forEach(id => {
		// this means that the second set of rolls 'wins' for skills on both, but this doesn't actually matter
		wisdomSeeds.set(id, wisdomRng.pair());
		compare.addSkill(id, Perspective.Self, id == u2id ? uma2.uniqueLv : 1, instantiateSamplePolicy(uma2.samplePolicies.get(id)));
	});
	// iterating twice like this is VERY ANNOYING
	// unfortunately, because we add every skill to both umas, if we add them in the same iteration uma2 will have all the
	// Other skills before its Self skills, which can cause skill desync issues when there are debuffs
	// TODO i don't really like this, this might just be masking some deeper underlying issue.
	uma1.skills.forEach(id => compare.addSkill(id, Perspective.Other, id == u1id ? uma1.uniqueLv : 1, instantiateSamplePolicy(uma1.samplePolicies.get(id))));
	uma2.skills.forEach(id => standard.addSkill(id, Perspective.Other, id == u2id ? uma2.uniqueLv : 1, instantiateSamplePolicy(uma2.samplePolicies.get(id))));
	if (!CC_GLOBAL) {
		standard.withAsiwotameru().withStaminaSyoubu();
		compare.withAsiwotameru().withStaminaSyoubu();
	}
	if (options.usePosKeep) {
		standard.useDefaultPacer(); compare.useDefaultPacer();
	}
	if (options.useIntChecks) {
		standard.withWisdomChecks(wisdomSeeds);
		compare.withWisdomChecks(wisdomSeeds);
	}
	const skillPos1 = new Map(), skillPos2 = new Map();
	standard.onSkillActivate(getActivator(skillPos1, null));
	standard.onSkillDeactivate(getDeactivator(skillPos1, null, course));
	compare.onSkillActivate(getActivator(skillPos2, null));
	compare.onSkillDeactivate(getDeactivator(skillPos2, null, course));
	let a = standard.build(), b = compare.build();
	let ai = 1, bi = 0;
	let sign = 1;
	const diff = [];
	let min = Infinity, max = -Infinity, estMean, estMedian, bestMeanDiff = Infinity, bestMedianDiff = Infinity;
	let minrun, maxrun, meanrun, medianrun;
	let nspurt = [0,0];
	const sampleCutoff = Math.max(Math.floor(nsamples * 0.8), nsamples - 200);
	let retry = false;
	for (let i = 0; i < nsamples; ++i) {
		const s1 = a.next(retry).value as RaceSolver;
		const s2 = b.next(retry).value as RaceSolver;
		const data = {t: [[], []], p: [[], []], v: [[], []], hp: [[], []], sk: [null,null], sdly: [0,0], dh: [0,0]};

		while (s2.pos < course.distance) {
			s2.step(1/15);
			data.t[ai].push(s2.accumulatetime.t);
			data.p[ai].push(s2.pos);
			data.v[ai].push(s2.currentSpeed + (s2.modifiers.currentSpeed.acc + s2.modifiers.currentSpeed.err));
			data.hp[ai].push((s2.hp as GameHpPolicy).hp);
		}
		data.sdly[ai] = s2.startDelay;

		while (s1.accumulatetime.t < s2.accumulatetime.t) {
			s1.step(1/15);
			data.t[bi].push(s1.accumulatetime.t);
			data.p[bi].push(s1.pos);
			data.v[bi].push(s1.currentSpeed + (s1.modifiers.currentSpeed.acc + s1.modifiers.currentSpeed.err));
			data.hp[bi].push((s1.hp as GameHpPolicy).hp);
		}
		// run the rest of the way to have data for the chart
		const pos1 = s1.pos;
		while (s1.pos < course.distance) {
			s1.step(1/15);
			data.t[bi].push(s1.accumulatetime.t);
			data.p[bi].push(s1.pos);
			data.v[bi].push(s1.currentSpeed + (s1.modifiers.currentSpeed.acc + s1.modifiers.currentSpeed.err));
			data.hp[bi].push((s1.hp as GameHpPolicy).hp);
		}
		data.sdly[bi] = s1.startDelay;

		s2.cleanup();
		s1.cleanup();

		data.dh[1] = skillPos2.get('downhill') || 0; skillPos2.delete('downhill');
		data.dh[0] = skillPos1.get('downhill') || 0; skillPos1.delete('downhill');
		data.sk[1] = new Map(skillPos2);  // NOT ai (NB. why not?)
		skillPos2.clear();
		data.sk[0] = new Map(skillPos1);  // NOT bi (NB. why not?)
		skillPos1.clear();

		// if `standard` is faster than `compare` then the former ends up going past the course distance
		// this is not in itself a problem, but it would overestimate the difference if for example a skill
		// continues past the end of the course. i feel like there are probably some other situations where it would
		// be inaccurate also. if this happens we have to swap them around and run it again.
		if (s2.pos < pos1 || isNaN(pos1)) {
			[b,a] = [a,b];
			[bi,ai] = [ai,bi];
			sign *= -1;
			--i;  // this one didnt count
			retry = true;
		} else {
			retry = false;
			nspurt[bi] += +(s1.isLastSpurt && s1.lastSpurtTransition == -1);
			nspurt[ai] += +(s2.isLastSpurt && s2.lastSpurtTransition == -1);
			const basinn = sign * (s2.pos - pos1) / 2.5;
			diff.push(basinn);
			if (basinn < min) {
				min = basinn;
				minrun = data;
			}
			if (basinn > max) {
				max = basinn;
				maxrun = data;
			}
			if (i == sampleCutoff) {
				diff.sort((a,b) => a - b);
				estMean = diff.reduce((a,b) => a + b) / diff.length;
				const mid = Math.floor(diff.length / 2);
				estMedian = mid > 0 && diff.length % 2 == 0 ? (diff[mid-1] + diff[mid]) / 2 : diff[mid];
			}
			if (i >= sampleCutoff) {
				const meanDiff = Math.abs(basinn - estMean), medianDiff = Math.abs(basinn - estMedian);
				if (meanDiff < bestMeanDiff) {
					bestMeanDiff = meanDiff;
					meanrun = data;
				}
				if (medianDiff < bestMedianDiff) {
					bestMedianDiff = medianDiff;
					medianrun = data;
				}
			}
		}
	}
	diff.sort((a,b) => a - b);
	return {results: diff, runData: {nspurt, minrun, maxrun, meanrun, medianrun}};
}
