import { SITE } from "@/lib/site-config";
import Icon, { type IconName } from "@/components/ui/Icon";
import SectionHeading from "@/components/ui/SectionHeading";

/**
 * 신청 → 상담 → 설치 → 사은품 4단계.
 * 실제로 순서가 있는 내용이라 번호를 붙인다. 클릭할 수 없는 카드라 hover 반응이 없다.
 */
export default function Journey() {
  const { title, sub, steps } = SITE.journey;

  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading title={title} description={sub} />

        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="rounded-card border border-line-strong bg-surface p-6"
            >
              <div className="flex items-center justify-between">
                <Icon name={s.icon as IconName} size={24} />
                <span className="tabular text-sm font-black text-muted">
                  STEP {i + 1}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-black">
                <span className="sr-only">{i + 1}단계. </span>
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
