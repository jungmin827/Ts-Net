import { z } from "zod";
import { CARRIERS } from "@/lib/validation";
import { GIFT_STATUSES, LEAD_STATUSES } from "./labels";
import { addDaysKst, monthStartKst, todayKst } from "@/lib/kst";

// 어드민 목록·내보내기의 모든 입력은 zod 로 검증한다 (기간 파라미터 포함).
// 쿼리스트링은 사용자가 직접 조작할 수 있으므로 화면 필터를 믿지 않는다.

export const PAGE_SIZE = 50;

/** 기간 프리셋 — 직접입력(custom) 은 from/to 를 함께 받는다 */
export const PERIODS = ["today", "7d", "30d", "month", "custom"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABEL: Record<Period, string> = {
  today: "오늘",
  "7d": "최근 7일",
  "30d": "최근 30일",
  month: "이번 달",
  custom: "직접입력",
};

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다");

/** 이름·번호뒷자리 검색어 — PostgREST or() 문법을 깨뜨리는 문자를 애초에 제거한다 */
const searchTerm = z
  .string()
  .max(50)
  .transform((v) => v.replace(/[^0-9A-Za-z가-힣\s]/g, "").trim());

export const leadFilterSchema = z.object({
  period: z.enum(PERIODS).default("30d"),
  from: dateString.optional(),
  to: dateString.optional(),
  carrier: z.enum(CARRIERS).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  gift: z.enum(GIFT_STATUSES).optional(),
  utm: z.string().max(100).optional(),
  /** 중복 배분 방지 — "미내보내기 건만" 을 기본 제공 */
  exported: z.enum(["all", "yes", "no"]).default("all"),
  q: searchTerm.optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

export type LeadFilter = z.infer<typeof leadFilterSchema>;

/** 내보내기는 페이지네이션 없이 구간 전체를 대상으로 한다 */
export const exportFilterSchema = leadFilterSchema.omit({ page: true });
export type ExportFilter = z.infer<typeof exportFilterSchema>;

type RawParams = Record<string, string | string[] | undefined>;

/** 빈 문자열은 "미선택"으로 간주해 제거 — zod optional 과 조합하기 위함 */
function compact(raw: RawParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (typeof value === "string" && value.trim() !== "") out[k] = value.trim();
  }
  return out;
}

export function parseLeadFilter(raw: RawParams): LeadFilter {
  const parsed = leadFilterSchema.safeParse(compact(raw));
  // 잘못된 쿼리스트링으로 화면이 깨지지 않도록 기본 필터로 복구한다
  return parsed.success ? parsed.data : leadFilterSchema.parse({});
}

export function parseExportFilter(raw: RawParams) {
  return exportFilterSchema.safeParse(compact(raw));
}

/** 프리셋/직접입력을 실제 KST 날짜 구간으로 확정한다 */
export function resolvePeriod(filter: {
  period: Period;
  from?: string;
  to?: string;
}): { from: string; to: string } {
  const today = todayKst();
  switch (filter.period) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: addDaysKst(today, -6), to: today };
    case "30d":
      return { from: addDaysKst(today, -29), to: today };
    case "month":
      return { from: monthStartKst(), to: today };
    case "custom": {
      const from = filter.from ?? addDaysKst(today, -29);
      const to = filter.to ?? today;
      // 거꾸로 입력된 구간은 뒤집어 받아준다
      return from <= to ? { from, to } : { from: to, to: from };
    }
  }
}

/** 필터를 링크용 쿼리스트링으로. 기본값은 생략해 URL 을 짧게 유지한다 */
export function filterToQuery(
  filter: LeadFilter,
  override: Partial<LeadFilter> = {},
): string {
  const merged = { ...filter, ...override };
  const sp = new URLSearchParams();
  if (merged.period !== "30d") sp.set("period", merged.period);
  if (merged.period === "custom") {
    if (merged.from) sp.set("from", merged.from);
    if (merged.to) sp.set("to", merged.to);
  }
  if (merged.carrier) sp.set("carrier", merged.carrier);
  if (merged.status) sp.set("status", merged.status);
  if (merged.gift) sp.set("gift", merged.gift);
  if (merged.utm) sp.set("utm", merged.utm);
  if (merged.exported !== "all") sp.set("exported", merged.exported);
  if (merged.q) sp.set("q", merged.q);
  if (merged.page > 1) sp.set("page", String(merged.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** access_logs.detail 에 남길 필터 요약 — 개인정보는 넣지 않는다 */
export function filterToAuditDetail(
  filter: Omit<LeadFilter, "page"> & { page?: number },
  range: { from: string; to: string },
): Record<string, unknown> {
  return {
    from: range.from,
    to: range.to,
    period: filter.period,
    carrier: filter.carrier ?? null,
    status: filter.status ?? null,
    gift_status: filter.gift ?? null,
    utm_source: filter.utm ?? null,
    exported: filter.exported,
    // 검색어는 이름·번호뒷자리일 수 있어 길이만 기록한다
    q_len: filter.q ? filter.q.length : 0,
    page: filter.page ?? null,
  };
}
