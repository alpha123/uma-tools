import { fromJS } from 'immutable';

import type { CourseData } from '../uma-skill-tools/CourseData';
import type { RaceParameters } from '../uma-skill-tools/RaceParameters';

import { HorseState } from '../components/HorseDefTypes';
import { runComparison } from './compare';

import skillmeta from '../skill_meta.json';

function mergeResults(results1, results2) {
	console.assert(results1.id == results2.id, `mergeResults: ${results1.id} != ${results2.id}`);
	const n1 = results1.results.length, n2 = results2.results.length;
	const combinedResults = results1.results.concat(results2.results).sort((a,b) => a - b);
	const combinedMean = (results1.mean * n1 + results2.mean * n2) / (n1 + n2);
	const mid = Math.floor(combinedResults.length / 2);
	const newMedian = combinedResults.length % 2 == 0 ? (combinedResults[mid-1] + combinedResults[mid]) / 2 : combinedResults[mid];
	return {
		id: results1.id,
		results: combinedResults,
		min: Math.min(results1.min, results2.min),
		max: Math.max(results1.max, results2.max),
		mean: combinedMean,
		median: newMedian,
		runData: {
			// TODO should re-compute the bashin gain from .t/.p and pick whichever is closer to new mean/median
			...(n2 > n1 ? results2.runData : results1.runData),
			minrun: results1.min < results2.min ? results1.runData.minrun : results2.runData.minrun,
			maxrun: results1.max > results2.max ? results1.runData.maxrun : results2.runData.maxrun,
		}
	};
}

function mergeResultSets(data1, data2) {
	data2.forEach((r,id) => {
		data1.set(id, mergeResults(data1.get(id), r));
	});
}

function run1Round(nsamples: number, skills: string[], course: CourseData, racedef: RaceParameters, uma: HorseState, options) {
	const data = new Map();
	skills.forEach(id => {
		const withSkill = uma.set('skills', uma.skills.set(skillmeta[id].groupId, id));
		const {results, runData} = runComparison(nsamples, course, racedef, uma, withSkill, options);
		const mid = Math.floor(results.length / 2);
		const median = results.length % 2 == 0 ? (results[mid-1] + results[mid]) / 2 : results[mid];
		const mean = results.reduce((a,b) => a+b, 0) / results.length;
		data.set(id, {
			id, results, runData,
			min: results[0],
			max: results[results.length-1],
			mean,
			median
		});
	});
	return data;
}

function runChart({skills, course, racedef, uma, options}) {
	const uma_ = new HorseState(uma).set('skills', fromJS(uma.skills));
	let results = run1Round(5, skills, course, racedef, uma_, options);
	postMessage({type: 'chart', results});
	skills = skills.filter(id => results.get(id).max > 0.1);
	let update = run1Round(20, skills, course, racedef, uma_, options);
	mergeResultSets(results, update);
	postMessage({type: 'chart', results});
	skills = skills.filter(id => Math.abs(results.get(id).max - results.get(id).min) > 0.1);
	update = run1Round(50, skills, course, racedef, uma_, options);
	mergeResultSets(results, update);
	postMessage({type: 'chart', results});
	update = run1Round(200, skills, course, racedef, uma_, options);
	mergeResultSets(results, update);
	postMessage({type: 'chart', results});
}

function runCompare({nsamples, course, racedef, uma1, uma2, options}) {
	const uma1_ = new HorseState(uma1).set('skills', fromJS(uma1.skills));
	const uma2_ = new HorseState(uma2).set('skills', fromJS(uma2.skills));
	let results;
	for (let n = Math.min(20, nsamples), mul = 6; n < nsamples; n = Math.min(n * mul, nsamples), mul = Math.max(mul - 1, 2)) {
		results = runComparison(n, course, racedef, uma1_, uma2_, options);
		postMessage({type: 'compare', results});
	}
	results = runComparison(nsamples, course, racedef, uma1_, uma2_, options);
	postMessage({type: 'compare', results});
}

self.addEventListener('message', function (e) {
	const {msg, data} = e.data;
	switch (msg) {
		case 'chart':
			runChart(data);
			break;
		case 'compare':
			runCompare(data);
			break;
	}
});
