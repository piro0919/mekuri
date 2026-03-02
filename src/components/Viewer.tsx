import { useCallback, useEffect, useRef, useState } from "react";
import type { ComicPage, ReadingDirection, ViewMode } from "../types";

type Props = {
	pageCount: number;
	currentPage: number;
	currentPageData: ComicPage | null;
	nextPageData: ComicPage | null;
	direction: ReadingDirection;
	viewMode: ViewMode;
	onNext: (step?: number) => void;
	onPrev: (step?: number) => void;
	onGoTo: (page: number) => void;
	onClose: () => void;
	onDirectionChange: (dir: ReadingDirection) => void;
	onViewModeChange: (mode: ViewMode) => void;
};

function isLandscape(page: ComicPage | null): boolean {
	return page !== null && page.width > 0 && page.width > page.height;
}

export function Viewer({
	pageCount,
	currentPage,
	currentPageData,
	nextPageData,
	direction,
	viewMode,
	onNext,
	onPrev,
	onGoTo,
	onClose,
	onDirectionChange,
	onViewModeChange,
}: Props) {
	// In spread mode, show page alone if: cover, landscape current, or landscape next
	const showAlone =
		viewMode === "spread" &&
		(currentPage === 0 ||
			nextPageData === null ||
			isLandscape(currentPageData) ||
			isLandscape(nextPageData));

	const step = viewMode === "single" || showAlone ? 1 : 2;

	// Boundary hint: "end" or "start" shown on first attempt, close on second
	const [boundaryHint, setBoundaryHint] = useState<"start" | "end" | null>(
		null,
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset hint when page changes
	useEffect(() => {
		setBoundaryHint(null);
	}, [currentPage]);

	useEffect(() => {
		if (!boundaryHint) return;
		const timer = setTimeout(() => setBoundaryHint(null), 2000);
		return () => clearTimeout(timer);
	}, [boundaryHint]);

	const navigateNext = useCallback(() => {
		if (currentPage >= pageCount - 1) {
			if (boundaryHint === "end") {
				onClose();
			} else {
				setBoundaryHint("end");
			}
			return;
		}
		onNext(step);
	}, [currentPage, pageCount, step, boundaryHint, onNext, onClose]);

	const navigatePrev = useCallback(() => {
		if (currentPage <= 0) {
			if (boundaryHint === "start") {
				onClose();
			} else {
				setBoundaryHint("start");
			}
			return;
		}
		onPrev(step);
	}, [currentPage, step, boundaryHint, onPrev, onClose]);

	// Slider scrubbing state: debounce fetch during drag for live preview
	const [scrubPage, setScrubPage] = useState<number | null>(null);
	const isDraggingRef = useRef(false);
	const scrubTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const displayPage = scrubPage ?? currentPage;

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			switch (e.key) {
				case "ArrowRight":
					if (direction === "ltr") navigateNext();
					else navigatePrev();
					break;
				case "ArrowLeft":
					if (direction === "ltr") navigatePrev();
					else navigateNext();
					break;
				case "ArrowDown":
				case " ":
					e.preventDefault();
					navigateNext();
					break;
				case "ArrowUp":
					e.preventDefault();
					navigatePrev();
					break;
				case "Home":
					onGoTo(0);
					break;
				case "End":
					onGoTo(pageCount - 1);
					break;
				case "Escape":
					onClose();
					break;
				case "r":
				case "R":
					onDirectionChange(direction === "rtl" ? "ltr" : "rtl");
					break;
				case "s":
				case "S":
					onViewModeChange(viewMode === "spread" ? "single" : "spread");
					break;
				case "f":
				case "F":
					if (document.fullscreenElement) {
						document.exitFullscreen();
					} else {
						document.documentElement.requestFullscreen();
					}
					break;
			}
		},
		[
			direction,
			viewMode,
			navigateNext,
			navigatePrev,
			onGoTo,
			onClose,
			onDirectionChange,
			onViewModeChange,
			pageCount,
		],
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

	// Trackpad swipe: accumulate deltaX and trigger page navigation at threshold
	const swipeAccRef = useRef(0);
	const swipeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	useEffect(() => {
		const SWIPE_THRESHOLD = 50;

		const handleWheel = (e: WheelEvent) => {
			// Only handle horizontal swipes (trackpad gesture)
			if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
			e.preventDefault();

			swipeAccRef.current += e.deltaX;
			clearTimeout(swipeTimerRef.current);
			swipeTimerRef.current = setTimeout(() => {
				swipeAccRef.current = 0;
			}, 300);

			if (swipeAccRef.current > SWIPE_THRESHOLD) {
				swipeAccRef.current = 0;
				if (direction === "rtl") navigatePrev();
				else navigateNext();
			} else if (swipeAccRef.current < -SWIPE_THRESHOLD) {
				swipeAccRef.current = 0;
				if (direction === "rtl") navigateNext();
				else navigatePrev();
			}
		};

		window.addEventListener("wheel", handleWheel, { passive: false });
		return () => window.removeEventListener("wheel", handleWheel);
	}, [direction, navigateNext, navigatePrev]);

	const handleClick = useCallback(
		(e: React.MouseEvent) => {
			const rect = e.currentTarget.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const isRightSide = x > rect.width / 2;

			if (direction === "rtl") {
				if (isRightSide) navigatePrev();
				else navigateNext();
			} else {
				if (isRightSide) navigateNext();
				else navigatePrev();
			}
		},
		[direction, navigateNext, navigatePrev],
	);

	const renderPages = () => {
		if (!currentPageData) {
			return (
				<div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
					Loading...
				</div>
			);
		}

		if (viewMode === "spread" && !showAlone) {
			const leftData = direction === "rtl" ? nextPageData : currentPageData;
			const rightData = direction === "rtl" ? currentPageData : nextPageData;

			return (
				<div
					style={{
						display: "flex",
						height: "100%",
						justifyContent: "center",
						alignItems: "center",
						gap: 2,
					}}
				>
					{leftData && (
						<img
							src={leftData.data_url}
							alt={leftData.filename}
							style={{
								maxHeight: "100%",
								maxWidth: "50%",
								objectFit: "contain",
							}}
							draggable={false}
						/>
					)}
					{rightData && (
						<img
							src={rightData.data_url}
							alt={rightData.filename}
							style={{
								maxHeight: "100%",
								maxWidth: "50%",
								objectFit: "contain",
							}}
							draggable={false}
						/>
					)}
				</div>
			);
		}

		return (
			<img
				src={currentPageData.data_url}
				alt={currentPageData.filename}
				style={{
					maxHeight: "100%",
					maxWidth: "100%",
					objectFit: "contain",
				}}
				draggable={false}
			/>
		);
	};

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled via global keydown
		// biome-ignore lint/a11y/noStaticElementInteractions: viewer click area for page navigation
		<div
			onClick={handleClick}
			style={{
				width: "100%",
				height: "100vh",
				display: "flex",
				flexDirection: "column",
				background: "#000",
				cursor: "pointer",
			}}
		>
			<div
				style={{
					flex: 1,
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					overflow: "hidden",
					position: "relative",
				}}
			>
				{renderPages()}
				{boundaryHint && (
					<div
						style={{
							position: "absolute",
							bottom: 16,
							left: "50%",
							transform: "translateX(-50%)",
							background: "rgba(255,255,255,0.15)",
							backdropFilter: "blur(8px)",
							color: "#fff",
							padding: "8px 20px",
							borderRadius: 8,
							fontSize: 13,
							pointerEvents: "none",
						}}
					>
						{boundaryHint === "end"
							? "Last page — tap again to close"
							: "First page — tap again to close"}
					</div>
				)}
			</div>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only, not interactive */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: status bar click stop */}
			<div
				onClick={(e) => e.stopPropagation()}
				style={{
					height: 36,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					gap: 10,
					padding: "0 16px",
					background: "rgba(0,0,0,0.8)",
					color: "var(--text-secondary)",
					fontSize: 12,
					flexShrink: 0,
					cursor: "default",
				}}
			>
				<span style={{ minWidth: 56, textAlign: "center" }}>
					{displayPage + 1} / {pageCount}
				</span>
				<input
					type="range"
					min={0}
					max={pageCount - 1}
					value={displayPage}
					onChange={(e) => {
						const val = Number(e.target.value);
						if (isDraggingRef.current) {
							setScrubPage(val);
							clearTimeout(scrubTimerRef.current);
							scrubTimerRef.current = setTimeout(() => {
								onGoTo(val);
							}, 150);
						} else {
							onGoTo(val);
						}
					}}
					onPointerDown={() => {
						isDraggingRef.current = true;
					}}
					onPointerUp={() => {
						isDraggingRef.current = false;
						clearTimeout(scrubTimerRef.current);
						if (scrubPage !== null) {
							onGoTo(scrubPage);
							setScrubPage(null);
						}
					}}
					style={{
						flex: 1,
						maxWidth: 300,
						height: 4,
						cursor: "pointer",
						direction: direction === "rtl" ? "rtl" : "ltr",
						accentColor: "var(--primary)",
					}}
				/>
				<span style={{ color: "var(--text-tertiary)" }}>
					{direction === "rtl" ? "RTL" : "LTR"} /{" "}
					{viewMode === "spread" ? "Spread" : "Single"}
				</span>
				<span style={{ color: "var(--text-tertiary)" }}>R / S / F / ESC</span>
			</div>
		</div>
	);
}
