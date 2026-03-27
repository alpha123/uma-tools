import { h, Fragment } from 'preact';
import { useState, useMemo, useEffect, useRef } from 'preact/hooks';
import { memo } from 'preact/compat';
import { IntlProvider, Text } from 'preact-i18n';

import { O, State, makeState, useLens } from '../optics';

import { Skill, SkillList } from './SkillList';
import { HorseState, SkillSet, umaForUniqueSkill, DEFAULT_HORSE_STATE } from './HorseDefTypes';
import { HorseDef } from './HorseDef';

import { getOpenCv, makeWorkers, killWorkers, readUma } from './ocr';

import './HorseOcr.css';

import skilldata from '../uma-skill-tools/data/skill_data.json';
import umas from '../umas.json';

function makeUma(stats, aptitudes, uniqueLv, skills) {
	const unique = skills.find(sid => sid.length <= 6 && sid[0] == '1');  // pinks also start with 1xx
	console.assert(unique != null);
	const outfitId = unique == null ? '' : umaForUniqueSkill(unique);
	const u = outfitId && umas[outfitId.slice(0,4)].outfits[outfitId];
	uniqueLv = Math.min(Math.max(uniqueLv, 1), 10);
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
		strategy: u ? ['', 'Nige', 'Senkou', 'Sasi', 'Oikomi'][u.strategy] : 'Senkou',
		aptitudes: aptitudes.slice(2).concat(aptitudes.slice(0,2)),
		skills: SkillSet(skills),
		uniqueLv
	};
}

function ResolvePrompt(props) {
	const [skillPickerOpen, setSkillPickerOpen] = useState(false);
	const canv = useRef(null);
	useEffect(function () {
		const cv = props.cv;
		const b = props.bbox;
		const r = new cv.Rect(b.x0 - 80, b.y0 - 40, 120 - b.x0 + b.x1, 80 - b.y0 + b.y1);
		cv.imshow(canv.current, props.img.roi(r));
	}, [props.img, props.bbox]);

	function handleClick(e) {
		const se = e.target.closest('div.skill');
		if (se == null) return;
		props.resolve(se.dataset.skillid);
	}

	function selectOther(skills) {
		setSkillPickerOpen(false);
		props.resolve(Array.from(skills.values())[0]);
	}

	return (
		<div class="ocrResolvePrompt">
			<span>Computer had trouble reading some skills. Please help it out.</span>
			<h1>What skill is this?</h1>
			<canvas ref={canv} />
			<ul class="skillList" onClick={handleClick}>
				{props.candidates.map(id => <li key={id}><Skill id={id} selected={false} /></li>)}
				<li key="add">
					<button class="skill addSkillButton" onClick={setSkillPickerOpen.bind(null, true)}><span></span>Other</button>
				</li>
			</ul>
			<div class={`horseSkillPickerOverlay ${skillPickerOpen ? "open" : ""}`} onClick={setSkillPickerOpen.bind(null, false)} />
			<div class={`horseSkillPickerWrapper ${skillPickerOpen ? "open" : ""}`}>
				<SkillList ids={Object.keys(skilldata)} selected={new Map()} setSelected={selectOther} isOpen={skillPickerOpen} />
			</div>
		</div>
	);
}

const enum OcrState { Uploading, Loading, Loading2, Resolving, Accepting };

export function HorseOcr(props) {
	const [ocrState, setOcrState] = useState(OcrState.Uploading);
	const [imgData, setImgData] = useState([]);
	const imgs = useRef([]);
	const canv = useRef(null);
	const cv = useRef(null);
	const cvimgs = useRef([]);
	const fileInput = useRef(null);

	const [partialOcrResults, setPartialOcrResults] = useState<{stats: number[], aptitudes: HorseState['aptitudes'], uniqueLv: number}>(null);
	const [conflicts, setConflicts] = useState([]);
	const [settled, setSettled] = useState([]);

	const umaState = makeState(() => ({uma: DEFAULT_HORSE_STATE}));
	const [uma, setUma] = useLens(O.uma, umaState);

	useEffect(function () {
		if (!props.isOpen) return;
		function paste(e) {
			const newBlobs = [];
			for (const it of e.clipboardData.items) {
				if (it.kind == 'file') {
					newBlobs.push(URL.createObjectURL(it.getAsFile()));
				}
			}
			setImgData(imgData.concat(newBlobs));
		}
		window.addEventListener('paste', paste);
		return () => window.removeEventListener('paste', paste);
	}, [props.isOpen, imgData]);

	function acceptFileUpload(e) {
		if (ocrState != OcrState.Uploading) return;
		e.preventDefault();
		const newBlobs = [];
		const files = e instanceof DragEvent ? e.dataTransfer.files : e.currentTarget.files;
		for (const f of files) {
			newBlobs.push(URL.createObjectURL(f));
		}
		setImgData(imgData.concat(newBlobs));
	}

	function imageGridClick(e) {
		const btn = e.target.closest('button');
		if (btn == null) return;
		const newImgData = imgData.slice();
		const blob = newImgData.splice(+btn.dataset.idx, 1)[0];
		URL.revokeObjectURL(blob);
		setImgData(newImgData);
	}

	function reset() {
		setOcrState(OcrState.Uploading);
		imgData.forEach(blob => URL.revokeObjectURL(blob));
		setImgData([]);
		setPartialOcrResults(null);
		setConflicts([]);
		setSettled([]);
		cvimgs.current.forEach(img => img.delete());
		cvimgs.current = [];
	}

	function close() {
		reset();
		props.onClose();
		setUma(DEFAULT_HORSE_STATE);
	}

	function accept() {
		reset();
		props.onAccept(uma);
		setUma(DEFAULT_HORSE_STATE);
	}

	function recognize() {
		setOcrState(OcrState.Loading);
		Promise.all([getOpenCv(), makeWorkers()]).then(async ([cvModule, workers]) => {
			cv.current = cvModule;
			setOcrState(OcrState.Loading2);
			// doing this on the UI thread is obviously kind of stupid, but the only (?) way to pass data between
			// OpenCV and Tesseract is via DOM elements (canvas/img), and running them in workers and marshalling the data
			// back and forth through the main thread is very annoying. at least the OpenCV operations dont actually take
			// all that long and Tesseract runs in its own workers anyway.
			const {stats, aptitudes, uniqueLv, conflicts: newConflicts, settled: newSettled} = await imgs.current.reduce(async (state_, img) => {
				const state = await state_;
				const {stats, aptitudes, skills, uniqueLv, img: cvimg} = await readUma(cvModule, workers, img, canv.current);
				cvimgs.current.push(cvimg);
				skills.forEach((sk,i) => {
					if (sk.candidates.length == 1) {
						state.settled.push(sk.candidates[0]);
					} else {
						// check the first skill only on the image with the Lv pattern
						// arguably it would be preferable to pass the lv match for each skill separately and check based on that,
						// but index == 0 works just as well i think
						const expectRealUnique = i == 0 && uniqueLv != 0;
						const candidates = sk.candidates.filter(id => (id[0] == '1') == expectRealUnique);
						if (candidates.length == 1) {
							state.settled.push(candidates[0]);
						} else {
							if (!state.conflicts.some(cf =>
								cf.candidates.length == candidates.length &&
								cf.candidates.every(c => candidates.indexOf(c) > -1)
							)) {
								state.conflicts.push({candidates, cvimg, bbox: sk.bbox});
							}
						}
					}
				});
				if (CC_DEBUG) {
					if (state.stats && !state.stats.every((s,i) => s == stats[i])) console.warn('stats mismatch', state.stats, '!=', stats);
					if (state.aptitudes && !state.aptitudes.every((a,i) => a == aptitudes[i])) console.warn('aptitudes mismatch', state.aptitudes, '!=', aptitudes);
				}
				state.uniqueLv = Math.max(state.uniqueLv, uniqueLv);
				if (state.stats == null) state.stats = stats;
				if (state.aptitudes == null) state.aptitudes = aptitudes;
				return state;
			}, Promise.resolve({stats: null, aptitudes: null, uniqueLv: 0, conflicts: [], settled: []}));
			killWorkers(workers);
			if (newConflicts.length == 0) {
				setOcrState(OcrState.Accepting);
				setUma(makeUma(stats, aptitudes, uniqueLv, newSettled));
			} else {
				setOcrState(OcrState.Resolving);
				setPartialOcrResults({stats, aptitudes, uniqueLv});
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
			setOcrState(OcrState.Accepting);
			setUma(makeUma(partialOcrResults.stats, partialOcrResults.aptitudes, partialOcrResults.uniqueLv, newSettled));
		}
	}

	return (
		<div class="horseOcr">
			<div class="horseOcrContent" onDragOver={e => e.preventDefault()} ondrop={acceptFileUpload}>
				{imgData.map((d,i) => <img src={d} style="display:none" ref={(el) => imgs.current[i] = el} />)}
				<canvas ref={canv} style="display:none" />
				<div class="ocrImageGrid" onClick={imageGridClick}>
					{imgData.map((d,i) => (
						<div class="ocrImageWrapper">
							<img src={d} />
							{ocrState == OcrState.Uploading && <button class="circleBtn2" data-idx={i}>×</button>}
						</div>
					))}
				</div>
				<div class="ocrRightPane">
					{(() => {
						switch (ocrState) {
							case OcrState.Uploading:
								return <div class="ocrUploadWrapper">
									<button class="ocrUpload" onClick={() => fileInput.current.click()}>
										<span>🡑</span><span>Upload or paste</span>
									</button>
									<input type="file" accept="image/*" multiple onChange={acceptFileUpload} ref={fileInput} />
								</div>;
							case OcrState.Loading:
							case OcrState.Loading2:
								return <div class="ocrUploadWrapper">
									<span class="ocrLoading">Working...{ocrState == OcrState.Loading2 && ' (This can take a while)'}</span>
								</div>;
							case OcrState.Resolving:
								return <ResolvePrompt cv={cv.current} img={conflicts[0].cvimg} bbox={conflicts[0].bbox}
										   candidates={conflicts[0].candidates} resolve={resolve} />;
							case OcrState.Accepting:
								return <State.Provider value={umaState}>
									<HorseDef key={uma.outfitId} state={O.uma} aptitudesMode="full" course={null} showPolicyEd={false} showOcr={false} tabstart={() => 1}>
										<Text id="common.umaheader" />
									</HorseDef>
								</State.Provider>;
						}
					})()}
				</div>
			</div>
			<div class="horseOcrButtons">
				<button class="btnType2" onClick={close}>Close</button>
				{ocrState < OcrState.Resolving
					? <button class="btnType1" disabled={imgData.length == 0 || ocrState != OcrState.Uploading} onClick={recognize}>Recognize</button>
					: <button class="btnType1" disabled={ocrState != OcrState.Accepting} onClick={accept}>Accept</button>
				}
			</div>
		</div>
	);
}
