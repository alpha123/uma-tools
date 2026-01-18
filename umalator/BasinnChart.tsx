import { h, Fragment } from 'preact';
import { useState, useMemo, useId } from 'preact/hooks';
import { Text, Localizer } from 'preact-i18n';

import {
	ColumnDef, SortFn, SortingState,
	createSortedRowModel, flexRender, rowSortingFeature, sortFns, tableFeatures, useTable
} from '@tanstack/preact-table';

import { O, c, useLens } from '../optics';

import { Region, RegionList } from '../uma-skill-tools/Region';
import { CourseData } from '../uma-skill-tools/CourseData';
import { RaceParameters } from '../uma-skill-tools/RaceParameters';
import { getParser } from '../uma-skill-tools/ConditionParser';
import { buildBaseStats, buildSkillData, Perspective } from '../uma-skill-tools/RaceSolverBuilder';

import type { HorseState } from '../components/HorseDef';
import { runComparison } from './compare';

import './BasinnChart.css';

import skilldata from '../uma-skill-tools/data/skill_data.json';
import skillnames from '../uma-skill-tools/data/skillnames.json';
import skillmeta from '../skill_meta.json';

export function isPurpleSkill(id) {
	const iconId = skillmeta[id].iconId;
	return iconId[iconId.length-1] == '4';
}

export const skillGroups = Object.keys(skilldata).sort((a,b) =>
	// sort by:
	//   - rarity (lowest to highest, white → gold → pink)
	//   - if rarity is the same, sort ○ before ◎ (◎ skills always have a lower ID than their ○ counterparts)
	//   - sort purple versions of a skill last (to avoid counting towards the total cost)
	isPurpleSkill(a) - isPurpleSkill(b) || skilldata[a].rarity - skilldata[b].rarity || +b - +a
).reduce((groups, id) => {
	const groupId = skillmeta[id].groupId;
	if (groups.has(groupId)) {
		groups.get(groupId).push(id);
	} else {
		groups.set(groupId, [id]);
	}
	return groups;
}, new Map());

export function getActivateableSkills(skills: string[], horse: HorseState, course: CourseData, racedef: RaceParameters) {
	const parser = getParser();
	const h2 = buildBaseStats(horse, racedef.mood);
	const wholeCourse = new RegionList();
	wholeCourse.push(new Region(0, course.distance));
	return skills.filter(id => {
		let sd;
		try {
			sd = buildSkillData(h2, racedef, course, wholeCourse, parser, id, Perspective.Any);
		} catch (_) {
			return false;
		}
		return sd.some(trigger => trigger.regions.length > 0 && trigger.regions[0].start < 9999);
	});
}

export function getNullRow(skillid: string) {
	return {id: skillid, min: 0, max: 0, mean: 0, median: 0, results: [], runData: null};
}

function formatBasinn(info) {
	return info.getValue().toFixed(2).replace('-0.00', '0.00') + ' L';
}

function SkillNameCell(props) {
	return (
		<div class="chartSkillName">
			<img src={`/uma-tools/icons/${skillmeta[props.id].iconId}.png`} />
			<span><Text id={`skillnames.${props.id}`} /></span>
		</div>
	);
}

function scaleBaseCost(baseCost: number, hint: number) {
	return Math.floor(baseCost * (1 - (hint <= 3 ? 0.1 * hint : 0.3 + 0.05 * (hint - 3))));
}

function costForId(id, hints, owned) {
	const group = skillGroups.get(skillmeta[id].groupId);
	const existing = owned.get(skillmeta[id].groupId);
	let cost = 0;
	for (let i = 0; i < group.length; ++i) {
		if (group[i] != existing) {
			cost += scaleBaseCost(skillmeta[group[i]].baseCost, hints.get(group[i]));
		}
		if (group[i] == id) {
			break;
		}
	}
	return cost;
}

function SkillCostCell(props) {
	const [hints, setHints] = useLens(props.hintLevels);
	const hint = hints.get(props.id);
	const incrHint = useMemo(() => new (O.get(props.id))(x => x + 1), [props.id]);
	const decrHint = useMemo(() => new (O.get(props.id))(x => x - 1), [props.id]);
	return (
		<Fragment>
			<button class={`hintbtn hintDown${hint == 0 ? ' hintbtnDisabled' : ''}`} disabled={hint == 0}
				onClick={() => setHints(decrHint)}>
				<div class="hintbtnDummyBackground"></div>
				<span class="hintbtnText">−</span>
			</button>
			<span class="hintedCost">{costForId(props.id, hints, props.ownedSkills)}</span>
			<button class={`hintbtn hintUp${hint == 5 ? ' hintbtnDisabled' : ''}`} disabled={hint == 5}
				onClick={() => setHints(incrHint)}>
				<div class="hintbtnDummyBackground"></div>
				<span class="hintbtnText">+</span>
			</button>
			{hint > 0 && <span class="hintLevel">{hint}</span>}
		</Fragment>
	);
}

function headerRenderer(radioGroup, selectedType, type, text, onClick) {
	function click(e) {
		e.stopPropagation();
		onClick(type);
	}
	return (c) => (
		<div>
			<input type="radio" name={radioGroup} checked={selectedType == type} title={`Show ${text.toLowerCase()} on chart`} onClick={click} />
			<span onClick={c.header.column.getToggleSortingHandler()}>{text}</span>
		</div>
	);
}

export function BasinnChart(props) {
	const radioGroup = useId();
	const [selected, setSelected] = useState('');
	const [hints, setHints] = useLens(props.hintLevels);
	const [displayedRun, setDisplayedRun] = useLens(props.displayedRun);

	const columns = useMemo(() => [{
		header: (c) => <span onClick={c.header.column.getToggleSortingHandler()}>Skill name</span>,
		accessorKey: 'id',
		cell: (info) => <SkillNameCell id={info.getValue()} />,
		sortFn: (a,b) => skillnames[a.getValue('id')][0] < skillnames[b.getValue('id')][0] ? -1 : 1
	}, {
		header: headerRenderer(radioGroup, displayedRun, 'minrun', 'Minimum', setDisplayedRun),
		accessorKey: 'min',
		cell: formatBasinn
	}, {
		header: headerRenderer(radioGroup, displayedRun, 'maxrun', 'Maximum', setDisplayedRun),
		accessorKey: 'max',
		cell: formatBasinn,
		sortDescFirst: true
	}, {
		header: headerRenderer(radioGroup, displayedRun, 'meanrun', 'Mean', setDisplayedRun),
		accessorKey: 'mean',
		cell: formatBasinn,
		sortDescFirst: true
	}, {
		header: headerRenderer(radioGroup, displayedRun, 'medianrun', 'Median', setDisplayedRun),
		accessorKey: 'median',
		cell: formatBasinn,
		sortDescFirst: true
	}, {
		header: (c) => <span onClick={c.header.column.getToggleSortingHandler()}>SP Cost</span>,
		id: 'spcost',
		accessorFn: (row) => ({id: row.id}),
		cell: (info) => <SkillCostCell {...info.getValue()} hintLevels={props.hintLevels} ownedSkills={props.hasSkills} />,
		sortFn: (a,b) => {
			const ac = costForId(a.getValue('id'), hints, props.hasSkills),
				  bc = costForId(b.getValue('id'), hints, props.hasSkills);
			return +(bc < ac) - +(ac < bc);
		},
		sortDescFirst: false
	}, {
		header: (c) => <span onClick={c.header.column.getToggleSortingHandler()}>{CC_GLOBAL ? 'L / SP' : 'バ / SP'}</span>,
		id: 'bsp',
		accessorFn: (row) => row.mean / costForId(row.id, hints, props.hasSkills),
		cell: (info) => {
			const x = info.getValue();
			return <span>{isNaN(x) || Math.abs(x) == Infinity ? '--' : x.toFixed(6)}</span>;
		},
		sortDescFirst: true
	}], [displayedRun, hints, props.hasSkills]);  // including hints here is a bad hack to force the table to
	// rerender when hints changes (since it's not part of the actual table data). ditto with hasSkills, but note that
	// we should be passed the last run uma and not the current uma state, or else the chart will be out of date and the
	// sp costs will change but not basinn values until the chart is rerun. (see the commit message for
	// 21180cd49e56c54078c2bc837ae5bfc65809bb75)
	// TODO fixme. currently not part of the actual row data because we get that straight from the simulator output.

	const [sorting, setSorting] = useState<SortingState>([{id: 'mean', desc: true}]);

	const table = useTable({
		_features: tableFeatures({rowSortingFeature}),
		_rowModels: {sortedRowModel: createSortedRowModel(sortFns)},
		columns,
		data: props.data,
		onSortingChange: setSorting,
		enableSortingRemoval: false,
		state: {sorting}
	});

	function handleClick(e) {
		const tr = e.target.closest('tr');
		if (tr == null) return;
		e.stopPropagation();
		const id = tr.dataset.skillid;
		if (e.target.tagName == 'IMG') {
			props.onInfoClick(id);
		} else {
			setSelected(id);
			props.onSelectionChange(id);
		}
	}

	function handleDblClick(e) {
		const tr = e.target.closest('tr');
		if (tr == null) return;
		e.stopPropagation();
		const id = tr.dataset.skillid;
		props.onDblClickRow(id);
	}

	return (
		<div class={`basinnChartWrapper${props.dirty ? ' dirty' : ''}`}>
			<table class="basinnChart">
				<thead>
					{table.getHeaderGroups().map(headerGroup => (
						<tr key={headerGroup.id}>
							{headerGroup.headers.map(header => (
								<th key={header.id} colSpan={header.colSpan}>
									{!header.isPlaceholder && (
										<div
											class={`columnHeader ${({
												'asc': 'basinnChartSortedAsc',
												'desc': 'basinnChartSortedDesc',
												'false': ''
											})[header.column.getIsSorted()]}`}
											title={header.column.getCanSort() &&
												({
													'asc': 'Sort ascending',
													'desc': 'Sort descending',
													'false': 'Clear sort'
												})[header.column.getNextSortingOrder()]}>
											{flexRender(header.column.columnDef.header, header.getContext())}
										</div>
									)}
								</th>
							))}
						</tr>
					))}
				</thead>
				<tbody onClick={handleClick} onDblClick={handleDblClick}>
					{table.getRowModel().rows.map(row => {
						const id = row.getValue('id');
						return (
							<tr key={row.id} data-skillid={id} class={id == selected && 'selected'}>
								{row.getAllCells().map(cell => (
									<td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
								))}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
