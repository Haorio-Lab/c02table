import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://co2table.haorio.com"),
  title: "BREATHLINE | 프리다이버 CO₂ 테이블",
  description:
    "초보 프리다이버를 위한 물 밖 전용 CO₂ 테이블 타이머. 숨 참기는 일정하게, 회복 시간은 단계적으로 줄이며 차분한 호흡 리듬을 훈련하세요.",
  keywords: ["프리다이빙", "CO2 테이블", "숨참기 훈련", "드라이 트레이닝"],
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "BREATHLINE | 프리다이버 CO₂ 테이블",
    description: "호흡 욕구를 차분히 알아차리는 물 밖 전용 CO₂ 테이블 훈련.",
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "BREATHLINE CO₂ 테이블 타이머",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BREATHLINE | 프리다이버 CO₂ 테이블",
    description: "호흡 욕구를 차분히 알아차리는 물 밖 전용 CO₂ 테이블 훈련.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
