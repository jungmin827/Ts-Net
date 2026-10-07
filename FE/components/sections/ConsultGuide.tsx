import { CONSULT_GUIDE } from "@/lib/site-config";
import Icon, { type IconName } from "@/components/ui/Icon";
import SectionHeading from "@/components/ui/SectionHeading";

/**
 * 상담 진행 안내.
 *
 * `Journey` 가 "어떤 단계를 거치는가"를 말하면, 여기는 "그 통화에서 무엇을
 * 확인하는가"를 말한다. 전화를 받기 전에 무슨 얘기를 할지 알면 번호를 남기는
 * 부담이 줄어든다.
 *
 * 영업시간·연락 소요·설치 기간은 **운영자만 아는 값**이다. 지어내면 약속이 되므로
 * `CONSULT_GUIDE.facts` 의 value 가 null 인 칸은 렌더링하지 않는다. 세 칸이 모두
 * 비어 있어도 체크리스트는 사실이라 섹션은 성립한다.
 */
export default function ConsultGuide() {
  const facts = CONSULT_GUIDE.facts.filter((f) => f.value);

  // 채워진 운영 정보도 없고 확인 항목도 없으면 섹션 자체가 없는 게 맞다
  if (facts.length === 0 && CONSULT_GUIDE.checklist.length === 0) return null;

  return (
    <section className="bg-surface-muted py-16 md:py-20">
      <div className="mx-auto max-w-4xl px-4">
        <SectionHeading
          eyebrow="상담 안내"
          title={CONSULT_GUIDE.title}
          description={CONSULT_GUIDE.sub}
        />

        {facts.length > 0 && (
          <dl className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {facts.map((f) => (
              <div
                key={f.label}
                className="rounded-card border border-line bg-white p-5"
              >
                <dt className="flex items-center gap-2 text-xs font-bold text-muted">
                  <Icon
                    name={f.icon as IconName}
                    size={17}
                    className="text-brand-dark"
                  />
                  {f.label}
                </dt>
                <dd className="mt-2 text-base leading-snug font-black text-foreground">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {CONSULT_GUIDE.checklist.length > 0 && (
          <div className="rounded-panel border border-line bg-white p-5 md:p-8">
            <h3 className="text-base font-black text-foreground md:text-lg">
              {CONSULT_GUIDE.checklistTitle}
            </h3>

            {/* 두 칸으로 나누되 좁은 화면에서는 한 줄씩. 항목이 길어 줄바꿈이
                생기므로 체크 아이콘은 첫 줄에 고정한다 (items-start) */}
            <ul className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              {CONSULT_GUIDE.checklist.map((c) => (
                <li key={c} className="flex items-start gap-2.5">
                  <Icon
                    name="check"
                    size={18}
                    className="mt-1 shrink-0 text-brand-dark"
                  />
                  <span className="text-sm leading-relaxed text-foreground">
                    {c}
                  </span>
                </li>
              ))}
            </ul>

            {CONSULT_GUIDE.notes.length > 0 && (
              <ul className="mt-6 flex flex-col gap-2 border-t border-line pt-5">
                {CONSULT_GUIDE.notes.map((n) => (
                  <li
                    key={n}
                    className="text-[11px] leading-relaxed text-muted md:text-xs"
                  >
                    {n}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
