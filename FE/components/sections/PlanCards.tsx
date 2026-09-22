import { formatContract, formatWon, type Plan } from "@/lib/plans";
import type { CarrierMenuItem } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";

/** 추천 상품 3카드 — plans 의 sort_order 상위 3건. 비어 있으면 상위 컴포넌트가 준비중 안내를 렌더 */
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
          eyebrow="BEST"
          title="추천 상품"
          description={`${carrier.label} 상품 중 문의가 많은 구성입니다`}
        />

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {top.map((p, i) => (
            <Reveal key={p.id} delay={i * 80}>
              <div className="group relative flex h-full flex-col overflow-hidden rounded-panel border border-line bg-white p-6 shadow-soft transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:shadow-lift">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-1 transition-all duration-300 group-hover:h-1.5"
                  style={{ backgroundColor: `var(${carrier.colorVar})` }}
                />

                <h3 className="text-lg font-bold">{p.name}</h3>
                {p.speed && (
                  <p className="mt-1 text-sm font-medium text-brand">
                    {p.speed}
                  </p>
                )}
                {p.description && (
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {p.description}
                  </p>
                )}

                <dl className="mt-5 flex flex-col gap-2 border-t border-line pt-5 text-sm">
                  <div className="flex items-baseline justify-between">
                    <dt className="text-muted">월 요금</dt>
                    <dd className="text-2xl font-black text-brand">
                      {formatWon(p.monthly_fee)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">약정</dt>
                    <dd className="font-medium">
                      {formatContract(p.contract_months)}
                    </dd>
                  </div>
                  {p.gift_amount != null && (
                    <div className="flex justify-between">
                      <dt className="text-muted">현금 사은품</dt>
                      <dd className="flex items-center gap-1 font-bold text-accent">
                        <Icon name="gift" size={15} />
                        최대 {formatWon(p.gift_amount)}
                      </dd>
                    </div>
                  )}
                </dl>

                {/* 설명 유무로 카드 내용 길이가 달라져도 CTA는 카드 하단에 맞춘다 */}
                <div className="mt-auto pt-6">
                  <a
                    href="#consult"
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-brand py-3.5 font-bold text-white shadow-brand transition-all duration-200 hover:bg-brand-dark hover:shadow-lift"
                  >
                    이 상품 상담하기
                    <Icon name="arrowRight" size={17} />
                  </a>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
