import type { NextRequest } from "next/server";

/**
 * 교차 출처 요청을 막는다.
 *
 * 부수효과가 있는 어드민 엔드포인트는 전부 이걸 통과해야 한다 —
 * 복호화·반출·수정·로그아웃. 로그인된 어드민의 브라우저는 외부 페이지가 보낸
 * 요청에도 쿠키를 실어 보내므로, 폼 한 줄이나 `<img>` 한 줄로 동작이 일어난다.
 *
 * `Sec-Fetch-Site` 를 먼저 본다 (브라우저가 쓰고 스크립트가 못 바꾼다).
 * 없으면 `Origin` 의 호스트를 비교한다. 둘 다 없는 요청은 허용하지 않는다 —
 * 어드민은 브라우저에서만 쓴다.
 *
 * ⚠ 예전에는 이 함수가 export 라우트 안에만 있었다. 그래서 `logout` 은
 *   검증 없이 열려 있었고, 외부 페이지의 폼 전송 한 번으로 어드민 세션을
 *   끊을 수 있었다. 피해는 가용성뿐이지만, 로그인 시도 제한과 묶으면
 *   "로그아웃시킨 뒤 재로그인을 방해하는" 조합이 된다.
 *   한 군데에 두고 모든 부수효과 라우트가 같은 판단을 쓰게 한다.
 */
export function isSameOrigin(req: NextRequest): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";

  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}
