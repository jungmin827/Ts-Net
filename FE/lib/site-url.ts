/**
 * 사이트의 정규 주소(canonical origin).
 *
 * ── 왜 "없으면 없는 대로" 두는가 ────────────────────────────────
 * 도메인이 아직 연결되지 않았다. 이때 아무 주소나(예: 배포 미리보기 URL,
 * 또는 희망하는 도메인을 미리) 박아 두면 **canonical 과 sitemap 이 존재하지
 * 않거나 틀린 호스트를 가리킨다.** 그건 canonical 이 없는 것보다 나쁘다 —
 * 검색엔진은 틀린 주소를 "정본" 으로 받아들여 실제 페이지를 중복으로 떨어뜨린다.
 * 되돌리려면 재색인을 기다려야 하고, 그 사이 유입이 사라진다.
 *
 * 그래서 설정되지 않으면 `null` 을 돌려주고, 호출부가 각자 안전한 쪽을 고른다:
 *   · `metadataBase` — 설정하지 않는다 (상대 경로 메타만 나간다)
 *   · `robots.txt`   — **전체 수집 금지**. 정본 주소를 모르는 상태에서
 *                      색인되면 위의 중복 문제가 그대로 생긴다
 *   · `sitemap.xml`  — 빈 목록
 */
export function siteUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    // http/https 만. `javascript:` 같은 값이 메타태그에 들어가지 않게 한다.
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    /*
     * 운영 빌드에서 로컬·사설 호스트는 **설정되지 않은 것으로 취급한다.**
     * `.env.local` 에 `http://localhost:3000` 이 들어 있었는데, 같은 값이
     * 배포 환경변수로 복사되면 사이트가 스스로를 "localhost 가 정본" 이라고
     * 선언한다. 그 canonical·sitemap 은 아무도 따라갈 수 없는 주소다.
     * 개발에서는 그대로 쓴다 — 거기서는 localhost 가 맞는 주소다.
     */
    const local =
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname === "[::1]" ||
      u.hostname.endsWith(".local") ||
      u.hostname.endsWith(".localhost");
    if (local && process.env.NODE_ENV === "production") {
      console.error(
        `[site-url] 운영 빌드에서 로컬 주소(${u.origin})는 정본으로 쓸 수 없습니다 — ` +
          "canonical·sitemap 을 비우고 robots 로 수집을 막습니다",
      );
      return null;
    }

    // 경로·쿼리·해시는 버린다. origin 만 쓴다 — 하위 경로가 섞이면
    // `new URL("/review", base)` 가 그 경로를 잘라내 조용히 달라진다.
    return u.origin;
  } catch {
    // 잘못된 값이면 설정되지 않은 것으로 취급한다. 여기서 던지면
    // **빌드 전체가 실패**하는데, 원인이 환경변수 한 글자라 찾기 어렵다.
    console.error(
      `[site-url] NEXT_PUBLIC_SITE_URL 이 올바른 URL 이 아닙니다: ${JSON.stringify(raw)} — ` +
        "canonical·sitemap 을 비우고 robots 로 수집을 막습니다",
    );
    return null;
  }
}

/** 공개 라우트 중 **항상 존재하는** 것들. 게시판 상세는 DB 에서 채운다 */
export const STATIC_ROUTES = [
  { path: "/", priority: 1.0, changeFrequency: "daily" as const },
  { path: "/kt", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/sk", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/lg", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/skylife", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/review", priority: 0.6, changeFrequency: "daily" as const },
  { path: "/notice", priority: 0.6, changeFrequency: "weekly" as const },
];
