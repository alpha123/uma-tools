import { h, Fragment } from 'preact';
import { useState, useMemo, useEffect, useRef } from 'preact/hooks';
import { memo } from 'preact/compat';
import { IntlProvider, Text } from 'preact-i18n';

import { O, State, makeState, useLens } from '../optics';

import { Skill } from './SkillList';
import { HorseState, SkillSet, umaForUniqueSkill, DEFAULT_HORSE_STATE } from './HorseDefTypes';
import { HorseDef } from './HorseDef';

import { getOpenCv, makeWorkers, killWorkers, readUma } from './ocr';

import './HorseOcr.css';

import umas from '../umas.json';

function makeUma(stats, uniqueLv, skills) {
	console.assert(skills[0][0] == '1');
	const outfitId = umaForUniqueSkill(skills[0]);
	const u = umas[outfitId.slice(0,4)].outfits[outfitId];
	// lowest star count that can reach this unique level
	const starCount = skills[0].length == 5 ? uniqueLv - 3 : uniqueLv - 1;
	return {
		...DEFAULT_HORSE_STATE,
		outfitId,
		starCount,
		speed: stats[0],
		stamina: stats[1],
		power: stats[2],
		guts: stats[3],
		wisdom: stats[4],
		strategy: ['', 'Nige', 'Senkou', 'Sasi', 'Oikomi'][u.strategy],
		aptitudes: u.aptitudes.map(i => ' GFEDCBA'[i]),
		skills: SkillSet(skills),
		uniqueLv
	};
}

function ResolvePrompt(props) {
	const canv = useRef(null);
	useEffect(function () {
		const cv = props.cv;
		const b = props.bbox;
		const r = new cv.Rect(b.x0 - 80, b.y0 - 40, 120 - b.x0 + b.x1, 80 - b.y0 + b.y1);
		cv.imshow(canv.current, props.img.roi(r));
	}, [props.img, props.bbox])
	function handleClick(e) {
		const se = e.target.closest('div.skill');
		if (se == null) return;
		props.resolve(se.dataset.skillid);
	}
	return (
		<div class="ocrResolvePrompt">
			<span>Computer had trouble reading some skills. Please help it out.</span>
			<h1>What skill is this?</h1>
			<canvas ref={canv} />
			<ul class="skillList" onClick={handleClick}>
				{props.candidates.map(id => <li key={id}><Skill id={id} selected={false} /></li>)}
			</ul>
		</div>
	);
}

export function HorseOcr(props) {
	const [imgData, setImgData] = useState(null);
	const [loading, setLoading] = useState(false);
	const img = useRef(null);
	const canv = useRef(null);
	const cv = useRef(null);

	const [cvimg, setCvimg] = useState(null);
	const [partialOcrResults, setPartialOcrResults] = useState<{stats: number[], uniqueLv: number}>(null);
	const [conflicts, setConflicts] = useState([]);
	const [settled, setSettled] = useState([]);

	const umaState = makeState(() => ({uma: null}));
	const [uma, setUma] = useLens(O.uma, umaState);

	useEffect(function () {
		if (!props.isOpen) return;
		function paste(e) {
			for (const it of e.clipboardData.items) {
				if (it.kind == 'file') {
					setImgData(URL.createObjectURL(it.getAsFile()));
				}
			}
		}
		window.addEventListener('paste', paste);
		return () => window.removeEventListener('paste', paste);
	}, [props.isOpen]);

	function reset() {
		setImgData(null);
		setLoading(false);
		setCvimg(null);
		setPartialOcrResults(null);
		setConflicts([]);
		setSettled([]);
	}

	function close() {
		reset();
		props.onClose();
		setUma(null);
	}

	function accept() {
		reset();
		props.onAccept(uma);
		setUma(null);
	}

	function recognize() {
		setLoading(true);
		Promise.all([getOpenCv(), makeWorkers()]).then(async ([cvModule, workers]) => {
			cv.current = cvModule;
			const {stats, skills, uniqueLv, img: newCvimg} = await readUma(cvModule, workers, img.current, canv.current);
			setPartialOcrResults({stats, uniqueLv});
			setCvimg(newCvimg);
			setLoading(false);
			const newConflicts = [], newSettled = [];
			skills.forEach((sk,i) => {
				if (sk.candidates.length == 1) {
					newSettled.push(sk.candidates[0]);
				} else if (i == 0) {
					const uniques = sk.candidates.filter(id => id[0] == '1');
					if (uniques.length == 1) {
						newSettled.push(uniques[0]);
					} else {
						newConflicts.push({candidates: uniques, bbox: sk.bbox});
					}
				} else {
					const nonUniques = sk.candidates.filter(id => id[0] != '1');
					if (nonUniques.length == 1) {
						newSettled.push(nonUniques[0]);
					} else {
						newConflicts.push({candidates: nonUniques, bbox: sk.bbox});
					}
				}
			});
			if (newConflicts.length == 0) {
				setUma(makeUma(stats, uniqueLv, newSettled));
			} else {
				setConflicts(newConflicts);
				setSettled(newSettled);
			}
		});
	}

	function resolve(skillid) {
		const newSettled = settled.concat([skillid]);
		const newConflicts = conflicts.slice(1);
		setSettled(newSettled);
		setConflicts(newConflicts);
		if (newConflicts.length == 0) {
			setUma(makeUma(partialOcrResults.stats, partialOcrResults.uniqueLv, newSettled));
		}
	}

	return (
		<div class="horseOcr">
			<div class="horseOcrContent">
				{imgData == null && <button class="ocrUpload">Upload or paste</button>}
				<img src={imgData} style="display:none" ref={img} />
				<canvas ref={canv} style="display:none" />
				{imgData != null && <img src={imgData} style="height:100%" />}
				{imgData != null &&
					<div class="ocrRightPane">
						{loading && <span class="ocrLoading">Working...</span>}
						{conflicts.length > 0 && <ResolvePrompt cv={cv.current} img={cvimg} bbox={conflicts[0].bbox} candidates={conflicts[0].candidates} resolve={resolve} />}
						{uma != null &&
							<State.Provider value={umaState}>
								<HorseDef key={uma.outfitId} state={O.uma} aptitudesMode="full" courseDistance={0} showPolicyEd={false} showOcr={false} tabstart={() => 1}>
									<Text id="common.umaheader" />
								</HorseDef>
							</State.Provider>
						}
					</div>
				}
			</div>
			<div class="horseOcrButtons">
				<button class="btnType2" onClick={close}>Close</button>
				{partialOcrResults == null
					? <button class="btnType1" disabled={imgData == null || loading} onClick={recognize}>Recognize</button>
					: <button class="btnType1" disabled={uma == null} onClick={accept}>Accept</button>
				}
			</div>
		</div>
	);
}
