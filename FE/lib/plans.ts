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

/**
 * 요금제 설명문 차단 스위치.
 *
 * 라이브 DB 에 적용된 시드가 폐기된 구 시드(50행)이고, 그중 12행의 `description` 에
 * 레퍼런스 사이트의 마케팅 카피가 그대로 들어 있다 (CLAUDE.md 규칙 5 위반).
 *
 * 화면에서 가리는 것만으로는 부족하다 — 서버 컴포넌트가 클라이언트 컴포넌트로
 * 넘기는 값은 **RSC 페이로드로 HTML 에 직렬화되어** 페이지 소스에 그대로 남는다.
 * 그래서 조회 직후 데이터 단계에서 지운다.
 *
 * 2026-10-13 재시드 완료 후 **해제했다.** 라이브 72행을 확인한 결과
 * `description` 은 9행만 채워져 있고 전부 사실 정보다 —
 * "239개 채널 / TV 추가 1대당 월 10,670원" 같은 채널 수·추가 요금.
 * 레퍼런스 카피가 들어 있던 12행(3개 문장이 4개 통신사에 복제된 형태)은
 * 시드의 `delete from plans where carrier in (...)` 로 사라졌다.
 *
 * ⚠ 다시 `true` 로 올려야 하는 경우 — 시드를 거치지 않고 누가 대시보드에서
 *   `description` 을 채웠고 그게 레퍼런스에서 가져온 문장일 때.
 *   `verify-goals` 의 "레퍼런스 카피 제거(목표 9)" 검사가 9가 아닌 값을
 *   보고하면 그 신호다.
 */
export const SUPPRESS_PLAN_DESCRIPTION = false;

/** 차단 스위치가 켜져 있으면 description 을 비운 사본을 돌려준다 */
function stripDescription(rows: Plan[]): Plan[] {
  if (!SUPPRESS_PLAN_DESCRIPTION) return rows;
  return rows.map((r) => (r.description ? { ...r, description: null } : r));
}

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
  return stripDescription((data as Plan[]) ?? []);
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

/**
 * 같은 카테고리 안에서 인터넷 속도별로 다시 묶는다 (100M < 200M < 500M < 1G).
 *
 * 결합표는 속도 × TV 구성의 곱이라 한 통신사에서 6~10행이 된다. 한 번에 다 쌓으면
 * 읽히지 않으므로 화면에서는 속도 단위로 나눠 접는다. 속도가 없는 행(TV·휴대폰 단독)은
 * `null` 키 하나로 모은다 — 쪼갤 축이 없는 데이터를 억지로 쪼개지 않는다.
 */
export function groupBySpeed(plans: Plan[]): [string | null, Plan[]][] {
  const keys: (string | null)[] = [];
  for (const p of plans) {
    const k = p.speed ?? null;
    if (!keys.includes(k)) keys.push(k);
  }
  keys.sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return speedRank(a) - speedRank(b);
  });
  return keys.map(
    (k) =>
      [k, plans.filter((p) => (p.speed ?? null) === k)] as [
        string | null,
        Plan[],
      ],
  );
}

/** 목록 안 최저 월요금. 값이 하나도 없으면 null (0 으로 둘러대지 않는다) */
export function minMonthlyFee(plans: Plan[]): number | null {
  const fees = plans
    .map((p) => p.monthly_fee)
    .filter((f): f is number => f != null);
  return fees.length === 0 ? null : Math.min(...fees);
}
