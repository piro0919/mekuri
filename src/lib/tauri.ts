import { invoke } from "@tauri-apps/api/core";
import type { ComicMeta, ComicPage } from "../types";

export async function openComicMeta(path: string): Promise<ComicMeta> {
	return invoke<ComicMeta>("open_comic_meta", { path });
}

export async function getPage(
	path: string,
	index: number,
	filename: string,
): Promise<ComicPage> {
	return invoke<ComicPage>("get_page", { path, index, filename });
}
