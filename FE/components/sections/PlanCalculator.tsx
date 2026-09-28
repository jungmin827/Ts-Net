"use client";

import { useMemo, useState } from "react";
import {
  buildCalcMatrix,
  findCombo,
  formatWon,
  type Plan,
} from "@/lib/plans";
import { PLAN_DISCLAIMER, type CarrierMenuItem } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";
import SectionHeading from "@/components/ui/SectionHeading";

/**
 * 요금 계산기 — 속도·TV·휴대폰을 고르면 합산 요금이 즉시 바뀐다.
 *
 * 값은 전부 `plans` 결합표에서 찾는다. 표에 없는 조합은 **계산하지 않고**
 * 상담 안내로 대체한다. 없는 값을 보간해 만들어내면 그 숫자는 근거가 없다.
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
  const [mobileId, setMobileId] = useState<number | null>(null);

  if (m.speeds.length === 0 || m.tvOptions.length === 0) return null;

  const combo = findCombo(m, speed, tv);
  const mobile = m.mobiles.find((p) => p.id === mobileId) ?? null;
  const total =
    combo?.monthly_fee != null
      ? combo.monthly_fee + (mobile?.monthly_fee ?? 0)
      : null;

  const chip = (active: boolean) =>
    `cursor-pointer rounded-full border-2 px-4 py-2.5 text-sm font-bold transition-colors duration-200 ${
      active
        ? "border-brand bg-brand text-white"
        : "border-line bg-white text-slate-600 hover:border-brand hover:text-brand"
    }`;

  return (
    <section className="bg-brand-soft py-16 md:py-20">
      <div className="mx-auto max-w-5xl px-4">
        <SectionHeading
          title="내 요금 계산해보기"
          description={`원하는 구성을 고르면 ${carrier.label} 월 요금이 바로 계산됩니다`}
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
                  휴대폰 결합{" "}
                  <span className="text-sm font-medium text-muted">(선택)</span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileId(null)}
                    aria-pressed={mobileId === null}
                    className={chip(mobileId === null)}
                  >
                    미포함
                  </button>
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
                  {combo.list_fee != null &&
                    combo.list_fee !== combo.monthly_fee && (
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted">할인 전</dt>
                        <dd className="tabular text-muted line-through">
                          {formatWon(combo.list_fee)}
                        </dd>
                      </div>
                    )}
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">휴대폰</dt>
                    <dd className="tabular font-bold">
                      {mobile ? formatWon(mobile.monthly_fee) : "미포함"}
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

            {/* 합계 띠 — 이 화면에서 가장 먼저 눈에 들어와야 하는 값 */}
            <div className="bg-brand px-6 py-5 text-white">
              <p className="text-sm font-medium text-white/85">월 예상 요금</p>
              <p className="tabular mt-1 text-3xl font-black">
                {total != null ? formatWon(total) : "상담 시 안내"}
              </p>
            </div>

            <a
              href="#consult"
              className="flex items-center justify-center gap-1.5 bg-accent py-4 font-bold text-accent-ink transition-colors duration-200 hover:bg-accent-dark"
            >
              이 구성으로 상담 신청
              <Icon name="arrowRight" size={17} />
            </a>
          </div>
        </div>

        <p className="mt-5 text-xs leading-relaxed text-slate-400">
          {PLAN_DISCLAIMER}
        </p>
      </div>
    </section>
  );
}
