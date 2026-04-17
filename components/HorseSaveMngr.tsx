import { h, Fragment } from 'preact';
import { useState, useMemo, useEffect } from 'preact/hooks';
import { memo } from 'preact/compat';
import { IntlProvider, Text } from 'preact-i18n';

import {
	ColumnDef, SortFn, SortingState, RowSelectionState,
	createSortedRowModel, flexRender, rowSortingFeature, sortFns, rowSelectionFeature, tableFeatures, useTable
} from '@tanstack/preact-table';
import { openDB } from 'idb';

import { O, State, makeState, useLens, useGetter } from '../optics';

import { HorseState, DEFAULT_HORSE_STATE, serializeUma, deserializeUma } from './HorseDefTypes';
import { HorseDef } from './HorseDef';
import { scoreUma, RankThresholds } from './scorecalc';

import './HorseSaveMngr.css';

import icons from '../icons.json';

interface SavedUma {
	id: number,
	title: string,
	modified: Date,
	lastUsed: Date,
	score: number,
	uma: HorseState
}

const db = {
	conn: openDB('savedUmas', 1, {
		upgrade(db) {
			const store = db.createObjectStore('umas', {
				keyPath: 'id',
				autoIncrement: true
			});
			store.createIndex('modified', 'modified', {unique: false});
			store.createIndex('recent', 'lastUsed', {unique: false});
			store.createIndex('outfitId', 'uma.outfitId', {unique: false});
		}
	}),
	listeners: new Set()
};

export function useSavedUmas(query, deps) {
	const [cached, setCached] = useState([]);
	useEffect(() => {
		async function doQuery() {
			const conn = await db.conn;
			const tx = conn.transaction('umas', 'readonly');
			const results = [];
			for await (const cursor of query(tx.objectStore('umas'))) {
				results.push(cursor.value);
			}
			await tx.done;
			setCached(results);
		}
		db.listeners.add(doQuery);
		doQuery();
		return () => db.listeners.delete(doQuery);
	}, deps);
	return cached;
}

export async function saveUma(title: string, uma: HorseState) {
	const conn = await db.conn;
	const tx = conn.transaction('umas', 'readwrite');
	const now = new Date();
	await tx.store.add({title, uma: serializeUma(uma), score: scoreUma(uma), modified: now, lastUsed: now});
	await tx.done;
	db.listeners.forEach(fn => fn());
}

export async function removeSavedUma(id: number) {
	const conn = await db.conn;
	const tx = conn.transaction('umas', 'readwrite');
	await tx.store.delete(id);
	await tx.done;
	db.listeners.forEach(fn => fn());
}

async function setSavedTitle(id: number, title: string) {
	const conn = await db.conn;
	const tx = conn.transaction('umas', 'readwrite');
	const u = await tx.store.get(id);
	u.title = title;
	await tx.store.put(u);
	await tx.done;
	db.listeners.forEach(fn => fn());
}

export function HorseSaveManager(props) {
	// this is kind of ugly; really we should be passed the draft as an object and not a lens
	// the only reason it works like this is that we don't want to have `useGetter(props.state)` in HorseDef,
	// which would force a rerender on every change, even if it only uses the full state to pass here as `draft`
	// so instead we reify the lens here (which only renders if the save manager is open), and then immediately
	// pass it into a new state which we use for displaying it
	// TODO this feels wrong
	// if we ever force score display on in HorseDef in all cases then it has to unconditionally reify its entire
	// state anyway, so we could simplify this
	// alternatively, we should really add a read-only option to HorseDef, in which case we can just pass it the
	// lens that we got directly?
	const draft_ = useGetter(props.draft);
	const state = makeState(() => ({draft: DEFAULT_HORSE_STATE}));
	const [draft, setDraft] = useLens(O.draft, state);
	const [title, setTitle] = useState('');
	// TODO yuck
	useEffect(() => {
		setDraft(draft_);
		setTitle('Untitled Umamusume ' + new Date().toLocaleDateString());
	}, [draft_]);
	const savedUmas = useSavedUmas(store => store.index('modified').iterate(null, 'prev'), []);
	const [editing, setEditing] = useState(-1);

	function updateTitle(e) {
		setSavedTitle(editing, e.currentTarget.value);
		setEditing(-1);
	}

	const columns = useMemo(() => [{
		header: (c) => <span>Name</span>,
		id: 'title',
		accessorFn: (row) => ({id: row.id, outfitId: row.uma.outfitId, title: row.title}),
		cell: (info) => {
			const {id, outfitId, title} = info.getValue();
			return <div>
				{outfitId && <img src={`/uma-tools/icons/chara/${icons[outfitId][1]}.png`} height="24" width="24" loading="lazy" />}
					   {id == editing ? <input type="text" value={title} ref={el => {if(el){el.focus();el.select();}}} onBlur={updateTitle} onKeyDown={e => e.key == 'Enter' && e.target.blur()} /> : <span>{title}</span>}
				{id != editing && <button class="circleBtn btnType2">✎</button>}
			</div>;
		}
	}, {
		header: (c) => <span>Score</span>,
		accessorKey: 'score',
		cell: (info) => {
			const score = info.getValue();
			const rankIdx = RankThresholds.findIndex(x => x > score);
			return <div>
				<img src={`/uma-tools/icons/rank/utx_txt_rank_${rankIdx}.png`} height="24" width="24" loading="lazy" />
				<span>{score}</span>
			</div>;
		}
	}, {
		header: (c) => <span>Saved At</span>,
		accessorKey: 'modified',
		cell: (info) => info.getValue().toLocaleString()
	}, {
		header: (c) => <span>Actions</span>,
		id: 'actions',
		cell: (info) => <button class="pillBtn btnType2">Remove</button>
	}], [editing]);

	const [sorting, setSorting] = useState<SortingState>([{id: 'modified', desc: true}]);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

	const table = useTable({
		_features: tableFeatures({rowSortingFeature, rowSelectionFeature}),
		_rowModels: {sortedRowModel: createSortedRowModel(sortFns)},
		columns,
		data: savedUmas,
		getRowId: (row) => row.id,
		onSortingChange: setSorting,
		enableSortingRemoval: false,
		onRowSelectionChange: setRowSelection,
		state: {sorting, rowSelection}
	});

	function handleClick(e) {
		const tr = e.target.closest('tr');
		if (tr == null) return;
		const id = +tr.dataset.id;
		if (e.target.tagName != 'INPUT') setEditing(-1);
		if (e.target.closest('.pillBtn') != null) {
			removeSavedUma(id);
		} else if (e.target.closest('.circleBtn') != null) {
			setEditing(id);
		} else if (e.target.tagName == 'INPUT') {
			// do nothing
		} else {
			table.setRowSelection({[id]: true});
			setDraft(deserializeUma(savedUmas.find(u => u.id == id).uma));
		}
	}

	return (
		<div class="horseSaveMngr">
			<div>
				<State.Provider value={state}>
					<HorseDef key={draft.outfitId} state={O.draft} aptitudesMode="simulation" course={null} showPolicyEd={true} showOcr={false} showSaveMngr={false} tabstart={() => 1}>
						{title}
					</HorseDef>
				</State.Provider>
				<div class="savedHorseTableWrapper">
					<table class="savedHorseTable">
						<thead>
							{table.getHeaderGroups().map(headerGroup => (
								<tr key={headerGroup.id}>
									{headerGroup.headers.map(header => (
										<th key={header.id} colSpan={header.colSpan}>
										{!header.isPlaceholder && (
											<div
												class={`columnHeader ${({
													'asc': 'savedHorseTableSortedAsc',
													'desc': 'savedHorseTableSortedDesc',
													'false': ''
												})[header.column.getIsSorted()]}`}
												title={header.column.getCanSort() ?
													({
														'asc': 'Sort ascending',
														'desc': 'Sort descending',
														'false': 'Clear sort'
													})[header.column.getNextSortingOrder()] : ''}
												onClick={header.column.getToggleSortingHandler()}>
												{flexRender(header.column.columnDef.header, header.getContext())}
											</div>
										)}
										</th>
									))}
								</tr>
							))}
						</thead>
						<tbody onClick={handleClick}>
							{table.getRowModel().rows.map(row => (
								<tr key={row.id} data-id={row.id} class={row.getIsSelected() && 'selected'}>
									{row.getAllCells().map(cell => (
										<td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
			<div>
				<button class="stdBtn btnType2" onClick={props.onClose}>Close</button>
				<button class="stdBtn btnType1" onClick={() => saveUma(title, draft)}>Save</button>
				<button class="stdBtn btnType1" onClick={() => props.onLoad(draft)}>Load</button>
			</div>
		</div>
	);
}
