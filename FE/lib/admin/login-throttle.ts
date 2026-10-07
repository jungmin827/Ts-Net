/**
 * 어드민 로그인 시도 제한.
 *
 * **한계를 먼저 밝힌다** — 이 모듈은 프로세스 메모리에만 상태를 둔다.
 * 서버 인스턴스가 여러 개면 인스턴스별로 따로 센다. 재배포하면 초기화된다.
 * 즉 결정적인 방어가 아니라 **자동화 공격의 비용을 올리는 장치**다.
 *
 * ## 하드 차단을 거의 쓰지 않는 이유 — 잠금 자체가 공격 수단이 된다
 *
 * 앞선 판은 두 축 모두 하드 차단이었다.
 *   - IP+이메일: 15분 5회
 *   - 이메일 단독: 1시간 30회 ("IP 를 회전해도 계정당 총량이 묶인다")
 *
 * 계정 축을 넣은 이유는 맞았다 — XFF 를 바꿔가며 IP 축을 통과할 수 있었으니까.
 * 그런데 그 축이 **서비스 거부 수단**이 됐다. 어드민은 계정 1개이고
 * (CLAUDE.md 확정사항) 우회 로그인도 잠금 해제 수단도 없다. 공격자가 치르는
 * 비용은 **HTTP 요청 30번**이고, 그 뒤로는 비밀번호와 TOTP 가 모두 맞아도 429 다.
 * 15분마다 30회(분당 2회)만 흘려 보내면 접수 데이터를 영구히 열 수 없다.
 * 방어가 막으려던 것보다 큰 피해를 스스로 만들었다.
 *
 * ## 지금의 구조
 *
 * 1. **IP 를 신뢰할 수 있을 때만 하드 차단한다.**
 *    `lib/client-ip.ts` 가 Cloudflare·Vercel 이 직접 쓰는 헤더에서 온 값인지
 *    알려준다. 그 값은 클라이언트가 바꿀 수 없으므로 IP 축이 제 일을 한다.
 *    (이 프로젝트는 Cloudflare → Vercel 경로가 확정 사항이다.)
 * 2. **신뢰할 수 없는 IP, 그리고 계정 축은 지연(tarpit)으로만 다룬다.**
 *    대입 1회의 비용을 올리되 정당한 로그인을 막지는 않는다.
 *    운영자는 몇 초 기다리면 들어온다. 영구 봉쇄가 성립하지 않는다.
 * 3. 어느 경우에도 **TOTP 가 진짜 두 번째 관문**이다. 비밀번호만으로는
 *    로그인이 성립하지 않으므로, 대입 제한은 심층방어이지 주 통제가 아니다.
 *
 * 제대로 하려면 DB 테이블 + `security definer` RPC 가 필요하다
 * (레이트리밋을 `lead_rate_exceeded()` 로 옮긴 것과 같은 방식).
 * 그건 마이그레이션 적용 권한이 생긴 뒤의 과제로 남긴다.
 */

/** 신뢰 가능한 IP 축 — 단일 출처의 빠른 대입을 즉시 끊는다 */
const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_ATTEMPTS = 5;

/** 계정 축 — 차단하지 않고 지연만 준다 */
const ACCOUNT_WINDOW_MS = 60 * 60 * 1000;
/** 이 횟수를 넘으면 지연이 붙기 시작한다 */
const ACCOUNT_SOFT_LIMIT = 5;

/** 지연 곡선. 초과 1회마다 2배, 상한 4초 */
const DELAY_BASE_MS = 250;
const DELAY_MAX_MS = 4000;

/** 메모리 누수를 막는 상한. 넘으면 오래된 것부터 버린다 */
const MAX_KEYS = 5000;

/**
 * 엔트리가 **자기 윈도를 들고 있다.**
 * 앞선 판은 `prune` 이 키 종류를 구분하지 않고 전부 15분 기준으로 지웠다.
 * 그래서 "1시간 30회"라고 적어 둔 계정 축이 실제로는 15분마다 초기화돼
 * 상한이 문서의 4배로 느슨했고, 안내 문구의 남은 시간은 4배로 과장됐다.
 */
type Entry = { count: number; first: number; window: number };
const attempts = new Map<string, Entry>();

function prune(now: number) {
  for (const [k, v] of attempts) {
    if (now - v.first > v.window) attempts.delete(k);
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
export function throttleKey(
  ip: string | null | undefined,
  email: string,
): string {
  return `${ip ?? "unknown"}|${email.toLowerCase()}`;
}

/** 이메일 단독 키 — IP 를 회전해도 계정당 총량은 이 키로 묶인다 */
function accountKey(email: string): string {
  return `acct:${email.toLowerCase()}`;
}

function entryOf(key: string, now: number): Entry | null {
  const e = attempts.get(key);
  if (!e) return null;
  if (now - e.first > e.window) {
    attempts.delete(key);
    return null;
  }
  return e;
}

function bump(key: string, window: number, now: number): void {
  const e = attempts.get(key);
  if (!e || now - e.first > e.window) {
    attempts.set(key, { count: 1, first: now, window });
    return;
  }
  e.count += 1;
}

export interface LoginGate {
  /** false 면 인증을 시도하지 않고 429 로 돌려보낸다 */
  allowed: boolean;
  /** `allowed: false` 일 때 남은 잠금 시간(초) */
  retryAfter: number;
  /** 인증을 시도하기 **전에** 기다릴 시간(ms). 정당한 로그인도 이만큼 늦어진다 */
  delayMs: number;
}

function tarpit(count: number, softLimit: number): number {
  if (count < softLimit) return 0;
  const over = count - softLimit;
  return Math.min(DELAY_BASE_MS * 2 ** over, DELAY_MAX_MS);
}

/**
 * 지금 시도해도 되는가.
 *
 * @param ipTrusted 플랫폼이 설정한 헤더에서 온 IP 인가 (`lib/client-ip.ts`).
 *   false 면 공격자가 키를 회전시킬 수 있으므로 **차단하지 않고 지연만** 준다.
 *   차단해 봐야 공격자는 통과하고 정당한 사용자만 걸린다.
 */
export function checkLogin(
  key: string,
  email: string,
  ipTrusted: boolean,
): LoginGate {
  const now = Date.now();
  prune(now);

  const ipEntry = entryOf(key, now);
  const acctEntry = entryOf(accountKey(email), now);

  const ipCount = ipEntry?.count ?? 0;
  const acctCount = acctEntry?.count ?? 0;

  if (ipTrusted && ipEntry && ipCount >= IP_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfter: Math.ceil(
        (ipEntry.window - (now - ipEntry.first)) / 1000,
      ),
      delayMs: 0,
    };
  }

  // 신뢰할 수 없는 IP 축과 계정 축은 지연으로만 다룬다
  const delayMs = Math.max(
    ipTrusted ? 0 : tarpit(ipCount, IP_MAX_ATTEMPTS),
    tarpit(acctCount, ACCOUNT_SOFT_LIMIT),
  );
  return { allowed: true, retryAfter: 0, delayMs };
}

/** 실패를 두 축 모두에 기록한다 */
export function recordFailure(key: string, email: string): void {
  const now = Date.now();
  bump(key, IP_WINDOW_MS, now);
  bump(accountKey(email), ACCOUNT_WINDOW_MS, now);
}

/** 성공하면 두 축 모두 지운다 — 정당한 로그인 한 번이 지연을 전부 되돌린다 */
export function clearFailures(key: string, email: string): void {
  attempts.delete(key);
  attempts.delete(accountKey(email));
}
