import { h, Fragment } from 'preact';
import { useState, useMemo, useEffect, useRef } from 'preact/hooks';
import { memo } from 'preact/compat';
import { IntlProvider, Text } from 'preact-i18n';

import { Skill } from './SkillList';

import { getOpenCv, makeWorkers, killWorkers, readUma } from './ocr';

import './HorseOcr.css';

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

	const [stats, setStats] = useState([]);

	const [cvimg, setCvimg] = useState(null);
	const [conflicts, setConflicts] = useState([]);
	const [settled, setSettled] = useState([]);

	useEffect(function () {
		function paste(e) {
			for (const it of e.clipboardData.items) {
				if (it.kind == 'file') {
					setImgData(URL.createObjectURL(it.getAsFile()));
				}
			}
		}
		window.addEventListener('paste', paste);
		return () => window.removeEventListener('paste', paste);
	}, []);

	function recognize() {
		setLoading(true);
		Promise.all([getOpenCv(), makeWorkers()]).then(async ([cvModule, workers]) => {
			cv.current = cvModule;
			const {stats, skills, img: newCvimg} = await readUma(cvModule, workers, img.current, canv.current);
			setStats(stats);
			setCvimg(newCvimg);
			setLoading(false);
			const newConflicts = [], newSettled = [];
			skills.forEach((sk,i) => {
				if (sk.candidates.length == 1) {
					newSettled.push(sk.candidates[0]);
				} else if (i == 0) {
					const unique = sk.candidates.filter(id => id[0] == '1');
					if (unique.length == 1) {
						newSettled.push(unique[0]);
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
			setConflicts(newConflicts);
			setSettled(newSettled);
		});
	}

	function resolve(skillid) {
		setSettled(settled.concat([skillid]));
		setConflicts(conflicts.slice(1));
	}

	return (
		<Fragment>
			<button>Upload or paste</button>
			<img src={imgData} style="display:none" ref={img} />
			<canvas ref={canv} style="display:none" />
			<img src={imgData} style="height:100%" />
			<button onClick={recognize}>Recognize</button>
			{loading && <span>Loading...</span>}
			{conflicts.length > 0 && <ResolvePrompt cv={cv.current} img={cvimg} bbox={conflicts[0].bbox} candidates={conflicts[0].candidates} resolve={resolve} />}
			{settled.join(', ')}
		</Fragment>
	);
}
