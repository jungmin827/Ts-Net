import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";

// 본문·헤드라인 — 레퍼런스 사이트도 같은 Noto Sans KR 을 쓴다.
// 넓은 굵기 폭(400~900)이 있어 위계를 만들기 좋다.
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const ORIGIN = siteUrl();

export const metadata: Metadata = {
  /*
   * `metadataBase` 는 **정본 주소를 알 때만** 설정한다.
   * 모르는 상태에서 아무 호스트나 넣으면 canonical·og:url 이 존재하지 않는
   * 주소를 가리키고, 검색엔진은 그걸 정본으로 받아들여 실제 페이지를 중복으로
   * 떨어뜨린다 (`lib/site-url.ts` 주석 참고). 비워 두면 상대 경로 메타만
   * 나가고, 같은 상태에서 robots 가 수집을 막고 있어 모순이 없다.
   */
  ...(ORIGIN ? { metadataBase: new URL(ORIGIN) } : {}),
  /*
   * ⚠ 여기에 정본 주소(canonical)를 두지 않는다.
   *   루트 레이아웃의 메타는 **모든 페이지로 상속된다.** 한 번
   *   `canonical: "/"` 을 넣었더니 `/kt` `/sk` `/review` 가 전부
   *   `canonical = /` 로 나갔다 — 각 페이지가 스스로를 "홈의 중복" 이라고
   *   선언한 것이고, 그러면 색인에서 빠지는 쪽은 그 페이지다.
   *   화면에는 아무 증상이 없고 검색결과가 사라질 때까지 몇 주가 걸린다.
   *   페이지마다 적는다 — `verify-goals` 의 G0 검사가 둘을 같이 본다.
   */
  // TODO: 상호·대표 카피 확정 후 교체
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
  /*
   * OG 는 `title`/`description` 을 자동으로 물려받지 않는다 — 비워 두면
   * 공유 카드에 URL 만 뜬다. 이미지는 **아직 넣지 않는다**: 홍보 이미지는
   * 운영자가 제작해 제공할 예정이고(CLAUDE.md), 임시 이미지를 넣으면
   * 교체되기 전까지 그게 사이트의 첫인상이 된다.
   */
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "TS-Net",
    title: "TS-Net — 인터넷·TV 가입 상담센터",
    description:
      "KT·SK브로드밴드·LG유플러스·KT스카이라이프 인터넷·IPTV 가입 상담.",
  },
  /*
   * 정본 주소를 모르면 **메타 로봇으로도 막는다.** robots.txt 는 "수집하지
   * 말라" 인데, 이미 알고 있는 주소는 수집 없이도 색인될 수 있다 —
   * 두 장치가 막는 지점이 다르다.
   */
  ...(ORIGIN ? {} : { robots: { index: false, follow: false } }),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${notoSansKr.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
