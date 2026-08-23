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
  /* 見出しの書体はサイトと同じ Zen Kaku Gothic New。使う文字だけに絞った
     ものを同梱している。文言を変えたら assets/README.md の手順で作り直す */
  const [icon, font] = await Promise.all([
    readFile(join(process.cwd(), "public/icon.png")),
    readFile(join(process.cwd(), "assets/ZenKakuGothicNew-Medium-subset.ttf")),
  ]);
  const iconSrc = `data:image/png;base64,${icon.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: INK,
        display: "flex",
        gap: 56,
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: next/image is not available in ImageResponse */}
      <img alt="" height={230} src={iconSrc} width={230} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            color: PAPER,
            fontSize: 112,
            letterSpacing: -3,
          }}
        >
          Mekuri
        </div>
        <div style={{ color: ACCENT, display: "flex", fontSize: 34, marginTop: 14 }}>
          {isJa
            ? "漫画を、美しく読む。"
            : "Your comics, beautifully read."}
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { data: font, name: "Zen Kaku Gothic New", style: "normal", weight: 500 },
      ],
    },
  );
}
