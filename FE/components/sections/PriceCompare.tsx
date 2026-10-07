import { getCarrierPriceComparison } from "@/lib/plans";
import { PLAN_DISCLAIMER } from "@/lib/site-config";
import SectionHeading from "@/components/ui/SectionHeading";
import PriceBars from "./PriceBars";

/**
 * 통신사 4사 월요금 비교.
 *
 * 레퍼런스는 같은 자리에서 "타사 52,800 / 타사 49,500 / 우리 40,700" 식으로
 * **경쟁사 대비 우위**를 주장한다. 우리는 그렇게 하지 않는다 —
 * 근거 없는 비교 주장은 표시광고법 리스크이고, 애초에 우리는 4사를 다 판다.
 * 대신 **우리가 취급하는 4사끼리** 같은 조건으로 비교해 선택을 돕는다.
 *
 * 데이터가 없으면(키 미설정·DB 비어있음) 섹션 자체가 렌더링되지 않는다.
 */
const SPEED = "500M";

export default async function PriceCompare() {
  const items = await getCarrierPriceComparison(SPEED);

  // 한두 개만 있으면 '비교'가 성립하지 않는다
  if (items.length < 3) return null;

  return (
    <section className="bg-surface-muted py-16 md:py-20">
      <div className="mx-auto max-w-4xl px-4">
        <SectionHeading
          title="같은 조건, 통신사별 월 요금"
          description={`인터넷 ${SPEED} + TV 결합 기준으로 4사를 나란히 놓았습니다`}
        />

        <div className="rounded-panel border border-line bg-white p-5 shadow-card md:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-black text-foreground md:text-lg">
              인터넷 {SPEED} + TV · 월 납부요금
            </h3>
            <p className="text-[11px] text-muted md:text-xs">
              단위: 원/월 · 3년 약정 · 휴대폰 1회선 결합 · VAT 포함
            </p>
          </div>

          <PriceBars items={items} />

          <p className="mt-7 border-t border-line pt-5 text-[11px] leading-relaxed text-muted md:text-xs">
            통신사마다 TV 구성 등급 체계가 달라 같은 금액이라도 채널 수와 부가서비스가
            다릅니다. 막대 아래 구성명을 함께 확인해 주세요. {PLAN_DISCLAIMER}
          </p>
        </div>
      </div>
    </section>
  );
}
