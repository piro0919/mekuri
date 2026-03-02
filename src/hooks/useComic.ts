import { useCallback, useMemo, useRef, useState } from "react";
import { getPage, openComicMeta } from "../lib/tauri";
import type { ComicPage } from "../types";

const PREFETCH_RANGE = 2;
const MAX_CACHED_PAGES = 10;

export function useComic() {
	const [pageCount, setPageCount] = useState(0);
	const [currentPage, setCurrentPage] = useState(0);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [filePath, setFilePath] = useState<string | null>(null);
	const [pageCache, setPageCache] = useState<Map<number, ComicPage>>(new Map());
	const fetchingRef = useRef<Set<number>>(new Set());
	const filenamesRef = useRef<string[]>([]);

	const fetchPage = useCallback(
		async (path: string, index: number, count: number) => {
			if (index < 0 || index >= count || fetchingRef.current.has(index)) {
				return;
			}

			const filename = filenamesRef.current[index];
			if (!filename) return;

			fetchingRef.current.add(index);

			try {
				const page = await getPage(path, index, filename);
				setPageCache((prev) => {
					const next = new Map(prev);
					next.set(index, page);

					// Evict pages farthest from current view if cache is too large
					if (next.size > MAX_CACHED_PAGES) {
						const keys = [...next.keys()];
						keys.sort((a, b) => Math.abs(b - index) - Math.abs(a - index));
						while (next.size > MAX_CACHED_PAGES) {
							const farthest = keys.shift();
							if (farthest !== undefined) next.delete(farthest);
						}
					}

					return next;
				});
			} catch (e) {
				console.error(`Failed to load page ${index}:`, e);
			} finally {
				fetchingRef.current.delete(index);
			}
		},
		[],
	);

	const prefetchAround = useCallback(
		(path: string, page: number, count: number) => {
			for (
				let i = Math.max(0, page - PREFETCH_RANGE);
				i <= Math.min(count - 1, page + PREFETCH_RANGE + 1);
				i++
			) {
				// Check cache and fetching state directly via refs/state getter
				// to avoid side effects inside setState updaters
				if (!fetchingRef.current.has(i)) {
					setPageCache((prev) => {
						if (prev.has(i)) return prev;
						fetchPage(path, i, count);
						return prev;
					});
				}
			}
		},
		[fetchPage],
	);

	const load = useCallback(
		async (path: string, startPage = 0) => {
			setLoading(true);
			setError(null);
			setPageCache(new Map());
			fetchingRef.current = new Set();
			filenamesRef.current = [];
			try {
				const meta = await openComicMeta(path);
				const count = meta.page_count;
				filenamesRef.current = meta.filenames;
				setPageCount(count);
				setFilePath(path);
				const start = Math.min(startPage, count - 1);
				setCurrentPage(start);

				// Eagerly fetch the first visible page
				const firstPage = await getPage(path, start, meta.filenames[start]);
				setPageCache(new Map([[start, firstPage]]));

				// Prefetch adjacent pages
				prefetchAround(path, start, count);
			} catch (e) {
				setError(String(e));
			} finally {
				setLoading(false);
			}
		},
		[prefetchAround],
	);

	const close = useCallback(() => {
		setPageCount(0);
		setCurrentPage(0);
		setFilePath(null);
		setError(null);
		setPageCache(new Map());
		fetchingRef.current = new Set();
		filenamesRef.current = [];
	}, []);

	const goTo = useCallback(
		(page: number) => {
			const clamped = Math.max(0, Math.min(page, pageCount - 1));
			setCurrentPage(clamped);
			if (filePath) {
				prefetchAround(filePath, clamped, pageCount);
			}
		},
		[pageCount, filePath, prefetchAround],
	);

	const next = useCallback(
		(step = 1) => {
			setCurrentPage((p) => {
				const newPage = Math.min(p + step, pageCount - 1);
				if (filePath) {
					prefetchAround(filePath, newPage, pageCount);
				}
				return newPage;
			});
		},
		[pageCount, filePath, prefetchAround],
	);

	const prev = useCallback(
		(step = 1) => {
			setCurrentPage((p) => {
				const newPage = Math.max(p - step, 0);
				if (filePath) {
					prefetchAround(filePath, newPage, pageCount);
				}
				return newPage;
			});
		},
		[pageCount, filePath, prefetchAround],
	);

	const currentPageData = pageCache.get(currentPage) ?? null;
	const nextPageData = pageCache.get(currentPage + 1) ?? null;
	const isPageLoading = !currentPageData;

	return useMemo(
		() => ({
			pageCount,
			currentPage,
			loading,
			error,
			filePath,
			currentPageData,
			nextPageData,
			isPageLoading,
			load,
			close,
			goTo,
			next,
			prev,
		}),
		[
			pageCount,
			currentPage,
			loading,
			error,
			filePath,
			currentPageData,
			nextPageData,
			isPageLoading,
			load,
			close,
			goTo,
			next,
			prev,
		],
	);
}
