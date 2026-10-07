import type { Metadata } from "next";
import { Noto_Sans_KR, Jua } from "next/font/google";
import "./globals.css";

// 본문·헤드라인 — 레퍼런스 사이트도 같은 Noto Sans KR 을 쓴다.
// 넓은 굵기 폭(400~900)이 있어 위계를 만들기 좋다.
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

// 포인트 전용 — 둥글고 통통해서 한 곳에만 쓰면 화면이 단번에 친근해진다.
// 레퍼런스는 손글씨체를 외부 GitHub CDN 에서 불러오지만, 런타임 외부 의존과
// 라이선스를 피하려고 OFL 폰트를 next/font 로 self-host 한다.
// 가독성이 중요한 본문·금액·약관에는 절대 쓰지 않는다.
const jua = Jua({
  variable: "--font-jua",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  // TODO: 상호·대표 카피 확정 후 교체. metadataBase는 도메인 연결 시 설정
  title: {
    default: "TS-Net — 인터넷·TV 가입 상담센터",
    template: "%s | TS-Net",
  },
  /**
   * 메타 설명. 한국어는 검색결과에서 대략 **80자**까지 보이고 그 뒤는 잘린다.
   * 기존 29자는 절반도 못 쓰고 있었다. 그렇다고 넘기면 뒷부분이 안 보이므로
   * 80자 언저리를 겨냥한다. 내용은 **확인된 사실만** — 근거 없는 지원금·보상률은
   * 넣지 않는다 (CLAUDE.md 규칙 6).
   */
  description:
    "KT·SK브로드밴드·LG유플러스·KT스카이라이프 인터넷·IPTV 가입 상담. " +
    "3년 약정·휴대폰 1회선 결합 기준으로 4사 요금을 나란히 비교해 드립니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${notoSansKr.variable} ${jua.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
