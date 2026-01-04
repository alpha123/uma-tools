import { createContext } from 'preact';
import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, useContext } from 'preact/hooks';

type HasPath<P extends any[]> = {
	[K in P[0]]: P extends [any, ...infer Cdr] ? Cdr['length'] extends 0 ? any : HasPath<Cdr> : never;
}

type AtPath<T, P extends any[]> = P extends [infer Car, ...infer Cdr] ? Car extends keyof T ? Cdr['length'] extends 0 ? T[Car] : AtPath<T[Car], Cdr> : unknown : T;
type AtPathEquals<S, P extends any[], A> = A extends AtPath<S, P> ? S : never;

// this doesn't quite work, but it almost does
export type Lens<P extends (string | symbol)[]> = {
	[K: string]: Lens<[...P, typeof K]>
	<S extends HasPath<P>>(o: S): AtPath<S, P>
	new<A,B>(f: (x: A) => B): <S extends HasPath<P>, T=S>(o: S & AtPathEquals<S, P, A>) => T & AtPathEquals<T, P, B>
} & {
	// TODO this really needs to modify P obviously
	get<K>(k: K): Lens<P>
};

interface _Lens {
	// I give up
	get(o: any): any
	update(f: (x: any) => any, o: any): any
}

function theLens<A>(x:A):A { return x; }

export const Delete = Symbol();

function Kify(x) {
	return typeof x != 'function' ? () => x : x;
}

function iso<S,T,A,B>(path: any[], from: (x: S) => A, to: (x: B) => T) {
	return o([...path, {
		get(o) { return from(o); },
		update(f: (x: A) => B, o: S): T {
			return to(f(from(o)));
		},
		invert() {
			return iso(path, to, from);
		}
	}]);
}

function o<P extends (string | symbol)[]>(path: (string | symbol | _Lens)[]): Lens<P> {
	const memo = Object.create(null);
	return new Proxy(theLens as unknown as any, {
		get(target, prop, _recv) {
			if (prop == '_iso') {
				return function <S,T,A,B>(from: (x: S) => A, to: (x: B) => T) {
					return iso(path, from, to);
				};
			} else if (prop == '_lens') {
				return function <S,T,A,B>(get: (x: S) => A, update: (f: (x: A) => B, o: S) => T) {
					return o([...path, {get, update}]);
				};
			} else if (prop == '_from') {
				if (typeof path[path.length-1] == 'object' && path[path.length-1].invert != null) {
					return path[path.length-1].invert();
				} else {
					throw new Error('not an iso');
				}
			} else if (prop == '_to') {
				return function <S,A>(to: (x: S) => A) {
					return o([...path, {
						get(x) { return to(x); },
						update(_0, _1): never { throw new Error('attempted to set a getter'); }
					}]);
				};
			} else if (prop == '_sets') {
				return function <S,T,A,B>(update: (f: (x: A) => B, o: S) => T) {
					return o([...path, {
						get(_) { throw new Error('attempted to get a setter'); },
						update
					}]);
				};
			} else if (prop == 'get') {
				// do not memoize get or has as the key may be dynamically provided and the key space is large and
				// effectively unlimited, which could result in a type of memory leak
				return function <K>(k: K) {
					return o([...path, {
						get(m) { return m.get(k); },
						update<V>(f: (x: V | undefined) => V, m: Map<K,V>): Map<K,V> {
							const m1 = new Map(m);
							const x = f(m.get(k));
							if (x == Delete) {
								m1.delete(k);
							} else {
								m1.set(k, x);
							}
							return m1;
						}
					}]);
				};
			} else if (prop == 'has') {
				return function <K>(k: K) {
					return o([...path, {
						get(s) { return s.has(k); },
						update(f: (exists: boolean) => boolean, s: Set<K>): Set<K> {
							const s1 = new Set(s);
							if (f(s.has(k))) {
								s1.add(k);
							} else {
								s1.delete(k);
							}
							return s1;
						}
					}]);
				};
			} else if (prop == 'push') {
				return function () {
					return Object.hasOwn(memo, 'push') ? memo.push : (memo.push = o([...path, {
						get(_) { throw new Error('attempted to get a setter'); },
						update<E>(f: () => E, a: E[]): E[] {
							return [...a, f()];
						}
					}]));
				};
			} else if (+prop === +prop) {
				// don't cache numeric properties for the same reason as get()/has() above
				// note that +prop === +prop is also true for the empty string but this doesn't really matter
				return o<[...P, typeof prop]>([...path, prop]);
			} else {
				return Object.hasOwn(memo, prop) ? memo[prop] : (memo[prop] = o<[...P, typeof prop]>([...path, prop]));
			}
		},
		apply(target, _this, args) { return path.reduce((o,p) => typeof p == 'object' ? p.get(o) : o[p], args[0]); },
		construct(target, args){
			function h(fn: any, o: any, p: any): any {
				const k = p[0];
				if (typeof k == 'object') {
					return k.update(p.length == 1 ? fn : (x: any) => h(fn, x, p.slice(1)), o);
				} else if (Array.isArray(o)) {
					const a = o.slice();
					a[k] = p.length == 1 ? fn(o[k]) : h(fn, o[k], p.slice(1));
					return a;
				} else {
					const newo = Object.create(Object.getPrototypeOf(o));
					Object.keys(o).forEach(p => newo[p] = o[p]);
					newo[k] = p.length == 1 ? fn(o[k]) : h(fn, o[k], p.slice(1));
					return newo;
				}
			}
			return args.length == 0 ? (fn: any, o: any) => h(Kify(fn), o, path) : (o: any) => h(Kify(args[0]), o, path)
		}
	}) as Lens<P>;
}

export const O = o<[]>([]);

export function c(...fns) {
	return (x) => fns.reduceRight((x,f) => f(x), x);
}

export function K<A>(x: A): () => A { return () => x; }

export function id<A>(x: A): A { return x; }

// NB.
// const personName = O.person.name as unknown as Lens<['person', 'name']>;
// const jack = {person: {name: 'Jack'}};
// personName(jack) == 'Jack';
// const makeZysta = new personName((_: string) => 'Zysta');
// const zysta = makeZysta(jack);
// zysta.person.name == 'Zysta';

export const State = createContext(null);

export function makeState(getState) {
	const ref = useRef(null);
	if (ref.current == null) {
		ref.current = {state: getState(), listeners: new Set()};
	}
	const setState = useCallback((newState) => {
		ref.current.listeners.forEach(cb => cb(newState));
		ref.current.state = newState;
	}, []);
	return {ref, setState};
}

function reactGetter(l, ref) {
	const [cached, forceUpdate] = useState(() => l(ref.current.state));
	useEffect(() => {
		let prev = l(ref.current.state);
		function subscribe(newState) {
			const next = l(newState);
			if (!Object.is(prev, next)) {
				prev = next;
				forceUpdate(next);
			}
		}
		const listeners = ref.current.listeners;
		listeners.add(subscribe);
		return () => listeners.delete(subscribe);
	}, [l, ref.current]);
	return cached;
}

function reactSetter(l, ref, setState) {
	const setter = useMemo(() => new l(), [l]);
	return (f) => setState(setter(f, ref.current.state));
}

export function useLens(l) {
	const {ref, setState} = useContext(State);
	return [reactGetter(l, ref), reactSetter(l, ref, setState)];
}

export function useGetter(l) {
	const {ref} = useContext(State);
	return reactGetter(l, ref);
}

export function useSetter(l) {
	const {ref, setState} = useContext(State);
	return reactSetter(l, ref, setState);
}
