import { publicClient } from "./supabase/public";
import { TABLE_SORT_MIN, type Plan } from "./plans";

/**
 * 통신사별 "무엇을 고를 수 있는가"를 `plans` 테이블에서 집계한다.
 *
 * `getCarrierPriceComparison`(lib/plans.ts)은 **한 속도의 최저가 한 점**을 본다.
 * 여기는 반대로 **선택 폭**을 본다 — 고를 수 있는 속도, TV 구성, 요금 범위, 약정 길이.
 * 두 섹션이 같은 데이터를 쓰지만 답하는 질문이 다르다.
 *
 * 집계만 하고 평가는 하지 않는다. "어디가 더 싸다/좋다"는 판단을 붙이면
 * 객관적 근거가 필요한 비교광고가 된다 (CLAUDE.md 규칙 6).
 * 화면은 숫자를 나란히 놓고, 해석은 방문자와 상담에 맡긴다.
 */
export interface CarrierFeature {
  carrier: string;
  /** 결합 상품에서 고를 수 있는 인터넷 속도 (느린 순) */
  speeds: string[];
  /** 결합 상품의 TV 구성명 */
  tvOptions: string[];
  /** 인터넷+TV 결합 월요금의 최저·최고 */
  minFee: number;
  maxFee: number;
  /** 등록된 약정 기간(개월). 보통 한 가지다 */
  contractMonths: number[];
  /** 집계에 들어간 결합 상품 수 */
  comboCount: number;
}

/**
 * 100M < 200M < 500M < 1G 정렬용 순위값.
 * `lib/plans.ts` 의 비공개 `speedRank` 와 같은 규칙이다 — 동시 작업 중인 파일을
 * 건드리지 않기 위해 여기에 한 벌 둔다. 규칙을 바꾸려면 양쪽을 같이 고칠 것.
 */
function speedRank(s: string): number {
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([MG])/i);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const n = Number(m[1]);
  return m[2].toUpperCase() === "G" ? n * 1000 : n;
}

/** 중복 제거 + 정렬된 숫자 배열 */
function uniqNums(values: (number | null)[]): number[] {
  return [...new Set(values.filter((v): v is number => v != null))].sort(
    (a, b) => a - b,
  );
}

/**
 * 통신사별 결합 상품 집계.
 *
 * 추천 카드 전용 행(`sort_order < TABLE_SORT_MIN`)은 결합표 행의 별칭이라 제외한다 —
 * 포함하면 같은 구성이 두 번 잡혀 상품 수가 부풀려진다.
 *
 * 키 미설정·조회 실패·데이터 없음이면 빈 배열. 호출부가 섹션을 렌더링하지 않는다.
 */
export async function getCarrierFeatures(): Promise<CarrierFeature[]> {
  const supabase = publicClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("plans")
    .select("carrier, speed, tv_option, monthly_fee, contract_months, sort_order")
    .eq("category", "BUNDLE")
    .eq("is_active", true)
    .gte("sort_order", TABLE_SORT_MIN)
    .not("monthly_fee", "is", null);

  if (error) {
    console.error("[plans] 통신사 특징 집계 실패:", error.code, error.message);
    return [];
  }

  const rows = (data ?? []) as Plan[];
  const byCarrier = new Map<string, Plan[]>();
  for (const row of rows) {
    if (row.monthly_fee == null) continue;
    const list = byCarrier.get(row.carrier);
    if (list) list.push(row);
    else byCarrier.set(row.carrier, [row]);
  }

  const out: CarrierFeature[] = [];
  for (const [carrier, list] of byCarrier) {
    const fees = list.map((p) => p.monthly_fee as number);
    out.push({
      carrier,
      speeds: [
        ...new Set(list.map((p) => p.speed).filter((s): s is string => !!s)),
      ].sort((a, b) => speedRank(a) - speedRank(b)),
      tvOptions: [
        ...new Set(list.map((p) => p.tv_option).filter((t): t is string => !!t)),
      ],
      minFee: Math.min(...fees),
      maxFee: Math.max(...fees),
      contractMonths: uniqNums(list.map((p) => p.contract_months)),
      comboCount: list.length,
    });
  }
  return out;
}
