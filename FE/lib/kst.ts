// 날짜·시간은 전부 Asia/Seoul 기준으로 다룬다 (CLAUDE.md 코딩 규칙).
// 서버 런타임의 TZ 설정에 의존하지 않도록 오프셋을 직접 적용한다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** ISO 문자열/Date → KST 기준 벽시계 필드 */
function kstParts(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  const shifted = new Date(d.getTime() + KST_OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
    h: shifted.getUTCHours(),
    mi: shifted.getUTCMinutes(),
    s: shifted.getUTCSeconds(),
  };
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** KST 기준 오늘 (YYYY-MM-DD) */
export function todayKst(now: Date = new Date()): string {
  const { y, m, d } = kstParts(now);
  return `${y}-${p2(m)}-${p2(d)}`;
}

/** KST 기준 이번 달 1일 (YYYY-MM-DD) */
export function monthStartKst(now: Date = new Date()): string {
  const { y, m } = kstParts(now);
  return `${y}-${p2(m)}-01`;
}

/** YYYY-MM-DD 에 일수를 더한다 (KST 날짜 산술 — DST 가 없어 UTC 산술로 안전) */
export function addDaysKst(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86400000;
  const nd = new Date(t);
  return `${nd.getUTCFullYear()}-${p2(nd.getUTCMonth() + 1)}-${p2(nd.getUTCDate())}`;
}

/**
 * KST 날짜 구간(from 00:00 ~ to 23:59:59.999)을 UTC ISO 로 변환.
 * created_at 은 timestamptz 이므로 쿼리에는 UTC 경계를 넘겨야 한다.
 */
export function kstRangeToUtc(from: string, to: string) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const startMs = Date.UTC(fy, fm - 1, fd) - KST_OFFSET_MS;
  const endMs = Date.UTC(ty, tm - 1, td) + 86400000 - KST_OFFSET_MS - 1;
  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
  };
}

/** "2026-10-08 14:32" (KST) */
export function formatKstDateTime(value: Date | string): string {
  const { y, m, d, h, mi } = kstParts(value);
  return `${y}-${p2(m)}-${p2(d)} ${p2(h)}:${p2(mi)}`;
}

/** "2026-10-08" (KST) */
export function formatKstDate(value: Date | string): string {
  const { y, m, d } = kstParts(value);
  return `${y}-${p2(m)}-${p2(d)}`;
}

/** "20261008" — 파일명용 */
export function compactKstDate(date: string): string {
  return date.replace(/-/g, "");
}

/**
 * 엑셀 셀에 넣을 Date.
 * exceljs 는 Date.getTime() 을 그대로 엑셀 시리얼로 환산하므로,
 * KST 벽시계 값을 UTC 로 만든 Date 를 넣으면 엑셀에서 KST 그대로 보인다.
 */
export function toExcelKstDate(value: Date | string): Date {
  const { y, m, d, h, mi, s } = kstParts(value);
  return new Date(Date.UTC(y, m - 1, d, h, mi, s));
}

/** KST 기준 이번 주 시작(월요일) — 주간 집계용 */
export function weekStartKst(now: Date = new Date()): string {
  const today = todayKst(now);
  const [y, m, d] = today.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=일
  const back = dow === 0 ? 6 : dow - 1;
  return addDaysKst(today, -back);
}
