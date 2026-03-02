import { BookOpen, FolderOpen, ImageIcon, Trash2 } from "lucide-react";
import type { ReadingDirection, RecentFile, ViewMode } from "../types";

type Props = {
	recentFiles: RecentFile[];
	direction: ReadingDirection;
	viewMode: ViewMode;
	onOpenFile: () => void;
	onOpenFolder: () => void;
	onOpenRecent: (file: RecentFile) => void;
	onRemoveRecent: (path: string) => void;
	onDirectionChange: (dir: ReadingDirection) => void;
	onViewModeChange: (mode: ViewMode) => void;
};

function formatDate(ts: number) {
	return new Date(ts).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function Library({
	recentFiles,
	direction,
	viewMode,
	onOpenFile,
	onOpenFolder,
	onOpenRecent,
	onRemoveRecent,
	onDirectionChange,
	onViewModeChange,
}: Props) {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				height: "100vh",
				background: "var(--bg-main)",
			}}
		>
			{/* Header */}
			<div
				style={{
					padding: "20px 24px 12px",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				<h1 style={{ fontSize: 20, fontWeight: 600 }}>Mekuri</h1>
				<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
					{/* Settings */}
					<div style={{ display: "flex", gap: 4, alignItems: "center" }}>
						<button
							type="button"
							onClick={() =>
								onDirectionChange(direction === "rtl" ? "ltr" : "rtl")
							}
							title={`Reading direction: ${direction === "rtl" ? "Right to Left" : "Left to Right"}`}
							style={{
								background: "var(--bg-card)",
								border: "1px solid var(--border-color)",
								borderRadius: 6,
								padding: "4px 10px",
								color: "var(--text-secondary)",
								fontSize: 12,
								cursor: "pointer",
							}}
						>
							{direction === "rtl" ? "RTL" : "LTR"}
						</button>
						<button
							type="button"
							onClick={() =>
								onViewModeChange(viewMode === "spread" ? "single" : "spread")
							}
							title={`View mode: ${viewMode === "spread" ? "Spread" : "Single"}`}
							style={{
								background: "var(--bg-card)",
								border: "1px solid var(--border-color)",
								borderRadius: 6,
								padding: "4px 10px",
								color: "var(--text-secondary)",
								fontSize: 12,
								cursor: "pointer",
							}}
						>
							{viewMode === "spread" ? "Spread" : "Single"}
						</button>
					</div>
				</div>
			</div>

			{/* Open buttons */}
			<div style={{ padding: "8px 24px 16px", display: "flex", gap: 8 }}>
				<button
					type="button"
					onClick={onOpenFile}
					style={{
						flex: 1,
						padding: "12px 16px",
						background: "var(--primary)",
						color: "#fff",
						border: "none",
						borderRadius: 8,
						fontSize: 14,
						fontWeight: 500,
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						gap: 8,
					}}
				>
					<FolderOpen size={16} />
					Open File
				</button>
				<button
					type="button"
					onClick={onOpenFolder}
					style={{
						padding: "12px 16px",
						background: "var(--bg-card)",
						color: "var(--text-secondary)",
						border: "1px solid var(--border-color)",
						borderRadius: 8,
						fontSize: 14,
						fontWeight: 500,
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						gap: 8,
					}}
				>
					<ImageIcon size={16} />
					Folder
				</button>
			</div>

			{/* Recent files */}
			<div
				style={{
					flex: 1,
					overflowY: "auto",
					padding: "0 24px 24px",
				}}
			>
				{recentFiles.length === 0 ? (
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							height: "100%",
							gap: 12,
							color: "var(--text-tertiary)",
						}}
					>
						<BookOpen size={40} strokeWidth={1} />
						<p style={{ fontSize: 14 }}>No recent files</p>
						<p style={{ fontSize: 12 }}>
							Open a CBZ, CBR, or folder to get started
						</p>
					</div>
				) : (
					<>
						<h2
							style={{
								fontSize: 12,
								fontWeight: 500,
								color: "var(--text-tertiary)",
								textTransform: "uppercase",
								letterSpacing: "0.5px",
								marginBottom: 8,
							}}
						>
							Recent
						</h2>
						<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
							{recentFiles.map((file) => (
								<button
									type="button"
									key={file.path}
									onClick={() => onOpenRecent(file)}
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										padding: "10px 12px",
										background: "var(--bg-card)",
										border: "none",
										borderRadius: 8,
										cursor: "pointer",
										width: "100%",
										textAlign: "left",
										color: "inherit",
										font: "inherit",
									}}
								>
									<div style={{ minWidth: 0 }}>
										<div
											style={{
												fontSize: 14,
												fontWeight: 500,
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}}
										>
											{file.name}
										</div>
										<div
											style={{
												fontSize: 11,
												color: "var(--text-tertiary)",
												marginTop: 2,
											}}
										>
											Page {file.lastPage + 1} / {formatDate(file.lastOpened)}
										</div>
									</div>
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											onRemoveRecent(file.path);
										}}
										style={{
											background: "none",
											border: "none",
											color: "var(--text-tertiary)",
											cursor: "pointer",
											padding: 4,
											borderRadius: 4,
											flexShrink: 0,
											display: "inline-flex",
										}}
									>
										<Trash2 size={14} />
									</button>
								</button>
							))}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
