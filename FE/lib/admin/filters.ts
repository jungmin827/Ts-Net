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

/**
 * 달력에 **실재하는** 날짜만 통과시킨다.
 *
 * 형식 검사만 하면 `2026-02-29` 가 그대로 지나간다. 2026 년은 윤년이 아니라
 * 그런 날이 없는데, `Date.UTC(2026, 1, 29)` 는 **조용히 3월 1일로 밀어** 버린다.
 * 운영자는 2월까지를 골랐다고 믿는데 실제 조회는 3월 1일까지 간다 (실측 확인).
 * `2026-02-31` 은 3월 3일까지 밀린다.
 *
 * 더 나쁜 쪽은 `2026-13-01` 이다 — `Date` 가 Invalid 가 되고
 * `kstRangeToUtc` 의 `toISOString()` 이 **RangeError 를 던진다.**
 * 어드민 목록·내보내기가 통째로 500 이 된다.
 *
 * 그래서 문자열 → 날짜 → 문자열 왕복이 **같은 값으로 돌아오는지**까지 본다.
 */
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다")
  .refine(
    (v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    },
    { message: "달력에 없는 날짜입니다" },
  );

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

/**
 * 시작일이 종료일보다 뒤면 거른다.
 *
 * 이게 없으면 `from=2026-03-01&to=2026-01-01` 이 그대로 통과한다. 쿼리는
 * `created_at >= 2026-03-01 AND created_at <= 2026-01-01` 이 되어 **항상 0건**이고,
 * 화면에는 "선택한 기간·조건에 내보낼 내역이 없습니다" 만 뜬다.
 * 운영자는 데이터가 없다고 믿지, 기간이 거꾸로라는 건 끝까지 모른다.
 * 날짜 입력 두 칸이 나란히 있는 UI 에서 충분히 나오는 실수다.
 */
const rangeOrdered = <T extends { from?: string; to?: string }>(v: T, ctx: z.RefinementCtx) => {
  if (v.from && v.to && v.from > v.to) {
    ctx.addIssue({
      code: "custom",
      path: ["to"],
      message: "종료일이 시작일보다 빠릅니다. 기간을 확인해 주세요",
    });
  }
};

/** 내보내기는 페이지네이션 없이 구간 전체를 대상으로 한다 */
export const exportFilterSchema = leadFilterSchema
  .omit({ page: true })
  .superRefine(rangeOrdered);
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
  const parsed = leadFilterSchema
    .superRefine(rangeOrdered)
    .safeParse(compact(raw));
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
