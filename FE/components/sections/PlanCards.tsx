import { formatContract, formatWon, type Plan } from "@/lib/plans";
import type { CarrierMenuItem } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";
import SectionHeading from "@/components/ui/SectionHeading";

/**
 * 추천 상품 3카드 — plans 의 sort_order 상위 3건.
 *
 * 카드 하단에 색을 채운 띠를 깔고 그 안에 월 요금을 넣는다.
 * 요금 비교 화면에서 가장 빨리 읽히는 배치라, 본문과 금액을 같은 무게로
 * 나열하는 것보다 스캔이 훨씬 빠르다.
 */
export default function PlanCards({
  plans,
  carrier,
}: {
  plans: Plan[];
  carrier: CarrierMenuItem;
}) {
  const top = plans.slice(0, 3);
  if (top.length === 0) return null;

  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          title="추천 상품"
          description={`${carrier.label} 상품 중 문의가 많은 구성입니다`}
        />

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {top.map((p) => (
            <div
              key={p.id}
              className="flex h-full flex-col overflow-hidden rounded-panel border-2 border-line bg-white"
            >
              {/* 통신사 색 스트라이프 — 어느 통신사 상품인지 카드 자체가 말하게 */}
              <span
                aria-hidden="true"
                className="h-1.5 w-full"
                style={{ backgroundColor: `var(${carrier.colorVar})` }}
              />

              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-lg font-bold">{p.name}</h3>
                {p.speed && (
                  <p className="mt-1 text-sm font-bold text-brand">{p.speed}</p>
                )}
                {p.description && (
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {p.description}
                  </p>
                )}

                <dl className="mt-4 flex flex-col gap-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">약정</dt>
                    <dd className="tabular font-medium">
                      {formatContract(p.contract_months)}
                    </dd>
                  </div>
                  {p.gift_amount != null && (
                    <div className="flex justify-between">
                      <dt className="text-muted">현금 사은품</dt>
                      <dd className="tabular flex items-center gap-1 font-bold">
                        <Icon name="gift" size={15} />
                        최대 {formatWon(p.gift_amount)}
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="mt-auto pt-6">
                  <a
                    href="#consult"
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-accent py-3.5 font-bold text-accent-ink transition-colors duration-200 hover:bg-accent-dark"
                  >
                    이 상품 상담하기
                    <Icon name="arrowRight" size={17} />
                  </a>
                </div>
              </div>

              {/* 요금 띠 — 카드에서 가장 먼저 눈에 들어와야 하는 정보 */}
              <div className="flex items-baseline justify-between gap-2 bg-brand px-6 py-4 text-white">
                <span className="text-sm font-medium text-white/85">월 요금</span>
                <span className="flex items-baseline gap-2">
                  {p.list_fee != null && p.list_fee !== p.monthly_fee && (
                    <span className="tabular text-sm text-white/65 line-through">
                      {formatWon(p.list_fee)}
                    </span>
                  )}
                  <span className="tabular text-2xl font-black">
                    {formatWon(p.monthly_fee)}
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
