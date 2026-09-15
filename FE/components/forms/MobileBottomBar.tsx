import { SITE } from "@/lib/site-config";

/** 모바일 하단 고정바 — 전화걸기 / 상담신청(인라인 폼으로 앵커 이동) 2분할 */
export default function MobileBottomBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 lg:hidden">
      <a
        href={`tel:${SITE.tel}`}
        className="bg-brand-dark py-4 text-center font-bold text-white"
      >
        전화 상담
      </a>
      <a
        href="#consult"
        className="bg-accent py-4 text-center font-bold text-white"
      >
        상담 신청
      </a>
    </nav>
  );
}
