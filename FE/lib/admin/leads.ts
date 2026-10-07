import { kstRangeToUtc } from "@/lib/kst";
import type { SupabaseServerClient } from "./auth";
import type { LeadFilter } from "./filters";

// leads 조회 컬럼 목록을 한 곳에 모아 둔다.
// phone_enc 는 "복호화가 필요한 경로"에서만 선택한다 —
// 목록·상세 화면은 phone_masked 만 읽으므로 암호문이 메모리에 올라오지도 않는다.

export const LEAD_LIST_COLUMNS =
  "id, created_at, name, phone_masked, carrier, product, utm_source, status, gift_status, exported_at";

export const LEAD_DETAIL_COLUMNS =
  "id, created_at, updated_at, name, phone_masked, carrier, product, memo, " +
  "utm_source, utm_medium, utm_campaign, utm_content, landing_path, referrer, " +
  "consent_privacy, consent_marketing, consent_at, status, gift_status, exported_at, purge_at";

/** 엑셀 내보내기 전용 — phone_enc 포함 */
export const LEAD_EXPORT_COLUMNS =
  "id, created_at, name, phone_enc, phone_masked, carrier, product, memo, " +
  "utm_source, utm_medium, utm_campaign, status, gift_status, exported_at";

export interface LeadListRow {
  id: number;
  created_at: string;
  name: string;
  phone_masked: string;
  carrier: string | null;
  product: string | null;
  utm_source: string | null;
  status: string;
  gift_status: string;
  exported_at: string | null;
}

export interface LeadExportRow extends Omit<LeadListRow, "utm_source"> {
  phone_enc: string;
  memo: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

export interface LeadDetailRow {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  phone_masked: string;
  carrier: string | null;
  product: string | null;
  memo: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  landing_path: string | null;
  referrer: string | null;
  consent_privacy: boolean;
  consent_marketing: boolean;
  consent_at: string | null;
  status: string;
  gift_status: string;
  exported_at: string | null;
  purge_at: string;
}

export interface LeadLogRow {
  id: number;
  field: string;
  before_val: string | null;
  after_val: string | null;
  created_at: string;
}

/**
 * 화면 필터를 그대로 쿼리에 반영한다.
 * 정렬·페이지네이션은 호출부에서 덧붙인다 (Transform 단계로 넘어가면 필터 추가가 불가).
 */
export function buildLeadQuery(
  supabase: SupabaseServerClient,
  columns: string,
  filter: Omit<LeadFilter, "page">,
  range: { from: string; to: string },
  options?: { count?: boolean; head?: boolean },
) {
  const { startIso, endIso } = kstRangeToUtc(range.from, range.to);

  let query = supabase
    .from("leads")
    // head:true 면 행을 한 줄도 전송하지 않고 count 만 받는다.
    // 집계 카드처럼 숫자만 필요한 자리에서 id 수천 개를 받아 버리던 걸 막는다.
    .select(
      columns,
      options?.count
        ? { count: "exact", ...(options.head ? { head: true } : {}) }
        : undefined,
    )
    .gte("created_at", startIso)
    .lte("created_at", endIso);

  if (filter.carrier) query = query.eq("carrier", filter.carrier);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.gift) query = query.eq("gift_status", filter.gift);
  if (filter.utm) query = query.eq("utm_source", filter.utm);
  if (filter.exported === "yes") query = query.not("exported_at", "is", null);
  if (filter.exported === "no") query = query.is("exported_at", null);
  if (filter.q) {
    // 이름 또는 번호 뒷자리(phone_masked 꼬리) 검색.
    // 평문 번호로는 검색할 수 없다 — 암호문은 검색 대상이 아니다.
    query = query.or(`name.ilike.*${filter.q}*,phone_masked.ilike.*${filter.q}*`);
  }

  return query;
}
