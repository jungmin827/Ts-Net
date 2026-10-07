import { logAccess, type AuditEntry } from "@/lib/audit";

// access_logs 기록은 두 종류로 나눈다.
//
//  - logAccess (lib/audit.ts, 실패 시 throw)
//      개인정보가 실제로 노출·복호화·반출되는 경로. 기록이 실패하면 접근 자체를 막는다.
//      (CLAUDE.md 규칙 3 — 복호화는 반드시 access_logs 에 기록)
//  - logAccessSoft (아래)
//      로그인/로그아웃·집계 조회처럼 개인정보가 드러나지 않는 경로.
//      감사로그 DB 가 일시적으로 막혔다고 로그인조차 못 하는 상황을 피한다.
export async function logAccessSoft(entry: AuditEntry): Promise<void> {
  try {
    await logAccess(entry);
  } catch (e) {
    // 기록 실패 자체만 남긴다 — 전화번호 등 개인정보는 어떤 로그에도 쓰지 않는다
    console.error(
      "[admin/audit] access_logs 기록 실패:",
      entry.action,
      e instanceof Error ? e.message : e,
    );
  }
}

/**
 * Route Handler 에서 접속자 IP — 접속기록의 법정 기재항목.
 *
 * 값 선택은 `lib/client-ip.ts` 한 곳에 모았다. 예전에는 여기서 직접
 * `x-forwarded-for` 맨 앞 값을 읽었는데, 그건 클라이언트가 적어 보내는
 * 문자열이라 기록에 남는 IP 가 통째로 조작될 수 있었다.
 */
export { requestIp } from "@/lib/client-ip";
