import { Fragment } from "react";
import { SITE } from "@/lib/site-config";
import Icon, { type IconName } from "@/components/ui/Icon";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";

/**
 * 가입절차 5스텝.
 * 모바일은 세로 타임라인, 데스크톱은 연결선이 이어진 가로 배열.
 * 연결선을 항목 사이에 실제 엘리먼트로 넣어 방향만 반응형으로 바꾼다.
 */
export default function Process() {
  const last = SITE.processSteps.length - 1;

  return (
    <section className="bg-brand-soft py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          eyebrow="PROCESS"
          title="가입 절차"
          description="신청부터 사은품 지급까지 5단계로 진행됩니다"
        />

        <Reveal>
          <ol className="flex flex-col md:flex-row md:items-start">
            {SITE.processSteps.map((s, i) => (
              <Fragment key={s.title}>
                <li className="group flex items-center gap-4 md:flex-1 md:flex-col md:gap-3 md:text-center">
                  <span className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white text-brand shadow-card transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1 group-hover:bg-brand group-hover:text-white group-hover:shadow-lift">
                    <Icon name={s.icon as IconName} size={24} />
                    <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-brand text-[10px] font-black text-white ring-2 ring-brand-soft transition-colors duration-300 group-hover:bg-accent">
                      {i + 1}
                    </span>
                  </span>
                  <span className="md:contents">
                    <p className="font-bold">{s.title}</p>
                    <p className="text-xs text-muted">{s.desc}</p>
                  </span>
                </li>

                {i < last && (
                  <li
                    aria-hidden="true"
                    className="my-1 ml-7 h-6 w-0.5 rounded-full bg-line-strong md:mx-0 md:mt-7 md:mb-0 md:ml-0 md:h-0.5 md:w-auto md:flex-1"
                  />
                )}
              </Fragment>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
