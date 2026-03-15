import { CourseData, CourseHelpers } from '../uma-skill-tools/CourseData';
import type { HorseParameters } from '../uma-skill-tools/HorseTypes';
import type { RaceParameters, GroundCondition } from '../uma-skill-tools/RaceParameters';
import { RaceSolver, RaceState } from '../uma-skill-tools/RaceSolver';
import { RaceSolverBuilder, Perspective } from '../uma-skill-tools/RaceSolverBuilder';
import { GameHpPolicy } from '../uma-skill-tools/HpPolicy';
import { PRNG, Rule30CARng } from '../uma-skill-tools/Random';

import { HorseState, SamplePolicyDesc } from '../components/HorseDefTypes';

import { instantiateSamplePolicy, getActivator, getDeactivator } from './compare';

class ForceFullSpurtHpPolicy {
	wrapped: GameHpPolicy
	balance: number
	wasFullSpurt: boolean
	downhillSave: number

	constructor(readonly forceSpurt: boolean, course: CourseData, ground: GroundCondition, rng: PRNG) {
		this.wrapped = new GameHpPolicy(course, ground, rng);
		this.balance = NaN;
		this.wasFullSpurt = false;
		this.downhillSave = 0;
	}

	get hp() { return this.wrapped.hp; }
	get finalHp() { return this.forceSpurt ? Math.min(this.balance, this.wrapped.hp) : this.wrapped.hp; }

	init(horse: HorseParameters) { this.wrapped.init(horse); }
	tick(state: RaceState, dt: number) {
		if (state.isDownhillMode) {
			this.downhillSave += this.wrapped.hpPerSecond({...state, isDownhillMode: false}, state.currentSpeed) * dt -
				this.wrapped.hpPerSecond(state, state.currentSpeed) * dt;
		}
		this.wrapped.tick(state, dt);
	}
	remainingHp() { return this.wrapped.remainingHp(); }
	hpRatioRemaining() { return this.wrapped.hpRatioRemaining(); }
	recover(modifier: number) { this.wrapped.recover(modifier); }

	getLastSpurtPair(state: RaceState, maxSpeed: number, bts2: number) {
		const maxDist = this.wrapped.distance - CourseHelpers.phaseStart(this.wrapped.distance, 2);
		const s = (maxDist - 60) / maxSpeed;
		const lastleg = {phase: 2 as Phase, isPaceDown: false, isDownhillMode: false, isKakari: false};
		this.balance = this.wrapped.hp - this.wrapped.hpPerSecond(lastleg, maxSpeed) * s;
		this.wasFullSpurt = this.balance >= 0;
		if (this.forceSpurt) {
			return [-1, maxSpeed];
		} else {
			return this.wrapped.getLastSpurtPair(state, maxSpeed, bts2);
		}
	}
}

class CalcRequiredHpPolicy {
	wrapped: GameHpPolicy

	constructor(course: CourseData, ground: GroundCondition, rng: PRNG) {
		this.wrapped = new GameHpPolicy(course, ground, rng);
	}

	get hpUsed() { return -this.wrapped.hp; }

	init(horse: HorseParameters) {
		this.wrapped.init(horse);
		this.wrapped.hp = 0;
	}
	tick(state: RaceState, dt: number) { this.wrapped.tick(state, dt); }
	remainingHp() { return this.wrapped.maxHp; }
	hpRatioRemaining() { return 1.0; }
	recover(modifier: number) { this.wrapped.recover(modifier); }

	getLastSpurtPair(_0: RaceState, maxSpeed: number, _1: number) {
		const maxDist = this.wrapped.distance - CourseHelpers.phaseStart(this.wrapped.distance, 2);
		const s = (maxDist - 60) / maxSpeed;
		const lastleg = {phase: 2 as Phase, isPaceDown: false, isDownhillMode: false, isKakari: false};
		this.wrapped.hp -= this.wrapped.hpPerSecond(lastleg, maxSpeed) * s;
		return [-1, maxSpeed];
	}
}

export function runHpCalc(nsamples: number, course: CourseData, racedef: RaceParamters, uma: HorseState, seed: [number,number], options) {
	const b0 = new RaceSolverBuilder(nsamples)
		.seed(...seed)
		.course(course)
		.mood(racedef.mood)
		.ground(racedef.groundCondition)
		.weather(racedef.weather)
		.season(racedef.season)
		.time(racedef.time)
		.horse(uma)
		.mood(uma.mood)
		.popularity(uma.popularity);
	if (racedef.orderRange != null) {
		b0
			.order(racedef.orderRange[0], racedef.orderRange[1])
			.numUmas(racedef.numUmas);
	}
	const wisdomSeeds = new Map<string, [number,number]>();
	const wisdomRng = new Rule30CARng(...seed);
	for (let i = 0; i < 20; ++i) wisdomRng.pair();
	Array.from(uma.skills.values()).forEach(id => {
		wisdomSeeds.set(id, wisdomRng.pair());
		b0.addSkill(id, Perspective.Self, instantiateSamplePolicy(uma.samplePolicies.get(id)));
	});
	if (!CC_GLOBAL) b0.withAsiwotameru().withStaminaSyoubu();
	if (options.usePosKeep) b0.useDefaultPacer();
	if (options.useIntChecks) b0.withWisdomChecks(wisdomSeeds);
	const b1 = b0
		.fork()
		.hpPolicyFactory((course, params, rng) => new CalcRequiredHpPolicy(course, params.groundCondition, rng));
	const skillActivations = new Map();
	b0.onSkillActivate(getActivator(skillActivations)).onSkillDeactivate(getDeactivator(skillActivations, course));

	b0.hpPolicyFactory((course, params, rng) => new ForceFullSpurtHpPolicy(options.forceFullSpurt, course, params.groundCondition, rng));

	const g0 = b0.build(), g1 = b1.build();
	const remainingHp = [], requiredHp = [], downhillSave = [];
	let min = Infinity, max = -Infinity, estMean, estMedian, bestMeanDiff = Infinity, bestMedianDiff = Infinity;
	let minrun, maxrun, meanrun, medianrun;
	let nspurt = 0;
	const sampleCutoff = Math.max(Math.floor(nsamples * 0.8), nsamples - 200);
	for (let i = 0; i < nsamples; ++i) {
		const s0 = g0.next().value as RaceSolver;
		const data = {t: [[]], p: [[]], v: [[]], hp: [[]], sk: [null], sdly: 0, dh: 0};
		while (s0.pos < course.distance) {
			s0.step(1/15);
			data.t[0].push(s0.accumulatetime.t);
			data.p[0].push(s0.pos);
			data.v[0].push(s0.currentSpeed + (s0.modifiers.currentSpeed.acc + s0.modifiers.currentSpeed.err));
			data.hp[0].push((s0.hp as ForceFullSpurtHpPolicy).hp);
		}
		s0.cleanup();
		data.sdly = s0.startDelay;
		data.dh = skillActivations.get('downhill') || 0; skillActivations.delete('downhill');
		data.sk[0] = new Map(skillActivations);
		skillActivations.clear();
		const hpp = s0.hp as ForceFullSpurtHpPolicy;
		nspurt += +hpp.wasFullSpurt;
		downhillSave.push(hpp.downhillSave);
		const hp = hpp.finalHp;
		remainingHp.push(hp);
		if (hp < min) {
			min = hp;
			minrun = data;
		}
		if (hp > max) {
			max = hp;
			maxrun = data;
		}
		if (i == sampleCutoff) {
			remainingHp.sort((a,b) => a - b);
			estMean = remainingHp.reduce((a,b) => a + b) / remainingHp.length;
			const mid = Math.floor(remainingHp.length / 2);
			estMedian = mid > 0 && remainingHp.length % 2 == 0 ? (remainingHp[mid-1] + remainingHp[mid]) / 2 : remainingHp[mid];
		}
		if (i >= sampleCutoff) {
			const meanDiff = Math.abs(hp - estMean), medianDiff = Math.abs(hp - estMedian);
			if (meanDiff < bestMeanDiff) {
				bestMeanDiff = meanDiff;
				meanrun = data;
			}
			if (medianDiff < bestMedianDiff) {
				bestMedianDiff = medianDiff;
				medianrun = data;
			}
		}

		const s1 = g1.next().value as RaceSolver;
		while (s1.pos < course.distance) {
			s1.step(1/15);
			if (s1.isLastSpurt) {
				requiredHp.push((s1.hp as CalcRequiredHpPolicy).hpUsed);
				break;
			}
		}
	}
	remainingHp.sort((a,b) => a - b);
	requiredHp.sort((a,b) => a - b);
	downhillSave.sort((a,b) => a - b);
	return {results: {remainingHp, requiredHp, downhillSave}, runData: {nspurt, minrun, maxrun, meanrun, medianrun}};
}
