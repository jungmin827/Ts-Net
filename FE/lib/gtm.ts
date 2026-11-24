/**
 * Google 태그 관리자(GTM) (2026-11-24 운영자(광고 대행) 요청 — 구글 전환 집계).
 *
 * ID 는 `NEXT_PUBLIC_GTM_ID`(Vercel env) 하나에서만 온다. 비어 있으면
 * 스크립트를 아예 내보내지 않는다 — 로컬·프리뷰가 운영 컨테이너에 방문을 쌓지 않게.
 *
 * `GTM-` + 영문 대문자·숫자만 받는다. 이 값은 인라인 `<script>` 안에 그대로
 * 박히므로, 형식에 맞지 않는 값이 섞이면 그게 곧 스크립트 주입이다 — 맞지 않으면
 * 고쳐 쓰지 않고 통째로 버린다.
 *
 * ⚠ 개인정보처리방침 9항이 Google 을 고지한다. 태그를 빼거나 컨테이너에서
 *   수집 항목을 늘리면 방침과 시행일을 같이 고친다 (`PRIVACY_POLICY`).
 *
 * Google 이 주는 코드는 `<head>` 스크립트와 `<body>` 바로 뒤 `<noscript>` iframe
 * 두 조각인데, **`<noscript>` 조각은 넣지 않는다.** 운영자가 준 것은 head 조각뿐이고,
 * noscript 는 주소를 검사할 수 없어 어드민(`/admin`)에서도 그대로 요청이 나간다.
 * 스크립트를 끈 방문자는 어차피 상담 신청(Turnstile)을 할 수 없어 전환 집계와 무관하다.
 */
export function gtmId(): string | null {
  const id = process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "";
  return /^GTM-[A-Z0-9]{4,12}$/.test(id) ? id : null;
}

/**
 * Google 이 발급한 기본 head 코드와 같다. 달라진 점은 하나다.
 *
 * - **어드민(`/admin`)에서는 돌지 않는다.** 루트 레이아웃의 `<head>` 는 어드민도
 *   지나가는데, 어드민 주소(접수 건 ID 가 들어 있다)를 Google 에 보낼 이유가 없다.
 *
 * 접수 성공 신호는 `useLeadSubmit` 의 `fireConversion` 이 `dataLayer` 에
 * `generate_lead` 이벤트로 넣는다. 컨테이너의 전환 태그는 그 이벤트를 트리거로 쓴다.
 */
export function gtmSnippet(id: string): string {
  return `if(location.pathname.indexOf('/admin')!==0){
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');
}`;
}
