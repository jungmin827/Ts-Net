import Link from "next/link";
import { CARRIER_MENU } from "@/lib/site-config";

/** 메인의 통신사 4카드 허브 — 서브페이지 진입점. 카드마다 통신사 아이덴티티 컬러 */
export default function CarrierHub() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="mb-2 text-center text-2xl font-black md:text-3xl">
          통신사별 상품 보기
        </h2>
        <p className="mb-8 text-center text-sm text-gray-500">
          요금제와 약정 조건을 비교하고 원하는 통신사로 상담을 신청하세요
        </p>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {CARRIER_MENU.map((c) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              className="flex flex-col gap-2 rounded-2xl border-2 border-gray-100 border-t-4 p-6 transition-shadow hover:shadow-md"
              style={{ borderTopColor: `var(${c.colorVar})` }}
            >
              <span
                className="text-lg font-black"
                style={{ color: `var(${c.colorVar})` }}
              >
                {c.label}
              </span>
              <span className="text-sm leading-relaxed text-gray-500">
                {c.tagline}
              </span>
              <span className="mt-2 text-sm font-medium text-brand">
                상품 보기 →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
