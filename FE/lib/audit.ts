import { createAdminClient } from "./supabase/admin";

// 개인정보 접속기록 (법정 1년 보관).
// LIST(목록조회) / VIEW(상세) / DECRYPT(번호 복호화) / EXPORT(엑셀) / UPDATE / DELETE
export type AuditAction =
  | "LIST"
  | "VIEW"
  | "DECRYPT"
  | "EXPORT"
  | "UPDATE"
  | "DELETE";

export interface AuditEntry {
  actorId?: string;
  actorEmail?: string;
  action: AuditAction;
  target?: string;
  rowCount?: number;
  /** 조회·내보내기 필터 조건 등 */
  detail?: Record<string, unknown>;
  ip?: string;
}

/** 실패 시 throw — 감사로그를 남기지 못한 채 개인정보 접근이 진행되면 안 된다 */
export async function logAccess(entry: AuditEntry): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("access_logs").insert({
    actor_id: entry.actorId ?? null,
    actor_email: entry.actorEmail ?? null,
    action: entry.action,
    target: entry.target ?? null,
    row_count: entry.rowCount ?? null,
    detail: entry.detail ?? null,
    ip: entry.ip ?? null,
  });
  if (error) {
    throw new Error(`access_logs 기록 실패: ${error.message}`);
  }
}
