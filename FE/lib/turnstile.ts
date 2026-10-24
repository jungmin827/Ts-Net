const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** siteverify 한 번의 상한. 정상 응답은 수백 ms 다 */
const VERIFY_TIMEOUT_MS = 5_000;

/**
 * Turnstile 서버 검증 결과.
 *
 * 예전에는 boolean 하나였다 — **방문자가 떨어진 것**과 **우리가 확인을 못 한
 * 것**이 같은 `false` 였다. 그래서 Cloudflare 가 느리거나, 비밀키가 틀렸을
 * 때도 방문자는 "보안 검증에 실패했습니다" 를 보고 새로고침(입력 유실)을
 * 반복했고, 운영자는 아무 로그도 못 받았다. 비밀키가 틀리면 **모든 접수가
 * 조용히 막힌다.**
 *
 * - `ok`          통과
 * - `rejected`    토큰이 무효·만료·재사용 — 방문자 쪽 문제. 위젯 재발급으로 해결
 * - `unavailable` 검증 서버 불통·시간초과·비밀키 오류 — 우리 쪽 문제
 */
export type TurnstileResult = "ok" | "rejected" | "unavailable";

/** 이 코드들은 방문자가 아니라 서버 설정 문제다 — 운영자가 알아야 한다 */
const CONFIG_ERRORS = ["missing-input-secret", "invalid-input-secret"];

export async function verifyTurnstile(
  token: string,
  ip?: string,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error("TURNSTILE_SECRET_KEY가 설정되지 않았습니다");

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("[turnstile] siteverify 응답 이상:", res.status);
      return "unavailable";
    }
    const data: { success?: boolean; "error-codes"?: string[] } =
      await res.json();
    if (data.success === true) return "ok";

    const codes = data["error-codes"] ?? [];
    if (codes.some((c) => CONFIG_ERRORS.includes(c))) {
      console.error("[turnstile] 비밀키 설정 오류 — 모든 제출이 막힙니다:", codes);
      return "unavailable";
    }
    return "rejected";
  } catch (e) {
    // 시간초과·DNS·연결 실패. 토큰 값은 남기지 않는다
    console.error(
      "[turnstile] siteverify 호출 실패:",
      e instanceof Error ? e.name : String(e),
    );
    return "unavailable";
  }
}

/** 라우트가 그대로 내보내는 사용자 문구·상태코드 */
export const TURNSTILE_FAILURE = {
  // 위젯은 클라이언트가 실패 직후 자동으로 재발급한다 — 새로고침(입력 유실)을 시키지 않는다
  rejected: {
    status: 400,
    error: "보안 확인이 만료되었거나 통과하지 못했습니다. 확인이 다시 끝나면 한 번 더 눌러 주세요",
  },
  unavailable: {
    status: 503,
    error: "보안 확인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요",
  },
} as const;
