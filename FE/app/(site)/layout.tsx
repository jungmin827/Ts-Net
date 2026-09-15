import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import QuickForm from "@/components/forms/QuickForm";
import MobileBottomBar from "@/components/forms/MobileBottomBar";

/** 공개 사이트 공통 셸 — 어드민 (admin) 그룹에는 적용되지 않는다 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      {children}
      <Footer />
      <QuickForm />
      <MobileBottomBar />
    </>
  );
}
