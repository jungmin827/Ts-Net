"use client";

import { useMemo, useState } from "react";
import {
  buildCalcMatrix,
  findCombo,
  formatWon,
  type Plan,
} from "@/lib/plans";
import { PRICE_BASIS_LINE } from "@/lib/legal-notices";
import { PLAN_DISCLAIMER, type CarrierMenuItem } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";
import SectionHeading from "@/components/ui/SectionHeading";

/**
 * 요금 계산기 — 속도·TV·휴대폰을 고르면 합산 요금이 즉시 바뀐다.
 *
 * 값은 전부 `plans` 결합표에서 찾는다. 표에 없는 조합은 **계산하지 않고**
 * 상담 안내로 대체한다. 없는 값을 보간해 만들어내면 그 숫자는 근거가 없다.
 *
 * ── 휴대폰 축을 세 상태로 나눈 이유 ──────────────────────────
 * 처음에는 기본값이 "미포함"이었고, 그 상태에서 인터넷 금액을 그대로 보여줬다.
 * 그런데 `combos` 의 `monthly_fee` 는 **휴대폰 1회선 결합 할인이 이미 반영된**
 * 값이다 (바로 아래 각주 `PRICE_BASIS_LINE` 이 그렇게 적고 있다).
 * 즉 같은 카드 안에서 "휴대폰 미포함"이라 써 놓고 결합가를 보여주고 있었다 —
 * 결합 없이는 존재하지 않는 금액이다. 휴대폰을 고르면 그 위에 요금을 더하니
 * 기본 상태는 실제보다 낮고 선택 상태는 전제가 어긋난 채로 높았다.
 *
 * 고칠 방향은 데이터가 정한다. 시드에 **결합 미적용가가 없다.** 그러므로
 *   · 미선택 — 인터넷+TV 금액(결합 기준)만. 휴대폰 요금은 별도라고 명시
 *   · 요금제 선택 — 인터넷+TV + 휴대폰 = 월 합계
 *   · 결합 안 함 — 근거가 되는 금액이 없으므로 **금액을 비우고** 상담 안내
 * 세 가지로 나눈다. 없는 값을 지어내지 않으면서 어느 상태에서도 거짓을
 * 말하지 않는 배치는 이것뿐이다.
 */
export default function PlanCalculator({
  plans,
  carrier,
}: {
  plans: Plan[];
  carrier: CarrierMenuItem;
}) {
  const m = useMemo(() => buildCalcMatrix(plans), [plans]);

  const [speed, setSpeed] = useState(m.speeds[0] ?? "");
  const [tv, setTv] = useState(m.tvOptions[0] ?? "");
  /**
   * `null` = 아직 고르지 않음 · `"none"` = 결합하지 않음 · 숫자 = 해당 요금제 id.
   * "아직 안 고름"과 "안 쓰기로 함"은 보여줄 금액이 다르므로 같은 값으로 묶지 않는다.
   */
  const [mobileId, setMobileId] = useState<number | "none" | null>(null);

  if (m.speeds.length === 0 || m.tvOptions.length === 0) return null;

  const combo = findCombo(m, speed, tv);
  const mobile =
    typeof mobileId === "number"
      ? (m.mobiles.find((p) => p.id === mobileId) ?? null)
      : null;
  /** 결합을 안 하기로 한 상태 — 표에 그 금액이 없으므로 합계를 내지 않는다 */
  const noBundle = mobileId === "none";
  const total =
    combo?.monthly_fee != null && !noBundle
      ? combo.monthly_fee + (mobile?.monthly_fee ?? 0)
      : null;

  const chip = (active: boolean) =>
    `cursor-pointer rounded-full border-2 px-4 py-2.5 text-sm font-bold transition-colors duration-200 ${
      active
        ? "border-brand bg-brand-dark text-white"
        : "border-line bg-white text-muted hover:border-brand hover:text-brand-dark"
    }`;

  return (
    <section className="bg-surface-muted py-16 md:py-20">
      <div className="mx-auto max-w-5xl px-4">
        <SectionHeading
          title="우리 집 요금 계산해 보기"
          description={`쓰실 구성만 고르시면 ${carrier.label} 월 요금이 바로 나와요`}
        />

        <div className="grid gap-5 md:grid-cols-[1fr_20rem]">
          {/* 선택 영역 */}
          <div className="flex flex-col gap-6 rounded-panel border-2 border-line bg-white p-6 md:p-7">
            <fieldset>
              <legend className="mb-3 font-bold">인터넷 속도</legend>
              <div className="flex flex-wrap gap-2">
                {m.speeds.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    aria-pressed={speed === s}
                    className={chip(speed === s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-3 font-bold">TV</legend>
              <div className="flex flex-wrap gap-2">
                {m.tvOptions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTv(t)}
                    aria-pressed={tv === t}
                    className={chip(tv === t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </fieldset>

            {m.mobiles.length > 0 && (
              <fieldset>
                <legend className="mb-3 font-bold">
                  결합할 휴대폰 요금제{" "}
                  <span className="text-sm font-medium text-muted">
                    (표시 요금은 1회선 결합 기준)
                  </span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {m.mobiles.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setMobileId(p.id)}
                      aria-pressed={mobileId === p.id}
                      className={chip(mobileId === p.id)}
                    >
                      {p.name}
                    </button>
                  ))}
                  {/* "미포함"이 아니라 "결합하지 않음" 이다 —
                      고르면 금액을 비운다. 결합 미적용가는 표에 없다 */}
                  <button
                    type="button"
                    onClick={() => setMobileId("none")}
                    aria-pressed={mobileId === "none"}
                    className={chip(mobileId === "none")}
                  >
                    결합하지 않음
                  </button>
                </div>
              </fieldset>
            )}
          </div>

          {/* 결과 영역 */}
          <div className="flex flex-col overflow-hidden rounded-panel border-2 border-brand bg-white">
            <div className="flex-1 p-6">
              {combo ? (
                <dl className="flex flex-col gap-3 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">인터넷 + TV</dt>
                    <dd className="tabular font-bold">
                      {formatWon(combo.monthly_fee)}
                    </dd>
                  </div>
                  {/* `list_fee` 가 없을 때 이 **행을 지우면** 안 된다 —
                      같은 값을 같은 자리에서 다루는 요금표(PlanTable)는 `-` 를
                      보여주고 비교 문서도 `-` 라고 적고 있다. 행이 사라지면
                      방문자는 "이 조합은 원래 할인이 없다"로 읽는데, 실제로는
                      **원가를 확인하지 못해 비워둔** 칸이다. 둘은 다른 사실이다.
                      할인 폭이 0인 경우(list=monthly)만 행을 접는다 — 그건
                      보여줄 게 실제로 없는 유일한 경우다. */}
                  {combo.list_fee !== combo.monthly_fee && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted">할인 전</dt>
                      <dd className="tabular text-muted line-through">
                        {combo.list_fee != null
                          ? formatWon(combo.list_fee)
                          : "-"}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">휴대폰</dt>
                    {/* "미포함" 이라고 쓰면 위 금액이 휴대폰 없이 나오는 값처럼
                        읽힌다. 실제로는 1회선 결합이 전제된 금액이다 */}
                    <dd className="tabular font-bold">
                      {mobile
                        ? formatWon(mobile.monthly_fee)
                        : noBundle
                          ? "결합 안 함"
                          : "미선택 (별도)"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm leading-relaxed text-muted">
                  선택하신 조합은 요금표에 없습니다. 상담을 신청해 주시면 가능한
                  구성과 금액을 확인해 안내해 드립니다.
                </p>
              )}
            </div>

            {/* 합계 띠 — 이 화면에서 가장 먼저 눈에 들어와야 하는 값.
                라벨이 금액의 범위를 정확히 말해야 한다. 휴대폰을 안 고른 상태의
                금액은 "월 예상 요금"이 아니라 인터넷+TV 몫일 뿐이다.

                면은 **옅은 틴트**다. 추천 카드의 요금 띠를 같은 이유로 내렸는데
                (진한 면 + 그 아래 진한 버튼 = 한 덩어리에 진한 면 둘) 이 패널만
                진초록으로 남아 있었다. 같은 페이지에서 "월 요금" 이 한 곳은 틴트,
                한 곳은 진초록이면 방문자는 둘이 다른 종류의 값이라고 배운다.
                금액이 먼저 읽히는 건 크기(3xl)와 굵기(black)가 만든다. */}
            <div className="bg-brand-light px-6 py-5 text-brand-deep">
              <p className="text-sm font-bold">
                {total == null
                  ? "월 예상 요금"
                  : mobile
                    ? "월 예상 합계 (인터넷+TV+휴대폰)"
                    : "인터넷 + TV 월 요금"}
              </p>
              <p className="tabular mt-1 text-3xl font-black">
                {total != null ? formatWon(total) : "상담 시 안내"}
              </p>
              {/* 어느 상태인지 금액 바로 아래에서 한 줄로 못 박는다 */}
              <p className="mt-2 text-xs leading-relaxed">
                {noBundle
                  ? "휴대폰 없이 쓰시는 금액은 표에 없어서, 상담 때 따로 알려드릴게요."
                  : mobile
                    ? "휴대폰 1회선 묶었을 때 한 달 합계예요."
                    : "휴대폰 1회선 묶는 걸 기준으로 한 인터넷·TV 요금이에요. 휴대폰 요금제를 고르시면 합계로 바뀌어요."}
              </p>
            </div>

            <a
              href="#consult"
              // 이 버튼도 `#consult` 로 가는 상담 버튼이다. 헤더·히어로의 주 CTA 와
              // 같은 동작인데 색만 달랐다 — 같은 일을 하는 것은 같게 보여야 배운다.
              className="cta-fill flex items-center justify-center gap-1.5 py-4 font-bold transition-colors duration-200"
            >
              이 구성으로 상담 신청
              <Icon name="arrowRight" size={17} />
            </a>
          </div>
        </div>

        {/* 계산 결과 바로 아래에 표시 전제를 붙인다. 금액만 떼어 보면 오해가 생긴다 */}
        <div className="mt-5 flex flex-col gap-1.5 text-xs leading-relaxed text-muted">
          <p>{PRICE_BASIS_LINE}</p>
          <p>{PLAN_DISCLAIMER}</p>
          <p>
            <a
              href="#plan-notice"
              className="font-bold text-brand-dark underline underline-offset-2"
            >
              약정·설치비·사은품 조건 전체 보기
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
