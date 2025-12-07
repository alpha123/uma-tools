import { CourseData } from '../uma-skill-tools/CourseData';
import { RaceParameters } from '../uma-skill-tools/RaceParameters';
import { RaceSolver } from '../uma-skill-tools/RaceSolver';
import { RaceSolverBuilder, Perspective } from '../uma-skill-tools/RaceSolverBuilder';
import { Rule30CARng } from '../uma-skill-tools/Random';

import { HorseState } from '../components/HorseDefTypes';

import skillmeta from '../skill_meta.json';

export function runComparison(nsamples: number, course: CourseData, racedef: RaceParameters, uma1: HorseState, uma2: HorseState, options) {
	const standard = new RaceSolverBuilder(nsamples)
		.seed(options.seed)
		.course(course)
		.mood(racedef.mood)
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
	const uma1_ = uma1.update('skills', sk => Array.from(sk.values())).toJS();
	const uma2_ = uma2.update('skills', sk => Array.from(sk.values())).toJS();
	standard.horse(uma1_);
	compare.horse(uma2_);
	const wisdomRolls = new Map();
	const wisdomRng = new Rule30CARng(options.seed);
	for (let i = 0; i < 20; ++i) wisdomRng.pair();   // advance the RNG state a bit because we only seeded the low bits
	// ensure skills common to the two umas are added in the same order regardless of what additional skills they have
	// this is important to make sure the rng for their activations is synced
	// sort first by groupId so that white and gold versions of a skill get added in the same order
	const common = uma1.skills.keySeq().toSet().intersect(uma2.skills.keySeq().toSet()).toArray().sort((a,b) => +a - +b);
	const commonIdx = (id) => { let i = common.indexOf(skillmeta[id].groupId); return i > -1 ? i : common.length; };
	const sort = (a,b) => commonIdx(a) - commonIdx(b) || +a - +b;
	uma1_.skills.sort(sort).forEach(id => {
		wisdomRolls.set(id, wisdomRng.random());
		standard.addSkill(id, Perspective.Self);
		compare.addSkill(id, Perspective.Other);
	});
	uma2_.skills.sort(sort).forEach(id => {
		// this means that the second set of rolls 'wins' for skills on both, but this doesn't actually matter
		wisdomRolls.set(id, wisdomRng.random());
		compare.addSkill(id, Perspective.Self);
		standard.addSkill(id, Perspective.Other);
	});
	if (!CC_GLOBAL) {
		standard.withAsiwotameru().withStaminaSyoubu();
		compare.withAsiwotameru().withStaminaSyoubu();
	}
	if (options.usePosKeep) {
		standard.useDefaultPacer(); compare.useDefaultPacer();
	}
	if (options.useIntChecks) {
		standard.withWisdomChecks(wisdomRolls);
		compare.withWisdomChecks(wisdomRolls);
	}
	const skillPos1 = new Map(), skillPos2 = new Map();
	function getActivator(skillSet) {
		return function (s, id, persp) {
			if (id == 'downhill') {
				if (!skillSet.has('downhill')) skillSet.set('downhill', 0);
				skillSet.set('downhill', skillSet.get('downhill') - s.accumulatetime.t);
			} else if (persp == Perspective.Self && id != 'asitame' && id != 'staminasyoubu') {
				if (!skillSet.has(id)) skillSet.set(id, []);
				skillSet.get(id).push([s.pos, -1]);
			}
		};
	}
	function getDeactivator(skillSet) {
		return function (s, id, persp) {
			if (id == 'downhill') {
				skillSet.set('downhill', skillSet.get('downhill') + s.accumulatetime.t);
			} else if (persp == Perspective.Self && id != 'asitame' && id != 'staminasyoubu') {
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
	standard.onSkillActivate(getActivator(skillPos1));
	standard.onSkillDeactivate(getDeactivator(skillPos1));
	compare.onSkillActivate(getActivator(skillPos2));
	compare.onSkillDeactivate(getDeactivator(skillPos2));
	let a = standard.build(), b = compare.build();
	let ai = 1, bi = 0;
	let sign = 1;
	const diff = [];
	let min = Infinity, max = -Infinity, estMean, estMedian, bestMeanDiff = Infinity, bestMedianDiff = Infinity;
	let minrun, maxrun, meanrun, medianrun;
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
	return {results: diff, runData: {minrun, maxrun, meanrun, medianrun}};
}
