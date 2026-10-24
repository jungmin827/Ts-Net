import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import StickyConsultBar from "@/components/forms/StickyConsultBar";
import BackToTop from "@/components/ui/BackToTop";
import ConsultAnchorFallback from "@/components/ui/ConsultAnchorFallback";
import Icon from "@/components/ui/Icon";

/** 공개 사이트 공통 셸 — 어드민 (admin) 그룹에는 적용되지 않는다 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      {/* 하단 고정 상담바가 콘텐츠 마지막 줄을 가리지 않도록 그만큼 자리를 비워둔다 */}
      <div className="pb-[4.5rem] lg:pb-[5.5rem]">
        {children}
        <Footer />
      </div>
      <BackToTop />
      <ConsultAnchorFallback />
      <StickyConsultBar />

      {/*
        스크립트가 뜨지 않았을 때의 하단 고정바.

        `StickyConsultBar` 는 `visible` 이 스크롤 이벤트로만 true 가 되므로,
        JS 가 막히면 **영원히 화면 밖에 머문다.** 그런데 위쪽 래퍼는
        `pb-[4.5rem]` 로 그 자리를 계속 비워 둔다 — 화면 아래에 빈 띠만 남고
        이 업종의 핵심 전환 장치가 통째로 사라지는 상태다.

        여기서 폼을 흉내 내지는 않는다. 접수는 Turnstile 검증을 거쳐야 하고
        그건 JS 없이 성립하지 않는다. 대신 **폼이 있는 자리로 보내는 앵커**만 둔다.
        (전화 버튼은 10-25 운영자 결정으로 사이트 어디에도 두지 않는다)
      */}
      <noscript>
        <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-white shadow-float">
          <div
            className="mx-auto grid max-w-6xl grid-cols-1"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <a
              href="#consult"
              className="cta-fill flex items-center justify-center gap-2 py-4 font-bold"
            >
              <Icon name="chat" size={18} />
              상담 신청하기
            </a>
          </div>
        </div>
      </noscript>
    </>
  );
}
