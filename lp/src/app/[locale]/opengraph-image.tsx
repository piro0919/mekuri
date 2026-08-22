import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { routing } from "@/i18n/routing";

export const alt = "Mekuri";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* ビルド時に焼く。動的なままだと public/ が関数側に含まれず、
   本番で icon.png を読めずに 500 になる */
export function generateStaticParams(): { locale: string }[] {
  return routing.locales.map((locale) => ({ locale }));
}

/* 出るのは kk-web の一覧で176px、X のカードで500px 前後。
   その大きさで残るのはアイコンと名前と1行だけ。色はアイコンから取る */
const INK = "#0f0f10";
const PAPER = "#f4f1ea";
const ACCENT = "#c8452f";

export default async function OgImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ImageResponse> {
  const { locale } = await params;
  const isJa = locale === "ja";
  const icon = await readFile(join(process.cwd(), "public/icon.png"));
  const iconSrc = `data:image/png;base64,${icon.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: INK,
        display: "flex",
        gap: 64,
        height: "100%",
        padding: "0 90px",
        width: "100%",
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: next/image is not available in ImageResponse */}
      <img alt="" height={300} src={iconSrc} width={300} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            color: PAPER,
            fontSize: 128,
            fontWeight: 700,
            letterSpacing: -3,
          }}
        >
          Mekuri
        </div>
        <div style={{ color: ACCENT, display: "flex", fontSize: 38, marginTop: 18 }}>
          {isJa
            ? "漫画を、美しく読む。"
            : "Your comics, beautifully read."}
        </div>
      </div>
    </div>,
    { ...size },
  );
}
