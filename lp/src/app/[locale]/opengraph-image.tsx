import { ImageResponse } from "next/og";

export const alt = "Mekuri";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#17130e";
const PAPER = "#f2ede1";
const SHEET = "#fbf8f1";
const TONE = "#e7e2d6";
const ACCENT = "#c8452f";

export default async function OgImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ImageResponse> {
  const { locale } = await params;
  const isJa = locale === "ja";

  return new ImageResponse(
    <div
      style={{
        background: PAPER,
        display: "flex",
        height: "100%",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 64px",
          width: 660,
        }}
      >
        <div style={{ display: "flex", gap: 10 }}>
          {["CBZ", "CBR", isJa ? "画像フォルダ" : "IMAGE FOLDERS"].map(
            (chip) => (
              <div
                key={chip}
                style={{
                  border: `2px solid ${INK}`,
                  color: INK,
                  fontSize: 18,
                  letterSpacing: 2,
                  padding: "6px 14px",
                }}
              >
                {chip}
              </div>
            ),
          )}
        </div>
        <div
          style={{
            color: INK,
            fontSize: 132,
            fontWeight: 700,
            letterSpacing: -4,
            marginTop: 28,
          }}
        >
          Mekuri
        </div>
        <div
          style={{
            color: ACCENT,
            fontSize: 26,
            letterSpacing: 14,
            marginTop: 4,
          }}
        >
          メクリ
        </div>
        <div
          style={{
            color: INK,
            fontSize: 36,
            fontWeight: 500,
            marginTop: 34,
          }}
        >
          {isJa ? "漫画を、美しく読む。" : "Your comics, beautifully read."}
        </div>
        <div style={{ color: "#4a4239", fontSize: 24, marginTop: 14 }}>
          {isJa ? "macOS コミックリーダー" : "macOS comic reader"}
        </div>
      </div>

      {/* 誌面。右端で裁ち落とす */}
      <div style={{ display: "flex", overflow: "hidden", width: 540 }}>
        <div
          style={{
            background: SHEET,
            border: `4px solid ${INK}`,
            display: "flex",
            height: 470,
            marginTop: 80,
            padding: 20,
            transform: "rotate(-2deg)",
            width: 600,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 18,
              width: 250,
            }}
          >
            <div
              style={{
                background: TONE,
                border: `4px solid ${INK}`,
                height: 150,
              }}
            />
            <div
              style={{
                border: `4px solid ${INK}`,
                display: "flex",
                flex: 1,
                gap: 18,
              }}
            />
          </div>
          <div style={{ background: INK, margin: "0 16px", width: 4 }} />
          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              gap: 18,
            }}
          >
            <div
              style={{
                border: `4px solid ${INK}`,
                height: 110,
              }}
            />
            <div
              style={{
                alignItems: "center",
                border: `4px solid ${INK}`,
                display: "flex",
                flex: 1,
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {Array.from({ length: 14 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    background: INK,
                    height: 420,
                    position: "absolute",
                    transform: `rotate(${(i * 180) / 14}deg)`,
                    width: 3,
                  }}
                />
              ))}
              <div
                style={{
                  background: ACCENT,
                  borderRadius: 999,
                  height: 68,
                  width: 68,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    { ...size },
  );
}
