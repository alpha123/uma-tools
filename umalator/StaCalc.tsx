import { h } from 'preact';
import { useState, useId } from 'preact/hooks';
import { memo } from 'preact/compat';
import { Text, IntlProvider } from 'preact-i18n';

import { useLens } from '../optics';

import './StaCalc.css';

function maxHpToStamina(strategy: 'Nige' | 'Senkou' | 'Sasi' | 'Oikomi' | 'Oonige', hp: number, distance: number) {
	const coef = {
		'Nige': 0.95,
		'Senkou': 0.89,
		'Sasi': 1.0,
		'Oikomi': 0.995,
		'Oonige': 0.86
	}[strategy];
	return 1.25 * (hp - distance) / coef;
}

export function StaCalcResults(props) {
	const [displaying, setChartData] = useLens(props.displayedRun);
	const {remainingHp, requiredHp} = props.results;
	const Histogram = props.Histogram;

	const [spurtPerc, setSpurtPerc] = useState(95);
	const spurtPercId = useId();

	const min = remainingHp[0], max = remainingHp[remainingHp.length-1];
	const mid = Math.floor(remainingHp.length / 2);
	const median = remainingHp.length % 2 == 0 ? (remainingHp[mid-1] + remainingHp[mid]) / 2 : remainingHp[mid];
	const mean = remainingHp.reduce((a,b) => a+b, 0) / remainingHp.length;

	return (
		<div class="stacalcWrapper">
			<div class="stacalcPane">
				<h1>Remaining HP</h1>
				<table id="resultsSummary">
					<tfoot>
						<tr>
							{Object.entries({
								minrun: ['Minimum', 'Set chart display to the run with minimum remaining HP'],
								maxrun: ['Maximum', 'Set chart display to the run with maximum remaining HP'],
								meanrun: ['Mean', 'Set chart display to a run representative of the mean remaining HP'],
								medianrun: ['Median', 'Set chart display to a run representative of the median remaining HP']
							}).map(([k,label]) =>
								<th scope="col" class={displaying == k ? 'selected' : ''} title={label[1]} onClick={() => setChartData(k)}>{label[0]}</th>
							)}
						</tr>
					</tfoot>
					<tbody>
						<tr>
							<td onClick={() => setChartData('minrun')}>{Math.round(min)}<span class="unit-basinn">HP</span></td>
							<td onClick={() => setChartData('maxrun')}>{Math.round(max)}<span class="unit-basinn">HP</span></td>
							<td onClick={() => setChartData('meanrun')}>{Math.round(mean)}<span class="unit-basinn">HP</span></td>
							<td onClick={() => setChartData('medianrun')}>{Math.round(median)}<span class="unit-basinn">HP</span></td>
						</tr>
					</tbody>
				</table>
				<Histogram width={500} height={333} data={remainingHp} />
			</div>
			<div class="stacalcPane">
				<h1>Full spurt rate: {(props.nspurt / remainingHp.length * 100).toFixed(2)}%</h1>
				<div class="reqStamCalc">
					<label for={spurtPercId}>Stamina required for</label>
					<input type="number" id={spurtPercId} min="1" max="100" value={spurtPerc} onInput={e => setSpurtPerc(+e.currentTarget.value)} />
					<span>% spurt rate: {Math.round(maxHpToStamina(props.uma.strategy, requiredHp[Math.ceil(requiredHp.length * (spurtPerc / 100)) - 1], props.course.distance))}</span>
				</div>
			</div>
		</div>
	);
}
