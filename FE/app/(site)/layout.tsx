import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import StickyConsultBar from "@/components/forms/StickyConsultBar";

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
      <StickyConsultBar />
    </>
  );
}
