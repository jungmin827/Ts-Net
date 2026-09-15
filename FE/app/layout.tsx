import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

export const metadata: Metadata = {
  // TODO: 상호·대표 카피 확정 후 교체. metadataBase는 도메인 연결 시 설정
  title: {
    default: "TS넷 — 인터넷·TV 가입 상담센터",
    template: "%s | TS넷",
  },
  description:
    "KT · SK · LG · KT스카이라이프 인터넷/IPTV 신규가입 상담 접수",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${notoSansKr.variable} antialiased`}>{children}</body>
    </html>
  );
}
