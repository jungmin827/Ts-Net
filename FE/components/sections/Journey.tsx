import { SITE } from "@/lib/site-config";
import Icon, { type IconName } from "@/components/ui/Icon";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";

/**
 * 신청 → 상담 → 설치 → 혜택 수령 4단계.
 *
 * 실제로 순서가 있는 내용이라 번호를 붙인다. 번호는 카드 오른쪽 위에 크게 깔되
 * 옅은 초록으로 눌러, 읽는 순서를 알려주면서도 제목보다 먼저 읽히지 않게 한다.
 * 클릭할 수 없는 카드라 hover 반응을 주지 않는다.
 */
export default function Journey() {
  const { title, sub, steps } = SITE.journey;

  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading title={title} description={sub} />

        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="h-full">
              {/* 카드 그리드는 CarrierHub 와 같은 패턴이므로 등장도 같게 맞춘다.
                  Reveal 은 서버 렌더 시 아무것도 감추지 않으므로 JS 가 죽어도 안전하다 */}
              <Reveal delay={i * 70} className="h-full">
              <div className="relative h-full overflow-hidden rounded-panel border-2 border-line bg-white p-6">
              {/* 단계 번호.
                  예전에는 64px 워터마크(대비 1.13:1)였다. 읽히지 않는 크기의 글자는
                  장식일 뿐인데 '읽는 순서'라는 정보를 지고 있었다 — 모순이다.
                  작게 줄이고 대비를 8.31:1 로 올려 정보로 만들었다. */}
              <span
                aria-hidden="true"
                className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-full bg-brand-light text-xs font-black text-brand-deep"
              >
                {i + 1}
              </span>

              <span className="relative mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-light text-brand-deep">
                <Icon name={s.icon as IconName} size={26} />
              </span>
              <h3 className="relative mb-2 text-[1.375rem] font-bold">
                <span className="sr-only">{i + 1}단계. </span>
                {s.title}
              </h3>
              <p className="relative text-sm leading-relaxed text-muted">
                {s.desc}
              </p>
              </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
