import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";
import { SITE, SITE_VERIFICATION } from "@/lib/site-config";

// 본문·헤드라인 — 레퍼런스 사이트도 같은 Noto Sans KR 을 쓴다.
// 넓은 굵기 폭(400~900)이 있어 위계를 만들기 좋다.
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const ORIGIN = siteUrl();

/** 모든 페이지의 제목 (2026-10-26 사용자 결정 — 페이지별 제목 없이 상호 하나) */
const HOME_TITLE = SITE.searchName;
const HOME_DESCRIPTION =
  `${SITE.searchName}(${SITE.name}) 인터넷·IPTV 가입 상담센터. ` +
  "KT·SK브로드밴드·LG유플러스·KT스카이라이프 요금을 3년 약정·휴대폰 결합 기준으로 나란히 비교해 드립니다.";

/**
 * 검색엔진 소유 확인 태그. 값은 각 도구가 발급하는 문자열이고 환경변수로만 받는다.
 * 네이버 서치어드바이저는 DNS 인증이 없어 메타 태그가 필요하다. 구글은 DNS TXT 로도
 * 되지만 같은 자리를 둔다. 비어 있으면 태그를 내보내지 않는다.
 *
 * 값은 `SITE_VERIFICATION`(site-config, 공개값) + 환경변수(쉼표로 여러 개)를 합친다.
 * 네이버는 계정마다 다른 값을 발급한다 — 한 계정 값을 지우면 그 계정의 소유확인이 풀린다.
 */
const verifyList = (env: string | undefined, fixed: readonly string[]) => [
  ...new Set(
    [...(env ?? "").split(","), ...fixed].map((s) => s.trim()).filter(Boolean),
  ),
];
const GOOGLE_VERIFY = verifyList(
  process.env.GOOGLE_SITE_VERIFICATION,
  SITE_VERIFICATION.google,
);
const NAVER_VERIFY = verifyList(
  process.env.NAVER_SITE_VERIFICATION,
  SITE_VERIFICATION.naver,
);

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
  /*
   * 제목은 모든 페이지가 `태산-Net` 하나다 (2026-10-26 사용자 결정).
   * 템플릿에 `%s` 가 없으므로 페이지가 `title` 을 적어도 이 값으로 나간다 —
   * 페이지별 `title` 은 지우지 않았다. 되돌릴 때는 템플릿에 `%s` 만 되살리면 된다.
   */
  title: {
    default: HOME_TITLE,
    template: HOME_TITLE,
  },
  applicationName: SITE.searchName,
  /**
   * 메타 설명. 한국어는 검색결과에서 대략 **80자**까지 보이고 그 뒤는 잘린다.
   * 80자 언저리를 겨냥한다. 내용은 **확인된 사실만** — 근거 없는 지원금·보상률은
   * 넣지 않는다 (CLAUDE.md 규칙 6). 상호를 맨 앞에 두는 건 네이버가 설명문도
   * 검색어 일치에 쓰기 때문이다.
   */
  description: HOME_DESCRIPTION,
  /*
   * OG 는 `title`/`description` 을 자동으로 물려받지 않는다 — 비워 두면
   * 공유 카드에 URL 만 뜬다. 이미지는 운영자 제작 메인 포스터(10-25)를 쓴다.
   * 상대 경로라 `metadataBase` 가 있을 때만 넣는다 — 없으면 Next 가
   * localhost 로 절대화해 아무도 열 수 없는 이미지 주소가 나간다.
   */
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: SITE.searchName,
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    ...(ORIGIN
      ? {
          images: [
            {
              url: SITE.hero.poster.src,
              width: SITE.hero.poster.width,
              height: SITE.hero.poster.height,
              alt: SITE.hero.poster.alt,
            },
          ],
        }
      : {}),
  },
  /*
   * 정본 주소를 모르면 **메타 로봇으로도 막는다.** robots.txt 는 "수집하지
   * 말라" 인데, 이미 알고 있는 주소는 수집 없이도 색인될 수 있다 —
   * 두 장치가 막는 지점이 다르다.
   */
  ...(ORIGIN ? {} : { robots: { index: false, follow: false } }),
  ...(GOOGLE_VERIFY.length || NAVER_VERIFY.length
    ? {
        verification: {
          ...(GOOGLE_VERIFY.length ? { google: GOOGLE_VERIFY } : {}),
          ...(NAVER_VERIFY.length
            ? { other: { "naver-site-verification": NAVER_VERIFY } }
            : {}),
        },
      }
    : {}),
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
