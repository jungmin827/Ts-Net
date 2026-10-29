import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { LEAD_COMPLETE } from "@/lib/site-config";

/**
 * 접수 완료 페이지 (2026-10-29).
 *
 * 메타 광고의 전환을 **URL 로** 잡기 위해 만든 주소다 — 접수에 성공하면
 * `useLeadSubmit` 이 어느 폼에서든 여기로 옮긴다. 폼 자리에서 문구만 바뀌던
 * 때는 주소가 그대로라 전환 규칙을 걸 곳이 없었다.
 *
 * 색인하지 않는다. 검색으로 들어와 "접수됐어요" 를 보는 건 거짓 안내다.
 * 사이트맵(`STATIC_ROUTES`)에도 넣지 않는다.
 *
 * 하단 고정 상담바는 이 주소에서 내려간다(`StickyConsultBar`).
 */
export const metadata: Metadata = {
  // 색인은 막지만 canonical 은 공개 페이지 공통 규칙대로 자기 주소를 적는다(verify-goals G0a)
  alternates: { canonical: "/complete" },
  title: LEAD_COMPLETE.title,
  robots: { index: false, follow: false },
};

export default function CompletePage() {
  return (
    <main className="bg-white">
      <section className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center md:py-28">
        <span className="mb-5 flex size-16 items-center justify-center rounded-full bg-foreground text-white">
          <Icon name="check" size={32} />
        </span>
        <h1 className="text-2xl font-black md:text-3xl">{LEAD_COMPLETE.title}</h1>
        <p className="mt-3 text-muted">{LEAD_COMPLETE.description}</p>
        <Link
          href="/"
          className="mt-10 inline-flex min-h-11 items-center gap-1.5 rounded-lg border-2 border-line bg-white px-5 text-sm font-bold transition-colors duration-200 hover:border-foreground"
        >
          <Icon name="arrowRight" size={15} className="rotate-180" />
          {LEAD_COMPLETE.homeLabel}
        </Link>
      </section>
    </main>
  );
}
