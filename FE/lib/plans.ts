import { publicClient } from "./supabase/public";

export type PlanCategory = "INTERNET" | "TV" | "BUNDLE" | "MOBILE";

export interface Plan {
  id: number;
  carrier: string;
  category: PlanCategory;
  name: string;
  speed: string | null;
  /** TV 구성명(예: TV베이직). 요금 계산기의 TV 축 */
  tv_option: string | null;
  monthly_fee: number | null;
  /** 할인 전 총요금. 화면에서 monthly_fee 옆에 취소선으로 노출 */
  list_fee: number | null;
  contract_months: number | null;
  gift_amount: number | null;
  description: string | null;
  sort_order: number | null;
}

export const CATEGORY_LABEL: Record<PlanCategory, string> = {
  INTERNET: "인터넷 단독",
  TV: "TV 단독",
  BUNDLE: "인터넷 + TV 결합",
  MOBILE: "휴대폰 결합",
};

/**
 * sort_order 가 이 값 미만인 행은 '추천 상품' 카드 전용이다.
 * 같은 구성이 요금표에도 다시 나오면 같은 금액이 두 이름으로 보여 혼란스러우므로,
 * 표에서는 제외한다. (시드: 추천 1~3 / 결합표 10~ / 휴대폰 50~)
 */
export const TABLE_SORT_MIN = 10;

/** 요금표에 실을 행만 추린다 (추천 카드 전용 행 제외) */
export function tableRows(plans: Plan[]): Plan[] {
  return plans.filter((p) => (p.sort_order ?? 0) >= TABLE_SORT_MIN);
}

/** 활성 요금제만 정렬해서 조회. 조회 실패·키 미설정 시 빈 배열 (섹션이 준비중 안내로 대체됨) */
export async function getPlansByCarrier(carrier: string): Promise<Plan[]> {
  const supabase = publicClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("plans")
    .select(
      "id, carrier, category, name, speed, tv_option, monthly_fee, list_fee, contract_months, gift_amount, description, sort_order",
    )
    .eq("carrier", carrier)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("monthly_fee", { ascending: true });

  if (error) {
    console.error("[plans] 조회 실패:", error.code, error.message);
    return [];
  }
  return (data as Plan[]) ?? [];
}

/** 카테고리 표시 순서를 고정해 묶는다 (빈 카테고리는 제외) */
export function groupByCategory(plans: Plan[]): [PlanCategory, Plan[]][] {
  const order: PlanCategory[] = ["BUNDLE", "INTERNET", "TV", "MOBILE"];
  return order
    .map(
      (c) => [c, plans.filter((p) => p.category === c)] as [PlanCategory, Plan[]],
    )
    .filter(([, list]) => list.length > 0);
}

export function formatWon(value: number | null): string {
  return value == null ? "-" : `${value.toLocaleString("ko-KR")}원`;
}

export function formatContract(months: number | null): string {
  return months == null ? "-" : `${months}개월`;
}

/** 100M < 200M < 500M < 1G 순으로 정렬하기 위한 순위값 */
function speedRank(s: string): number {
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([MG])/i);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const n = Number(m[1]);
  return m[2].toUpperCase() === "G" ? n * 1000 : n;
}

export interface CalcMatrix {
  /** 속도 × TV 조합. 계산기가 이 안에서만 값을 찾는다 */
  combos: Plan[];
  speeds: string[];
  tvOptions: string[];
  mobiles: Plan[];
}

/**
 * 요금 계산기가 쓰는 표.
 * 결합표 행(sort_order >= TABLE_SORT_MIN)만 쓴다 — 추천 카드는 같은 구성의 별칭이라
 * 축에 넣으면 같은 조합이 두 번 잡힌다.
 * 표에 없는 조합은 계산하지 않는다. 없는 값을 추정해 만들지 않기 위함이다.
 */
export function buildCalcMatrix(plans: Plan[]): CalcMatrix {
  const combos = plans.filter(
    (p) =>
      p.category === "BUNDLE" &&
      (p.sort_order ?? 0) >= TABLE_SORT_MIN &&
      p.speed &&
      p.tv_option &&
      p.monthly_fee != null,
  );
  const speeds = [...new Set(combos.map((p) => p.speed as string))].sort(
    (a, b) => speedRank(a) - speedRank(b),
  );
  const tvOptions = [...new Set(combos.map((p) => p.tv_option as string))];
  const mobiles = plans
    .filter((p) => p.category === "MOBILE" && p.monthly_fee != null)
    .sort((a, b) => (a.monthly_fee ?? 0) - (b.monthly_fee ?? 0));
  return { combos, speeds, tvOptions, mobiles };
}

/** 선택한 속도·TV에 해당하는 행. 없으면 null (추정하지 않는다) */
export function findCombo(
  m: CalcMatrix,
  speed: string,
  tvOption: string,
): Plan | null {
  return (
    m.combos.find((p) => p.speed === speed && p.tv_option === tvOption) ?? null
  );
}
