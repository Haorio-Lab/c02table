import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://co2table.haorio.com"),
  title: "BREATHLINE — 프리다이버 CO₂ 테이블",
  description: "프리다이버를 위한 안전한 드라이 CO₂ 테이블 숨참기 훈련 타이머",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "BREATHLINE — 프리다이버 CO₂ 테이블",
    description: "불편함과 친해지는 시간. 안전한 드라이 숨참기 훈련을 시작하세요.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "BREATHLINE CO₂ 테이블 트레이너" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
