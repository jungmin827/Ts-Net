import { publicClient } from "./supabase/public";

export type PlanCategory = "INTERNET" | "TV" | "BUNDLE" | "MOBILE";

export interface Plan {
  id: number;
  carrier: string;
  category: PlanCategory;
  name: string;
  speed: string | null;
  monthly_fee: number | null;
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
      "id, carrier, category, name, speed, monthly_fee, contract_months, gift_amount, description, sort_order",
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
