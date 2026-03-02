import { ImageResponse } from "next/og";

export const alt = "Mekuri";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0a0a0b 0%, #1c1c21 50%, #2d1b69 100%)",
        gap: 24,
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: next/image not available in ImageResponse */}
      <img
        alt="Mekuri"
        src="https://mekuri.kkweb.io/icon.png"
        width={160}
        height={160}
        style={{ borderRadius: 32 }}
      />
      <div
        style={{
          fontSize: 64,
          fontWeight: 700,
          color: "#f0f0f3",
          letterSpacing: "-1px",
        }}
      >
        Mekuri
      </div>
      <div
        style={{
          fontSize: 28,
          color: "rgba(240,240,243,0.7)",
          maxWidth: 700,
          textAlign: "center",
        }}
      >
        {isJa
          ? "漫画を、美しく読む。macOSコミックリーダー。"
          : "Your comics, beautifully read. macOS comic reader."}
      </div>
    </div>,
    { ...size },
  );
}
