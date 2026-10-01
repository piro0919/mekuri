import { useCallback, useMemo, useRef, useState } from "react";
import { openComicMeta, pageUrl } from "../lib/tauri";
import type { ComicPage } from "../types";

const PREFETCH_RANGE = 2;
const MAX_CACHED_PAGES = 10;

/**
 * Fetch and decode a page before it is shown. The viewer needs its size to
 * lay out spreads, and once decoded the webview has it in cache for the
 * `<img>` that follows.
 */
function loadImage(src: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () =>
			resolve({ width: img.naturalWidth, height: img.naturalHeight });
		img.onerror = () => reject(new Error(`Failed to load ${src}`));
		img.src = src;
	});
}

export function useComic() {
	const [pageCount, setPageCount] = useState(0);
	const [currentPage, setCurrentPage] = useState(0);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [filePath, setFilePath] = useState<string | null>(null);
	const [pageCache, setPageCache] = useState<Map<number, ComicPage>>(new Map());
	const fetchingRef = useRef<Set<number>>(new Set());
	const filenamesRef = useRef<string[]>([]);
	// Which open of the backend the page URLs belong to; null when closed.
	const generationRef = useRef<number | null>(null);

	const storePage = useCallback((page: ComicPage) => {
		setPageCache((prev) => {
			const next = new Map(prev);
			next.set(page.index, page);

			// Evict pages farthest from current view if cache is too large
			if (next.size > MAX_CACHED_PAGES) {
				const keys = [...next.keys()];
				keys.sort(
					(a, b) => Math.abs(b - page.index) - Math.abs(a - page.index),
				);
				while (next.size > MAX_CACHED_PAGES) {
					const farthest = keys.shift();
					if (farthest !== undefined) next.delete(farthest);
				}
			}

			return next;
		});
	}, []);

	const fetchPage = useCallback(
		async (index: number, count: number) => {
			const generation = generationRef.current;
			if (
				generation === null ||
				index < 0 ||
				index >= count ||
				fetchingRef.current.has(index)
			) {
				return;
			}

			const filename = filenamesRef.current[index];
			if (!filename) return;

			const fetching = fetchingRef.current;
			fetching.add(index);

			try {
				const src = pageUrl(generation, index);
				const { width, height } = await loadImage(src);
				// Another comic was opened while this page was loading.
				if (generationRef.current !== generation) return;
				storePage({ index, filename, src, width, height });
			} catch (e) {
				console.error(`Failed to load page ${index}:`, e);
			} finally {
				fetching.delete(index);
			}
		},
		[storePage],
	);

	const prefetchAround = useCallback(
		(page: number, count: number) => {
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
						fetchPage(i, count);
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
			generationRef.current = null;
			try {
				const meta = await openComicMeta(path);
				const count = meta.page_count;
				if (count === 0) {
					throw new Error("No images found");
				}
				filenamesRef.current = meta.filenames;
				generationRef.current = meta.generation;
				setPageCount(count);
				setFilePath(path);
				const start = Math.min(startPage, count - 1);
				setCurrentPage(start);

				// Eagerly fetch the first visible page
				const src = pageUrl(meta.generation, start);
				const { width, height } = await loadImage(src);
				setPageCache(
					new Map([
						[
							start,
							{
								index: start,
								filename: meta.filenames[start],
								src,
								width,
								height,
							},
						],
					]),
				);

				// Prefetch adjacent pages
				prefetchAround(start, count);
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
		generationRef.current = null;
	}, []);

	const goTo = useCallback(
		(page: number) => {
			const clamped = Math.max(0, Math.min(page, pageCount - 1));
			setCurrentPage(clamped);
			if (filePath) {
				prefetchAround(clamped, pageCount);
			}
		},
		[pageCount, filePath, prefetchAround],
	);

	const next = useCallback(
		(step = 1) => {
			setCurrentPage((p) => {
				const newPage = Math.min(p + step, pageCount - 1);
				if (filePath) {
					prefetchAround(newPage, pageCount);
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
					prefetchAround(newPage, pageCount);
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
