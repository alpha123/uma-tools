import { CourseData } from '../uma-skill-tools/CourseData';
import { RaceParameters } from '../uma-skill-tools/RaceParameters';
import { RaceSolver } from '../uma-skill-tools/RaceSolver';
import { RaceSolverBuilder, Perspective } from '../uma-skill-tools/RaceSolverBuilder';

import { HorseState } from '../components/HorseDefTypes';

export function runComparison(nsamples: number, course: CourseData, racedef: RaceParameters, uma1: HorseState, uma2: HorseState, options) {
	const standard = new RaceSolverBuilder(nsamples)
		.seed(options.seed)
		.course(course)
		.mood(racedef.mood)
		.guaranteeSkillActivation(options.guaranteeSkillActivation)
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
	standard.horse(uma1.toJS());
	compare.horse(uma2.toJS());
	// ensure skills common to the two umas are added in the same order regardless of what additional skills they have
	// this is important to make sure the rng for their activations is synced
	const common = uma1.skills.intersect(uma2.skills).toArray().sort((a,b) => +a - +b);
	const commonIdx = (id) => { let i = common.indexOf(id); return i > -1 ? i : common.length; };
	const sort = (a,b) => commonIdx(a) - commonIdx(b) || +a - +b;
	uma1.skills.toArray().sort(sort).forEach(id => {
		standard.addSkill(id.split('-')[0], Perspective.Self);
		compare.addSkill(id.split('-')[0], Perspective.Other);
	});
	uma2.skills.toArray().sort(sort).forEach(id => {
		compare.addSkill(id.split('-')[0], Perspective.Self);
		standard.addSkill(id.split('-')[0], Perspective.Other);
	});
	if (!CC_GLOBAL) {
		standard.withAsiwotameru().withStaminaSyoubu();
		compare.withAsiwotameru().withStaminaSyoubu();
	}
	if (options.usePosKeep) {
		standard.useDefaultPacer(); compare.useDefaultPacer();
	}
	const skillPos1 = new Map(), skillPos2 = new Map();
	function getActivator(selfSet, otherSet) {
		return function (s, id, persp) {
			const skillSet = persp == Perspective.Self ? selfSet : otherSet;
			if (id != 'asitame' && id != 'staminasyoubu') {
				if (!skillSet.has(id)) skillSet.set(id, []);
				skillSet.get(id).push([s.pos, 0]);
			}
		};
	}
	function getDeactivator(selfSet, otherSet) {
		return function (s, id, persp) {
			const skillSet = persp == Perspective.Self ? selfSet : otherSet;
			if (id != 'asitame' && id != 'staminasyoubu') {
				const ar = skillSet.get(id);  // activation record
				// assume the first activation of a skill ends before the second one starts
				// don't think there's any way around this but it should always be true
				ar[ar.length-1][1] = Math.min(s.pos, course.distance);
			}
		};
	}
	standard.onSkillActivate(getActivator(skillPos1, skillPos2));
	standard.onSkillDeactivate(getDeactivator(skillPos1, skillPos2));
	compare.onSkillActivate(getActivator(skillPos2, skillPos1));
	compare.onSkillDeactivate(getDeactivator(skillPos2, skillPos1));
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
		const data = {t: [[], []], p: [[], []], v: [[], []], hp: [[], []], sk: [null,null], sdly: [0,0]};

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
