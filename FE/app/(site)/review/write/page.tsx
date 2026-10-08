import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/sections/PageHero";
import ReviewForm from "@/components/forms/ReviewForm";
import Icon from "@/components/ui/Icon";

/**
 * 후기 작성 페이지.
 *
 * 모달이 아니라 **별도 경로**인 이유 —
 *   · 주소가 있으면 공유·새로고침·뒤로가기가 전부 그냥 동작한다.
 *   · 모달은 목록 페이지를 클라이언트 컴포넌트로 끌어올려야 한다. 목록은
 *     서버에서 DB 를 읽는 쪽이 맞고, 그 경계를 작성 폼 하나 때문에 옮길
 *     이유가 없다.
 *   · 레퍼런스(인터넷다모아)도 `후기쓰기` 가 별도 페이지(`review_form.php`)다.
 *
 * `/review/[id]` 와 같은 깊이지만 충돌하지 않는다 — Next 는 정적 구간을
 * 동적 구간보다 먼저 맞춘다. (`/review/write` 가 `[id]` 로 가지 않는다.)
 */
export const metadata: Metadata = {
  alternates: { canonical: "/review/write" },
  title: "후기 쓰기",
  description: "TS-Net 을 통해 가입하신 경험을 남겨 주세요. 운영자 확인 후 게시됩니다.",
  // 작성 폼은 색인할 내용이 없다. 검색으로 들어와도 할 수 있는 게 없고,
  // 목록·상세가 색인되는 것으로 충분하다.
  robots: { index: false, follow: true },
};

export default function ReviewWritePage() {
  return (
    <main>
      <PageHero
        title="후기 쓰기"
        description="가입·설치 과정에서 겪은 그대로 적어 주세요. 운영자 확인 후 게시됩니다."
      />

      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-2xl px-4">
          <nav aria-label="현재 위치" className="mb-6 text-xs text-muted">
            <Link href="/review" className="font-bold hover:underline">
              가입 후기
            </Link>
            <span aria-hidden="true" className="mx-1.5">
              /
            </span>
            쓰기
          </nav>

          {/* 폼 카드의 폭 계산은 `ConsultSection` 과 같다 — 거터 16px 은
              다른 섹션과 맞추고, 카드 패딩만 좁은 화면에서 12px 로 내린다
              (Turnstile `flexible` 최소 300px). */}
          <div className="rounded-panel border border-line bg-white p-3 shadow-float sm:p-6 md:p-8">
            <ReviewForm />
          </div>

          <p className="mt-8 text-center">
            <Link
              href="/review"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border-2 border-line bg-white px-5 text-sm font-bold transition-colors duration-200 hover:border-brand hover:text-brand-dark"
            >
              <Icon name="arrowRight" size={15} className="rotate-180" />
              후기 목록
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
