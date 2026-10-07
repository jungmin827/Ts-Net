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
      /*
       * ⚠ 왕복은 **값을 실제로 쓰는 쪽과 같은 방법**으로 해야 한다.
       *
       * 처음에는 `new Date("YYYY-MM-DDT00:00:00Z")` 로 봤다. 그런데 정작 조회
       * 구간을 만드는 `kstRangeToUtc` 는 `Date.UTC(y, m-1, d)` 를 쓴다.
       * 둘은 **같은 문자열을 다른 날로 읽는다** — `Date.UTC` 는 연도 0~99 를
       * 1900~1999 로 옮긴다. `0026-01-01` 이 검사를 통과하고 실제로는
       * 1926년을 조회한다. "문자열이 가리키는 날과 조회되는 날이 같다"는
       * 이 검사의 존재 이유가 바로 거기서 깨진다.
       */
      const [y, m, d] = v.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (Number.isNaN(dt.getTime())) return false;
      if (dt.getUTCFullYear() !== y) return false; // 0~99 보정에 걸린 경우
      if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return false;
      return true;
    },
    { message: "달력에 없는 날짜입니다" },
  )
  .refine((v) => {
    // 접수 데이터가 존재할 수 있는 구간 밖은 애초에 입력이 아니다.
    // 범위를 안 걸면 `9999-12-31` 같은 값이 통과해 조회가 무의미해진다.
    const y = Number(v.slice(0, 4));
    return y >= 2000 && y <= 2100;
  }, "2000~2100년 사이 날짜만 조회할 수 있습니다");

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
  const cleaned = compact(raw);
  const parsed = leadFilterSchema.superRefine(rangeOrdered).safeParse(cleaned);
  if (parsed.success) return parsed.data;

  /*
   * 한 칸이 틀렸다고 **전부 버리지 않는다.**
   *
   * 예전에는 실패하면 `leadFilterSchema.parse({})` 로 기본 필터(최근 30일·전체)를
   * 돌려줬다. 그러면 날짜 한 칸을 잘못 적은 순간 통신사·상태·사은품·검색어까지
   * 통째로 날아가고, 화면은 **아무 설명 없이** 다른 목록을 보여준다.
   * 운영자는 자기가 건 조건이 왜 사라졌는지 알 수 없다.
   *
   * 문제가 된 키만 떼어내고 나머지로 다시 파싱한다. 날짜가 틀렸으면 기간만
   * 기본값으로 돌아가고 통신사·상태·검색어는 살아남는다.
   */
  const badKeys = new Set(
    parsed.error.issues.map((i) => String(i.path[0] ?? "")).filter(Boolean),
  );
  // 기간 관련 문제면 period 까지 함께 되돌린다 — from/to 만 빼면 custom 이 남아
  // 또 걸린다
  if (badKeys.has("from") || badKeys.has("to")) {
    badKeys.add("from");
    badKeys.add("to");
    badKeys.add("period");
  }
  const rest = Object.fromEntries(
    Object.entries(cleaned).filter(([k]) => !badKeys.has(k)),
  );
  const retry = leadFilterSchema.superRefine(rangeOrdered).safeParse(rest);
  return retry.success ? retry.data : leadFilterSchema.parse({});
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
