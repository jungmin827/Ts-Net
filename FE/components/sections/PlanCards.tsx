import {
  TABLE_SORT_MIN,
  formatContract,
  formatWon,
  type Plan,
} from "@/lib/plans";
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
  /**
   * 추천은 `sort_order < TABLE_SORT_MIN` 인 행만이다.
   *
   * 예전에는 `plans.slice(0, 3)` 이었다. 정렬이 `sort_order asc` 라서 지금
   * 시드(4사 모두 추천 3행)에서는 우연히 맞는다. 그런데 운영자가 한 통신사의
   * 추천을 2개로 줄이거나 하나를 `is_active = false` 로 내리는 순간
   * **결합표 첫 행(`sort_order` 10)을 끌어온다.** 그러면 같은 상품이 추천 카드와
   * 요금표에 동시에 나와, `tableRows()` 가 막으려던 "같은 금액이 두 이름으로
   * 보이는" 상태가 그대로 재현된다.
   * 제외가 표 쪽에만 있었다 — 축을 같은 상수로 묶는다.
   */
  const top = plans
    .filter((p) => (p.sort_order ?? 0) < TABLE_SORT_MIN)
    .slice(0, 3);
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
                  <p className="mt-1 text-sm font-bold text-brand-dark">{p.speed}</p>
                )}
                {p.description && (
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {p.description}
                  </p>
                )}

                <dl className="mt-4 flex flex-col gap-1.5 text-sm">
                  {/* TV 구성은 상품을 가르는 핵심 축인데 그동안 카드에 없었다.
                      설명문이 비어 있으면(레퍼런스 카피 제거 후 전부 NULL) 카드가
                      이름·속도·금액만 남아 무엇이 다른 상품인지 알 수 없다.
                      지어낸 문장 대신 **DB 에 있는 사실**로 메운다. */}
                  {p.tv_option && (
                    <div className="flex justify-between gap-3">
                      <dt className="shrink-0 text-muted">TV 구성</dt>
                      <dd className="text-right font-medium">{p.tv_option}</dd>
                    </div>
                  )}
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
                    // 주 CTA 와 같은 동작(#consult)이므로 같은 색을 쓴다
                    className="cta-fill flex items-center justify-center gap-1.5 rounded-xl py-3.5 font-bold transition-colors duration-200"
                  >
                    이 상품 상담하기
                    <Icon name="arrowRight" size={17} />
                  </a>
                </div>
              </div>

              {/* 요금 띠 — 카드에서 가장 먼저 눈에 들어와야 하는 정보.
                  **옅은 면**에 진한 글자로 둔다. 예전에는 진초록 면이었는데,
                  바로 위 상담 버튼도 진초록이라 카드마다 진한 색면이 둘씩 쌓였다.
                  통신사 페이지 전체 초록 색면이 3.08% 까지 올라가 CLAUDE.md 가
                  못 박은 상한(1.22%)을 넘겼고, 보기에도 무거웠다.
                  금액이 먼저 읽히는 건 면의 진하기가 아니라 **크기와 굵기**가 만든다. */}
              <div className="flex items-baseline justify-between gap-2 bg-brand-light px-6 py-4 text-brand-deep">
                <span className="text-sm font-bold">월 요금</span>
                <span className="flex items-baseline gap-2">
                  {/* 할인 전 금액. 흐리게 하려고 opacity 를 쓰지 않는다 —
                      70% 로 내렸더니 3.96:1 이 됐다(본문 4.5 미달).
                      취소선과 작은 크기가 이미 "지난 값"이라고 말한다.
                      같은 실수를 요금 띠 흰 글자(text-white/85)에서도 한 번 했다. */}
                  {p.list_fee != null && p.list_fee !== p.monthly_fee && (
                    <span className="tabular text-sm line-through">
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
