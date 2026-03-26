import skilldata from '../uma-skill-tools/data/skill_data.json';
import skillnames from '../uma-skill-tools/data/skillnames.json';

export async function getOpenCv() {
	// why is this thing so shit
	// holy shit this is insane
	// i can't believe this is the only way to get it to work
	// ive tried so many reasonable things
	return new Promise((resolve, reject) => {
		if (window.cv && window.cv.Mat) {
			resolve(window.cv);
			return;
		}
		
		// TODO need to go back through and figure out how much of this is really necessary if we patch it to remove
		// Module.then
		const script = document.createElement('script');
		script.src = '../vendor/opencv.js';
		script.async = true;
		script.onload = function () {
			const poll = setInterval(function () {
				if (window.cv && window.cv.Mat) {
					clearInterval(poll);
					delete window.cv.then;  // lmao
					resolve(window.cv);
				}
			}, 30);
			setTimeout(function () {
				clearInterval(poll);
				reject(new Error('opencv'));
			}, 300);
		};
		window.Module = {
			onRuntimeInitialized() {
				delete window.cv.then;  // lmao?
				resolve(window.cv);
			}
		};
		document.body.appendChild(script);
	});
}

const tessPaths = Object.freeze({
	workerPath: '/uma-tools/vendor/tesseract.js/worker.min.js',
	corePath: '/uma-tools/vendor/tesseract.js/core',
	langPath: '/uma-tools/vendor/tesseract.js/traineddata'
});
export async function makeWorkers() {
	const {createWorker, createScheduler} = await import('tesseract.js');
	const stat = await createWorker('eng', 1, tessPaths);
	await stat.setParameters({tessedit_char_whitelist: '0123456789 ', tessjs_create_hocr: '0', tessjs_create_tsv: '0'});

	const skSched = createScheduler();
	const workers = await Promise.all(Array.from({length: 2}, () => createWorker(CC_GLOBAL ? 'eng' : 'jpn', 1, tessPaths)));
	for (let i = 0; i < workers.length; ++i) {
		const w = workers[i];
		await w.setParameters({tessjs_create_hocr: '0', tessjs_create_tsv: '0'});
		skSched.addWorker(w);
	}
	return {stat, skSched};
}

export async function killWorkers(workers) {
	await Promise.all([workers.stat.terminate(), workers.skSched.terminate()]);
}

async function readStatsSkills(cv, workers, canv, src) {
	const dst = new cv.Mat();
	cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
	cv.threshold(dst, dst, 127, 255, cv.THRESH_BINARY);

	const stl = {x: 35, y: 895}, sbr = {x: 1105, y: dst.rows};
	const m = (sbr.x - stl.x) / 2;
	// if there's a black line in the middle bottom of the image assume that's the top of the 閉じる button and crop that out
	// the bottom of the button is more reliably detected than the top (top line gets thresholded out sometimes) so look from
	// the bottom and subtract 140 or so to clip it out if we find something
	// (don't start from the very bottom in case we didnt crop quite perfectly in the first place, though not sure whether or
	// not this actually happens)
	const r = new cv.Rect(stl.x + m - 150, dst.rows - 230, 300, 220);
	const avg = new cv.Mat();
	cv.reduce(dst.roi(r), avg, 1, cv.REDUCE_AVG, cv.CV_8U);
	for (let i = avg.rows - 1; i >= 0; --i) {
		if (avg.ucharAt(i,0) < 20) {
			sbr.y = dst.rows - 250 + i - 140;
			break;
		}
	}
	avg.delete();

	cv.imshow(canv, dst);
	const [skleft, skright] = await Promise.all([
		workers.skSched.addJob('recognize', canv, {rectangle: {top: stl.y, left: stl.x + 62, width: m - 62, height: sbr.y - stl.y}}, {text: true, hocr: false, tsv: false}),
		workers.skSched.addJob('recognize', canv, {rectangle: {top: stl.y, left: stl.x + m + 62, width: m - 62, height: sbr.y - stl.y}}, {text: true, hocr: false, tsv: false})
	]);

	// dilate/erode occasionally improves stat results by mostly getting rid of the stat rank icons
	// second round sometimes helps and sometimes hurts
	// raising kernel to 4x4 makes it worse, 3x3 is sometimes better and sometimes worse
	// do this after recognizing skills since it makes that much worse
	const kern = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2,2));
	const p = new cv.Point(-1,-1);
	cv.dilate(dst, dst, kern, p, 1);
	cv.erode(dst, dst, kern, p, 1);
	//cv.dilate(dst, dst, kern, p, 1);
	//cv.erode(dst, dst, kern, p, 1);
	const tl = {x: 52, y: 490}, br = {x: 1115, y: 562};
	cv.imshow(canv, dst);
	dst.delete();
	const res = await workers.stat.recognize(canv, {rectangle: {top: tl.y, left: tl.x, width: br.x - tl.x, height: br.y - tl.y}});
	// realistically never get 2 digit stats in game so filter out to clean up occasional noise from the rank images
	// similarly, if it bleeds into the next number take the last 4 digits
	const stats = res.data.text.split(/\s+/).filter(s => s.length > 2).map(x => +x.slice(-4));
	// occasionally it still returns spurious 3+ digit numbers, best heuristic i can think of is to drop the lowest
	// since the spurious ones are usually small
	while (stats.length > 5) {
		stats.splice(stats.indexOf(stats.reduce((a,b) => Math.min(a,b), Infinity)), 1);
	}

	return {stats, skleft: skleft.data.lines, skright: skright.data.lines};
}

function findBounds(cv, src) {
	const greenLo = new cv.Mat(src.rows, src.cols, src.type(), [107, 182, 7, 0]),
		greenHi = new cv.Mat(src.rows, src.cols, src.type(), [173, 234, 126, 255]);
	const mask = new cv.Mat();
	cv.inRange(src, greenLo, greenHi, mask);
	let avg = new cv.Mat();
	cv.reduce(mask, avg, 1, cv.REDUCE_AVG, cv.CV_8U);
	let top = -1;
	for (let i = 0; i < avg.rows; ++i) {
		if (avg.ucharAt(i,0) > 80) {
			top = i;
			break;
		}
	}
	// i feel like i shouldnt have to delete and recreate the Mat every time but reusing it results in OpenCV erroring out
	avg.delete();

	const grayLo = new cv.Mat(src.rows, src.cols, src.type(), [240, 240, 240, 0]),
		grayHi = new cv.Mat(src.rows, src.cols, src.type(), [255, 255, 255, 255]);
	cv.inRange(src, grayLo, grayHi, mask);
	const kern = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2,2));
	const p = new cv.Point(-1,-1);
	cv.erode(mask, mask, kern, p, 1);
	avg = new cv.Mat();
	cv.reduce(mask, avg, 1, cv.REDUCE_AVG, cv.CV_8U);
	let bottom = -1;
	for (let i = avg.rows - 1; i >= 0; --i) {
		if (avg.ucharAt(i,0) > 180) {
			bottom = i;
			break;
		}
	}
	avg.delete();

	avg = new cv.Mat();
	cv.reduce(mask, avg, 0, cv.REDUCE_AVG, cv.CV_8U);
	let left = -1;
	for (let i = 0; i < avg.cols; ++i) {
		if (avg.ucharAt(0,i) > 100) {
			left = i;
			break;
		}
	}
	let right = -1;
	for (let i = avg.cols - 1; i >= 0; --i) {
		if (avg.ucharAt(0,i) > 100) {
			right = i;
			break;
		}
	}
	mask.delete();
	avg.delete();
	greenLo.delete();
	greenHi.delete();
	grayLo.delete();
	grayHi.delete();
	console.assert(top > -1);
	console.assert(bottom > -1);
	console.assert(left > -1);
	console.assert(right > -1);
	return new cv.Rect(left, top, right - left, bottom - top);
}

function resize(cv, src) {
	const newWidth = 1138;
	const aspectratio = src.rows / src.cols;
	const dst = new cv.Mat();
	cv.resize(src, dst, new cv.Size(newWidth, newWidth * aspectratio), 0, 0, newWidth > src.cols ? cv.INTER_CUBIC : cv.INTER_AREA);
	return dst;
}

// fugly pile of heuristics that nevertheless appears to mostly work
// currently we:
//   - remove dakuten, handakuten, and all spaces
//   - penalize insertions and deletions of kanji the most
//   - penalize insertions and deletions of kana slightly less
//   - penalize replacements and insertions/deletions of roughly punctuation things the least
//   - treat certain common confusables (カ・力、ー・一, etc) as having no penalty
// (NB. should this use the unicode confusables list?
// ⇒ much more complicated/large data size in return for probably not that much more robustness)
//
// ○ seems to often get picked up as 〇 but ◎ (tentatively) does not, so it should be safe to make that replacement
function normalize(s) {
	return s.normalize('NFKD').replace(/[\u3099-\u309C\s]/g, '').replaceAll('〇', '○');
}

const isKanji = (c) => /(?!\p{Punctuation})\p{Script_Extensions=Han}/u.test(c);
const isKana = (c) => /(?!\p{Punctuation})[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]/u.test(c);
const confusables = ['カ力', 'ー一', 'シッツ', 'ソン'];
function levendist_(s, t) {
	let v0 = Array.from({length: t.length+1}, (_,i) => i);
	let v1 = Array(s.length+1);
	for (let i = 0; i < s.length; ++i) {
		v1[0] = i + 1;
		for (let j = 0; j < t.length; ++j) {
			const a = s[i], b = t[j];
			let insCost = 1, delCost = 1;
			if (isKanji(a)) insCost = 5;
			else if (isKana(a)) insCost = 3;
			if (isKanji(b)) delCost = 5;
			else if (isKana(b)) delCost = 3;
			const cfi = confusables.findIndex(cf => cf.indexOf(a) > -1);
			const free = cfi > -1 && confusables[cfi].indexOf(b) > -1;
			v1[j+1] = Math.min(v0[j+1] + insCost, v1[j] + delCost, v0[j] + +(a != b && !free));
		}
		[v0,v1] = [v1,v0];
	}
	return v0[t.length];
}

function levendist({s, kanamap:skana, kanjimap:skanji}, {s:t, kanamap:tkana, kanjimap:tkanji}) {
	let v0 = Array.from({length: t.length+1}, (_,i) => i);
	let v1 = Array(s.length+1);
	for (let i = 0; i < s.length; ++i) {
		v1[0] = i + 1;
		for (let j = 0; j < t.length; ++j) {
			let insCost = 1, delCost = 1;
			if (skanji[i]) insCost = 5;
			else if (skana[i]) insCost = 3;
			if (tkanji[j]) delCost = 5;
			else if (tkana[j]) delCost = 3;
			const a = s[i], b = t[j];
			const cfi = confusables.findIndex(cf => cf.indexOf(a) > -1);
			const free = cfi > -1 && confusables[cfi].indexOf(b) > -1;
			v1[j+1] = Math.min(v0[j+1] + insCost, v1[j] + delCost, v0[j] + +(a != b && !free));
		}
		[v0,v1] = [v1,v0];
	}
	return v0[t.length];
}

const normalnames = Object.fromEntries(Object.entries(skillnames).map(([id,names]) => {
	const s = normalize(names[0]);
	return [id, {s, kanamap: s.split('').map(isKana), kanjimap: s.split('').map(isKanji)}];
}));

function closest(text) {
	const s = normalize(text).replace(/Lv.$/,'');
	const sk = {s, kanamap: s.split('').map(isKana), kanjimap: s.split('').map(isKanji)};

	// there are some entries in skillnames that don't have real skilldata (for non-general skills i guess)
	// so iterate skilldata even though we only need the names
	return Object.keys(skilldata).reduce(({ids,min},id) => {
		const dist = levendist(normalnames[id], sk);
		if (dist < min) {
			return {ids: [id], min: dist};
		} else if (dist == min) {
			ids.push(id);
		}
		return {ids, min};
	}, {ids: [], min: Infinity}).ids;
}

function matchSkills(lines) {
	return Object.fromEntries(lines.map(l => [l.text,{n:closest(l.text), b:l.bbox}]));
}

export async function readUma(cv, workers, img, canv) {
	let src = cv.imread(img);
	const r = findBounds(cv, src);
	src = resize(cv, src.roi(r));
	const {stats, skleft, skright} = await readStatsSkills(cv, workers, canv, src);
	const skills = skleft.concat(skright).map(line => ({candidates: closest(line.text), bbox: line.bbox}));
	return {stats, skills, img: src};
}
