/**
 * 어드민 로그인 시도 제한.
 *
 * **한계를 먼저 밝힌다** — 이 모듈은 프로세스 메모리에만 상태를 둔다.
 * 서버 인스턴스가 여러 개면 인스턴스별로 따로 센다. 재배포하면 초기화된다.
 * 즉 결정적인 방어가 아니라 **자동화 공격의 비용을 올리는 장치**다.
 *
 * 제대로 하려면 DB 테이블 + `security definer` RPC 가 필요하다
 * (레이트리밋을 `lead_rate_exceeded()` 로 옮긴 것과 같은 방식).
 * 그건 마이그레이션 적용 권한이 생긴 뒤의 과제로 남긴다.
 *
 * 그래도 지금 넣는 이유: 현재는 **시도 횟수에 아무 제한이 없다.**
 * 단일 계정 + 알려진 로그인 URL 조합이라 대입 공격의 표적이 되기 쉽다.
 *
 * ## IP 만으로는 막히지 않는다
 *
 * IP 는 `X-Forwarded-For` 에서 온다. 신뢰할 수 있는 프록시 뒤가 아니면
 * 공격자가 헤더를 바꿔가며 **키를 무한히 회전**시킬 수 있다
 * (실측: 헤더를 바꿔 8회 연속 401 — 잠금 미작동).
 *
 * 반대로 IP 키에만 의존하면, XFF 가 없는 환경에서 모든 요청이
 * `unknown|email` 한 키로 합쳐져 **제3자가 운영자를 15분 잠글 수 있다.**
 *
 * 그래서 두 축으로 센다.
 *   - IP+이메일: 15분 5회 — 단일 출처의 빠른 대입을 즉시 끊는다
 *   - 이메일 단독: 1시간 30회 — IP 를 아무리 회전해도 **계정당 총량**이 묶인다.
 *     운영자가 정상적으로 도달할 수 없는 수준이라 서비스 거부로 쓰이기 어렵다.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
/** 이메일 단독 총량 — IP 회전으로는 넘을 수 없는 상한 */
const ACCOUNT_WINDOW_MS = 60 * 60 * 1000;
const ACCOUNT_MAX_ATTEMPTS = 30;
/** 메모리 누수를 막는 상한. 넘으면 오래된 것부터 버린다 */
const MAX_KEYS = 5000;

type Entry = { count: number; first: number };
const attempts = new Map<string, Entry>();

function prune(now: number) {
  for (const [k, v] of attempts) {
    if (now - v.first > WINDOW_MS) attempts.delete(k);
  }
  if (attempts.size > MAX_KEYS) {
    const excess = attempts.size - MAX_KEYS;
    let i = 0;
    for (const k of attempts.keys()) {
      if (i++ >= excess) break;
      attempts.delete(k);
    }
  }
}

/** IP + 이메일 조합 키 — 단일 출처의 빠른 대입을 끊는다 */
export function throttleKey(ip: string | null | undefined, email: string): string {
  return `${ip ?? "unknown"}|${email.toLowerCase()}`;
}

/** 이메일 단독 키 — IP 를 회전해도 계정당 총량은 이 키로 묶인다 */
function accountKey(email: string): string {
  return `acct:${email.toLowerCase()}`;
}

function overLimit(
  key: string,
  max: number,
  window: number,
  now: number,
): number {
  const e = attempts.get(key);
  if (!e) return 0;
  if (now - e.first > window) {
    attempts.delete(key);
    return 0;
  }
  if (e.count < max) return 0;
  return Math.ceil((window - (now - e.first)) / 1000);
}

function bump(key: string, window: number, now: number): void {
  const e = attempts.get(key);
  if (!e || now - e.first > window) {
    attempts.set(key, { count: 1, first: now });
    return;
  }
  e.count += 1;
}

/**
 * 지금 시도해도 되는가. 남은 잠금 시간(초)을 함께 돌려준다.
 * IP 축과 계정 축 중 **하나라도** 걸리면 막는다.
 */
export function checkLogin(
  key: string,
  email: string,
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  prune(now);
  const byIp = overLimit(key, MAX_ATTEMPTS, WINDOW_MS, now);
  const byAccount = overLimit(
    accountKey(email),
    ACCOUNT_MAX_ATTEMPTS,
    ACCOUNT_WINDOW_MS,
    now,
  );
  const retryAfter = Math.max(byIp, byAccount);
  return { allowed: retryAfter === 0, retryAfter };
}

/** 실패를 두 축 모두에 기록한다 */
export function recordFailure(key: string, email: string): void {
  const now = Date.now();
  bump(key, WINDOW_MS, now);
  bump(accountKey(email), ACCOUNT_WINDOW_MS, now);
}

/** 성공하면 두 축 모두 지운다 */
export function clearFailures(key: string, email: string): void {
  attempts.delete(key);
  attempts.delete(accountKey(email));
}
