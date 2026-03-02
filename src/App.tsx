import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect } from "react";
import { Library } from "./components/Library";
import { Viewer } from "./components/Viewer";
import { useComic } from "./hooks/useComic";
import { useSettings } from "./hooks/useSettings";
import type { RecentFile } from "./types";

const SUPPORTED_EXTENSIONS = ["cbz", "zip", "cbr", "rar"];

function isSupportedPath(path: string): boolean {
	const filename = path.split("/").pop() ?? "";
	if (!filename.includes(".")) return true; // no extension = likely a directory
	const ext = filename.split(".").pop()?.toLowerCase();
	return !ext || SUPPORTED_EXTENSIONS.includes(ext);
}

function App() {
	const comic = useComic();
	const settings = useSettings();

	const handleOpenFile = useCallback(async () => {
		const selected = await open({
			multiple: false,
			filters: [
				{
					name: "Comic files",
					extensions: SUPPORTED_EXTENSIONS,
				},
			],
			directory: false,
		});

		if (selected) {
			await comic.load(selected);
			const name =
				selected
					.split("/")
					.pop()
					?.replace(/\.[^.]+$/, "") ?? "Unknown";
			settings.addRecentFile(selected, name);
		}
	}, [comic.load, settings.addRecentFile]);

	const handleOpenFolder = useCallback(async () => {
		const selected = await open({
			multiple: false,
			directory: true,
		});

		if (selected) {
			await comic.load(selected);
			const name = selected.split("/").pop() ?? "Unknown";
			settings.addRecentFile(selected, name);
		}
	}, [comic.load, settings.addRecentFile]);

	const handleOpenRecent = useCallback(
		async (file: RecentFile) => {
			await comic.load(file.path, file.lastPage);
			settings.addRecentFile(file.path, file.name, file.lastPage);
		},
		[comic.load, settings.addRecentFile],
	);

	// Save reading position when page changes
	useEffect(() => {
		if (comic.filePath) {
			settings.updateLastPage(comic.filePath, comic.currentPage);
		}
	}, [comic.currentPage, comic.filePath, settings.updateLastPage]);

	// Menu event listener
	useEffect(() => {
		const unlisten = listen<string>("menu-event", (event) => {
			switch (event.payload) {
				case "open-file":
					handleOpenFile();
					break;
				case "open-folder":
					handleOpenFolder();
					break;
				case "toggle-direction":
					settings.toggleDirection();
					break;
				case "toggle-view-mode":
					settings.toggleViewMode();
					break;
			}
		});
		return () => {
			unlisten.then((fn) => fn());
		};
	}, [
		handleOpenFile,
		handleOpenFolder,
		settings.toggleDirection,
		settings.toggleViewMode,
	]);

	// Drag & drop support (Tauri v2 native API)
	useEffect(() => {
		let unlisten: (() => void) | undefined;

		getCurrentWebview()
			.onDragDropEvent(async (event) => {
				if (event.payload.type === "drop") {
					const path = event.payload.paths[0];
					if (!path) return;

					if (!isSupportedPath(path)) return;

					await comic.load(path);
					const name =
						path
							.split("/")
							.pop()
							?.replace(/\.[^.]+$/, "") ?? "Unknown";
					settings.addRecentFile(path, name);
				}
			})
			.then((fn) => {
				unlisten = fn;
			});

		return () => {
			unlisten?.();
		};
	}, [comic.load, settings.addRecentFile]);

	if (comic.loading) {
		return (
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					height: "100vh",
					background: "var(--bg-main)",
					color: "var(--text-secondary)",
					fontSize: 14,
				}}
			>
				Loading...
			</div>
		);
	}

	if (comic.error) {
		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					height: "100vh",
					background: "var(--bg-main)",
					gap: 12,
				}}
			>
				<p style={{ color: "#FF453A", fontSize: 14 }}>{comic.error}</p>
				<button
					type="button"
					onClick={comic.close}
					style={{
						background: "var(--bg-card)",
						border: "1px solid var(--border-color)",
						borderRadius: 6,
						padding: "6px 16px",
						color: "var(--text-primary)",
						cursor: "pointer",
						fontSize: 13,
					}}
				>
					Back
				</button>
			</div>
		);
	}

	if (comic.pageCount > 0) {
		return (
			<Viewer
				pageCount={comic.pageCount}
				currentPage={comic.currentPage}
				currentPageData={comic.currentPageData}
				nextPageData={comic.nextPageData}
				direction={settings.direction}
				viewMode={settings.viewMode}
				onNext={comic.next}
				onPrev={comic.prev}
				onGoTo={comic.goTo}
				onClose={comic.close}
				onDirectionChange={settings.setDirection}
				onViewModeChange={settings.setViewMode}
			/>
		);
	}

	return (
		<Library
			recentFiles={settings.recentFiles}
			direction={settings.direction}
			viewMode={settings.viewMode}
			onOpenFile={handleOpenFile}
			onOpenFolder={handleOpenFolder}
			onOpenRecent={handleOpenRecent}
			onRemoveRecent={settings.removeRecentFile}
			onDirectionChange={settings.setDirection}
			onViewModeChange={settings.setViewMode}
		/>
	);
}

export default App;
