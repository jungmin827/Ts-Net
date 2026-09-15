import { formatContract, formatWon, type Plan } from "@/lib/plans";
import type { CarrierMenuItem } from "@/lib/site-config";

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
    <section className="py-14">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="mb-2 text-center text-2xl font-black md:text-3xl">
          추천 상품
        </h2>
        <p className="mb-8 text-center text-sm text-gray-500">
          {carrier.label} 상품 중 문의가 많은 구성입니다
        </p>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {top.map((p) => (
            <div
              key={p.id}
              className="flex flex-col rounded-2xl border-t-4 bg-white p-6 shadow-sm"
              style={{ borderTopColor: `var(${carrier.colorVar})` }}
            >
              <h3 className="text-lg font-bold">{p.name}</h3>
              {p.speed && (
                <p className="mt-1 text-sm text-gray-500">{p.speed}</p>
              )}
              {p.description && (
                <p className="mt-3 text-sm leading-relaxed text-gray-500">
                  {p.description}
                </p>
              )}

              <dl className="mt-5 flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">월 요금</dt>
                  <dd className="text-lg font-black text-brand">
                    {formatWon(p.monthly_fee)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">약정</dt>
                  <dd className="font-medium">
                    {formatContract(p.contract_months)}
                  </dd>
                </div>
                {p.gift_amount != null && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">현금 사은품</dt>
                    <dd className="font-bold text-accent">
                      최대 {formatWon(p.gift_amount)}
                    </dd>
                  </div>
                )}
              </dl>

              {/* 설명 유무로 카드 내용 길이가 달라져도 CTA는 카드 하단에 맞춘다 */}
              <div className="mt-auto pt-6">
                <a
                  href="#consult"
                  className="block rounded-lg bg-brand py-3 text-center font-bold text-white transition-colors hover:bg-brand-dark"
                >
                  이 상품 상담하기
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
