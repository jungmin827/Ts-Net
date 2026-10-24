import Link from "next/link";
import { CARRIER_MENU } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";
import SectionHeading from "@/components/ui/SectionHeading";

/** 메인의 통신사 4칸 — 상세페이지 진입점. 통신사색 없이 글자로만 구분한다 */
export default function CarrierHub() {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          title="어느 통신사 보고 계세요?"
          description="누르시면 요금표랑 조건을 바로 보실 수 있어요"
        />

        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {CARRIER_MENU.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/${c.slug}`}
                className="group flex h-full flex-col rounded-card border border-line-strong bg-surface p-5 transition-colors hover:border-foreground md:p-6"
              >
                <span className="text-lg font-black md:text-xl">{c.label}</span>
                <span className="mt-1.5 text-sm leading-relaxed text-muted">
                  {c.tagline}
                </span>
                <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-bold">
                  요금 보기
                  <Icon
                    name="arrowRight"
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
