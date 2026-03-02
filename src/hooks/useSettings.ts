import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReadingDirection, RecentFile, ViewMode } from "../types";

const STORAGE_KEY = "mekuri-settings";

type Settings = {
	direction: ReadingDirection;
	viewMode: ViewMode;
	recentFiles: RecentFile[];
};

const defaultSettings: Settings = {
	direction: "rtl",
	viewMode: "spread",
	recentFiles: [],
};

function loadSettings(): Settings {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			return { ...defaultSettings, ...JSON.parse(raw) };
		}
	} catch {
		// ignore
	}
	return defaultSettings;
}

function saveSettings(settings: Settings) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useSettings() {
	const [settings, setSettings] = useState<Settings>(loadSettings);

	useEffect(() => {
		saveSettings(settings);
	}, [settings]);

	const setDirection = useCallback((direction: ReadingDirection) => {
		setSettings((s) => ({ ...s, direction }));
	}, []);

	const setViewMode = useCallback((viewMode: ViewMode) => {
		setSettings((s) => ({ ...s, viewMode }));
	}, []);

	const toggleDirection = useCallback(() => {
		setSettings((s) => ({
			...s,
			direction: s.direction === "rtl" ? "ltr" : "rtl",
		}));
	}, []);

	const toggleViewMode = useCallback(() => {
		setSettings((s) => ({
			...s,
			viewMode: s.viewMode === "spread" ? "single" : "spread",
		}));
	}, []);

	const addRecentFile = useCallback(
		(path: string, name: string, lastPage = 0) => {
			setSettings((s) => {
				const filtered = s.recentFiles.filter((f) => f.path !== path);
				const updated = [
					{ path, name, lastOpened: Date.now(), lastPage },
					...filtered,
				].slice(0, 20);
				return { ...s, recentFiles: updated };
			});
		},
		[],
	);

	const updateLastPage = useCallback((path: string, lastPage: number) => {
		setSettings((s) => ({
			...s,
			recentFiles: s.recentFiles.map((f) =>
				f.path === path ? { ...f, lastPage } : f,
			),
		}));
	}, []);

	const removeRecentFile = useCallback((path: string) => {
		setSettings((s) => ({
			...s,
			recentFiles: s.recentFiles.filter((f) => f.path !== path),
		}));
	}, []);

	return useMemo(
		() => ({
			direction: settings.direction,
			viewMode: settings.viewMode,
			recentFiles: settings.recentFiles,
			setDirection,
			setViewMode,
			toggleDirection,
			toggleViewMode,
			addRecentFile,
			updateLastPage,
			removeRecentFile,
		}),
		[
			settings.direction,
			settings.viewMode,
			settings.recentFiles,
			setDirection,
			setViewMode,
			toggleDirection,
			toggleViewMode,
			addRecentFile,
			updateLastPage,
			removeRecentFile,
		],
	);
}
