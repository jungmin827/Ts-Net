import { SITE } from "@/lib/site-config";
import Icon, { type IconName } from "@/components/ui/Icon";
import SectionHeading from "@/components/ui/SectionHeading";

/**
 * 차별점 4카드.
 * 그림자 대신 2px 경계선으로 구획한다 — 정보 밀도가 필요한 화면에서
 * 선이 그림자보다 빨리 읽히고, 둥근 모서리와 만나면 딱딱해지지도 않는다.
 * 클릭할 수 없는 카드라 hover 반응을 주지 않는다 (누를 수 있는 것처럼 보이면 안 된다).
 */
export default function Benefits() {
  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          title={
            <>
              <span className="text-brand">{SITE.name}</span>에서 신청해야 하는
              이유
            </>
          }
          description="상담부터 설치, 사은품 지급까지 과정을 투명하게 안내합니다"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SITE.benefits.map((b) => (
            <div
              key={b.title}
              className="h-full rounded-panel border-2 border-line bg-white p-6"
            >
              <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-light text-brand">
                <Icon name={b.icon as IconName} size={26} />
              </span>
              <h3 className="mb-2 text-lg font-bold">{b.title}</h3>
              <p className="text-sm leading-relaxed text-muted">
                {b.lines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
