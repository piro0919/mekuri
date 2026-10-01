import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { ComicMeta } from "../types";

export async function openComicMeta(path: string): Promise<ComicMeta> {
	return invoke<ComicMeta>("open_comic_meta", { path });
}

// Pages are served by Rust over the `mekuri` URI scheme instead of riding
// IPC as base64. convertFileSrc gives the scheme's base in whichever form
// this platform needs: `mekuri://localhost/` on macOS and Linux,
// `http://mekuri.localhost/` on Windows and Android.
//
// The generation changes with every comic opened, so a URL never points at
// a page of a different comic, and the webview cannot serve a stale one.
export function pageUrl(generation: number, index: number): string {
	return `${convertFileSrc("", "mekuri")}page/${generation}/${index}`;
}
