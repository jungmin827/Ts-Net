import { SITE } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";

/** 모바일 하단 고정바 — 전화걸기 / 상담신청 2분할. 홈 인디케이터 영역까지 패딩을 확보한다 */
export default function MobileBottomBar() {
  return (
    <nav
      aria-label="빠른 상담"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 shadow-float lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <a
        href={`tel:${SITE.tel}`}
        className="flex items-center justify-center gap-2 bg-brand-deep py-4 font-bold text-white transition-colors active:bg-brand-dark"
      >
        <Icon name="phone" size={18} />
        전화 상담
      </a>
      <a
        href="#consult"
        className="flex items-center justify-center gap-2 bg-accent py-4 font-bold text-white transition-colors active:bg-accent-dark"
      >
        <Icon name="chat" size={18} />
        상담 신청
      </a>
    </nav>
  );
}
