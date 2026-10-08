import Link from "next/link";
import Image from "next/image";

/**
 * 게시글 상세의 본문 영역 — 후기·정보공유가 같이 쓴다.
 *
 * ── 왜 컴포넌트로 빼는가 ──────────────────────────────────────
 * 처음에는 상세 마크업이 페이지 파일 안에 있었고, 측정용 프리뷰 하네스가
 * **같은 모양을 손으로 베껴** 재현했다. 베낀 쪽에서 통신사 뱃지 클래스를
 * `bg-kt-ink`(없는 클래스)로 잘못 적었고, 배경이 안 칠해져 흰 글자가 흰
 * 바탕에 얹혀 대비 1.00 으로 잡혔다. 제품은 멀쩡했지만 측정값은 거짓이었다 —
 * 반대로 제품이 깨졌는데 하네스만 맞는 경우도 똑같이 생길 수 있다.
 * 한 컴포넌트를 양쪽이 쓰면 그 어긋남이 구조적으로 불가능해진다.
 *
 * 본문은 **평문으로 다룬다.** `dangerouslySetInnerHTML` 을 쓰면 운영자 계정이
 * 털렸을 때 저장형 XSS 가 모든 방문자에게 실행된다. 줄바꿈만 살리면
 * 후기·공지 용도로는 충분하다.
 */
export default function BoardArticle({
  breadcrumb,
  badge,
  title,
  meta,
  imageUrl,
  content,
}: {
  breadcrumb: { href: string; label: string };
  badge?: React.ReactNode;
  title: string;
  meta: React.ReactNode;
  imageUrl?: string | null;
  content: string;
}) {
  return (
    <article className="bg-white pt-10 pb-12 md:pt-14 md:pb-16">
      <div className="mx-auto max-w-3xl px-4">
        <nav aria-label="현재 위치" className="mb-6 text-xs text-muted">
          <Link href={breadcrumb.href} className="font-bold hover:underline">
            {breadcrumb.label}
          </Link>
          <span aria-hidden="true" className="mx-1.5">
            /
          </span>
          상세
        </nav>

        <header className="border-b-2 border-line pb-6">
          {badge}
          <h1 className="text-2xl leading-snug font-black md:text-[1.875rem]">
            {title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {meta}
          </div>
        </header>

        {imageUrl && (
          // 운영자가 Storage 에 올린 이미지. 외부 도메인이라 최적화를 끈다
          // (`next.config` 의 remotePatterns 에 의존하지 않게 한다).
          // `alt=""` 는 의도적이다 — 본문 글이 이미 같은 내용을 말하는
          // 장식 이미지라서, 파일명이나 추측한 설명을 읽히는 쪽이 더 나쁘다.
          <Image
            src={imageUrl}
            alt=""
            width={768}
            height={432}
            unoptimized
            className="mt-8 w-full rounded-panel border border-line object-cover"
          />
        )}

        <div className="mt-8 text-[0.9375rem] leading-[1.9] whitespace-pre-wrap">
          {content}
        </div>
      </div>
    </article>
  );
}
