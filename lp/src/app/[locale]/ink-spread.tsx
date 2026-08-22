import type { ReactNode } from "react";

/**
 * ヒーローに置く見開き。アプリのスクリーンショットは枠だけで中身が無く、
 * 拡大すると「何も表示されていない画面」に見えるので、代わりに漫画の
 * 誌面そのものを線で描いている。右端の折り返しは名前の由来（めくり）。
 */
export function InkSpread(): ReactNode {
  const speedLines = Array.from({ length: 26 }, (_, i) => {
    const angle = (i / 26) * Math.PI * 2;

    return {
      key: i,
      x1: 540 + Math.cos(angle) * 34,
      x2: 540 + Math.cos(angle) * 190,
      y1: 280 + Math.sin(angle) * 34,
      y2: 280 + Math.sin(angle) * 190,
    };
  });

  return (
    <svg
      aria-hidden="true"
      className="h-auto w-full"
      fill="none"
      viewBox="0 0 720 560"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          height="8"
          id="tone"
          patternUnits="userSpaceOnUse"
          width="8"
        >
          <circle cx="2" cy="2" fill="#17130e" opacity="0.28" r="1.5" />
        </pattern>
        <clipPath id="burst">
          <rect height="200" width="280" x="400" y="180" />
        </clipPath>
      </defs>

      {/* 紙 */}
      <rect fill="#17130e" height="520" rx="2" width="680" x="20" y="24" />
      <rect fill="#fbf8f1" height="512" rx="2" width="672" x="20" y="20" />
      <line
        stroke="#17130e"
        strokeWidth="2"
        x1="370"
        x2="370"
        y1="20"
        y2="532"
      />

      <g stroke="#17130e" strokeWidth="3">
        {/* 左ページ */}
        <rect fill="#e7e2d6" height="150" width="280" x="50" y="50" />
        <rect fill="url(#tone)" height="240" width="120" x="50" y="220" />
        <rect fill="#efeade" height="240" width="140" x="190" y="220" />

        {/* 右ページ */}
        <rect fill="#efeade" height="100" width="130" x="400" y="50" />
        <rect fill="#e7e2d6" height="100" width="140" x="550" y="50" />
        <rect fill="#fbf8f1" height="180" width="290" x="400" y="180" />
        <rect fill="url(#tone)" height="80" width="290" x="400" y="382" />
      </g>

      {/* 集中線 */}
      <g clipPath="url(#burst)" opacity="0.85">
        {speedLines.map(({ key, x1, x2, y1, y2 }) => (
          <line
            key={key}
            stroke="#17130e"
            strokeWidth="2"
            x1={x1}
            x2={x2}
            y1={y1}
            y2={y2}
          />
        ))}
        <circle cx="540" cy="280" fill="#c8452f" r="26" />
      </g>
      <rect
        height="180"
        stroke="#17130e"
        strokeWidth="3"
        width="290"
        x="400"
        y="180"
      />

      {/* めくり */}
      <path d="M690 460 L690 532 L618 532 Z" fill="#e0d8c6" />
      <path
        d="M690 460 L618 532"
        stroke="#17130e"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}
