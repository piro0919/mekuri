export type ComicPage = {
	index: number;
	filename: string;
	data_url: string;
	width: number;
	height: number;
};

export type ComicMeta = {
	filenames: string[];
	page_count: number;
};

export type ReadingDirection = "rtl" | "ltr";

export type ViewMode = "single" | "spread";

export type RecentFile = {
	path: string;
	name: string;
	lastOpened: number;
	lastPage: number;
};
