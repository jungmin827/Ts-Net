/**
 * Meta 픽셀 (2026-10-29 운영자 요청 — 메타 광고 전환 측정).
 *
 * ID 는 `NEXT_PUBLIC_META_PIXEL_ID`(Vercel env) 하나에서만 온다. 비어 있으면
 * 스크립트를 아예 내보내지 않는다 — 로컬·프리뷰가 운영 픽셀에 방문을 쌓지 않게.
 *
 * 숫자만 받는다. 이 값은 인라인 `<script>` 안에 그대로 박히므로, 숫자가 아닌
 * 문자가 섞이면 그게 곧 스크립트 주입이다.
 *
 * ⚠ 개인정보처리방침 9항이 이 픽셀을 고지한다. 픽셀을 빼거나 다른 광고 도구를
 *   더하면 방침과 시행일을 같이 고친다 (`PRIVACY_POLICY`).
 */
export function metaPixelId(): string | null {
  const id = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
  return /^\d{5,20}$/.test(id) ? id : null;
}

/**
 * Meta 가 발급한 기본 코드와 같다. 달라진 점은 두 가지다.
 *
 * - **어드민(`/admin`)에서는 돌지 않는다.** 루트 레이아웃의 `<head>` 는 어드민도
 *   지나가는데, 어드민 주소(접수 건 ID 가 들어 있다)를 Meta 에 보낼 이유가 없다.
 * - **`autoConfig` 를 끈다.** 켜 두면 버튼 문구·페이지 메타데이터를 자동으로
 *   수집해 보낸다. 우리가 보내는 것은 PageView 와 접수 성공 시의 Lead 둘뿐이다
 *   (`useLeadSubmit` 의 `fireConversion`). 방침 9항이 그 둘만 적고 있다.
 *
 * 화면 전환(Next 의 클라이언트 이동)은 픽셀이 `history.pushState` 를 보고 스스로
 * PageView 를 보낸다. 접수 완료 시 `/complete` 로 이동하는 것도 이 경로로 잡힌다.
 */
export function metaPixelSnippet(id: string): string {
  return `if(location.pathname.indexOf('/admin')!==0){
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('set','autoConfig',false,'${id}');
fbq('init','${id}');
fbq('track','PageView');
}`;
}
