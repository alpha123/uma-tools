import { h, Fragment } from 'preact';
import { useState, useMemo, useEffect, useRef, useId } from 'preact/hooks';
import { memo } from 'preact/compat';
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
import { SkillCost, costForId } from '../components/SkillList';
import { runComparison } from './compare';

import './BasinnChart.css';

import icons from '../icons.json';
import skilldata from '../uma-skill-tools/data/skill_data.json';
import skillnames from '../uma-skill-tools/data/skillnames.json';
import skillmeta from '../skill_meta.json';

export function getActivateableSkills(skills: string[], horse: HorseState, course: CourseData, racedef: RaceParameters) {
	const parser = getParser();
	const h2 = buildBaseStats(horse);
	const wholeCourse = new RegionList();
	wholeCourse.push(new Region(0, course.distance));
	return skills.filter(id => {
		let sd;
		try {
			sd = buildSkillData(h2, h2, racedef, course, wholeCourse, parser, id, Perspective.Any);
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

function outfitIdForUniqueSkill(sid: keyof typeof skilldata) {
	if (sid.length > 6) return outfitIdForUniqueSkill(sid.slice(2));  // evolved unique inherits are 9\d + un-inherited id
	return (100000 + +sid.slice(2,-1) * 100 + +sid.slice(1,2) + 1).toString();
}

const SkillNameCell = memo(function SkillNameCell(props) {
	const r = skilldata[props.id].rarity;
	return (
		<div class="chartSkillName">
			{props.dismissable && <span class="chartSkillDismiss">✕</span>}
			<img src={`/uma-tools/icons/skill/utx_ico_skill_${skillmeta[props.id].iconId}.png`} />
			{(r >= 3 && r <= 5 || props.id[0] == '9') && <img src={`/uma-tools/icons/chara/${icons[outfitIdForUniqueSkill(props.id)][+(props.id[0] != '9')]}.png`} loading="lazy" />}
			<span><Text id={`skillnames.${props.id}`} /></span>
		</div>
	);
});

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
		cell: (info) => <SkillNameCell id={info.getValue()} dismissable={!!props.dismissable} />,
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
		cell: (info) => <SkillCost {...info.getValue()} hints={props.hintLevels} ownedSkills={props.hasSkills} />,
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
			return <span>{Number.isFinite(x) ? x.toFixed(6) : '--'}</span>;
		},
		sortFn: (a,b) => {
			const x = a.getValue('bsp'), y = b.getValue('bsp');
			const xf = Number.isFinite(x), yf = Number.isFinite(y);
			return xf && yf ? +(y < x) - +(x < y) : +xf - +yf;
		},
		sortDescFirst: true
	}], [displayedRun, hints, props.hasSkills, props.dismissable]);
	// including hints here is a bad hack to force the table to rerender when hints changes (since it's not part of the
	// actual table data). ditto with hasSkills, but note that we should be passed the last run uma and not the current
	// uma state, or else the chart will be out of date and the sp costs will change but not basinn values until the
	// chart is rerun. (see the commit message for 21180cd49e56c54078c2bc837ae5bfc65809bb75)
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
		if (e.target.matches('img:first-of-type')) {
			props.onInfoClick(id);
		} else if (e.target.classList.contains('chartSkillDismiss')) {
			props.onSkillDismiss(id);
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

	const root = useRef(null);
	const inView = useRef(new Map());
	const [_obj, forceRerender] = useState(false);
	const obs = useMemo(function () {
		return new IntersectionObserver((entries) => {
			entries.forEach(entry => inView.current.set(entry.target.dataset.skillid, entry.isIntersecting));
			forceRerender({});
		}, {
			root: root.current,
			rootMargin: "68px 0px 68px 0px"
		});
	}, [props.data]);
	useEffect(() => () => obs.disconnect(), [props.data]);

	return (
		<div class={`basinnChartWrapper${props.dirty ? ' dirty' : ''}`} ref={root}>
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
						if (inView.current.get(id)) {
							return (
								<tr key={row.id} data-skillid={id} class={id == selected && 'selected'}>
									{row.getAllCells().map(cell => (
										<td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
									))}
								</tr>
							);
						} else {
							return <tr key={row.id} data-skillid={id} ref={el => el && obs.observe(el)}><Text id={`skillnames.${id}`} /></tr>
						}
					})}
				</tbody>
			</table>
		</div>
	);
}
