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
  images,
  content,
  footer,
}: {
  breadcrumb: { href: string; label: string };
  badge?: React.ReactNode;
  title: string;
  meta: React.ReactNode;
  /**
   * 본문에 순서대로 붙는 이미지.
   *
   * 여러 장을 받는 이유 — 레퍼런스(다모아)의 정보공유 글은 본문이 **전부
   * 업로드 이미지**다(텍스트 0자, PNG 6장). 그 게시판은 글 게시판이 아니라
   * 홍보 이미지 채널로 운영된다. 한 장만 받으면 그 쓰임을 못 받는다.
   *
   * `alt` 가 **필수**인 이유 — 한동안 이 컴포넌트가 모든 장에 `alt=""` 를
   * 박고 "내용은 본문이 글로 말한다" 고 주석에 적어 뒀다. 그 전제는 사람의
   * 약속이고 코드에 없었다. 그리고 `alt=""` 는 "이 이미지는 아무 정보도
   * 전달하지 않는다" 는 **적극적 선언**이다(WCAG 1.1.1 / H67) — 정보의
   * 본체가 이미지에 있는 게 정상 운용인 게시판에서 그건 거의 항상 거짓이다.
   * 타입으로 필수로 두면 "이 장은 장식" 이라는 판단을 **호출부가** 한다.
   */
  images?: ({ url: string | null | undefined; alt: string } | null | undefined)[] | null;
  content: string;
  /** 운영자 답글처럼 본문 뒤에 붙는 블록 */
  footer?: React.ReactNode;
}) {
  // null·빈 문자열을 걸러낸다. 빈 `src` 는 브라우저가 **현재 페이지를** 다시
  // 요청하게 만들어 서버 로그에 유령 요청이 쌓인다.
  //
  // **판정과 사용이 같은 값이어야 한다.** 이전 판은 `u.trim() !== ""` 로
  // 판정하고 다듬지 않은 `u` 를 `src` 에 넘겼다. 그래서 `" "`(공백만)은
  // 걸러지지만 `"…/a.png\n"` 는 통과했고, `next/image` 는 공백·제어문자로
  // 끝나는 src 를 거부해 **개발 모드에서 상세 페이지가 500** 이 됐다
  // (2FA QR 에서 이미 한 번 당한 것과 같은 모양이다).
  const pics = (images ?? [])
    .map((img) => ({ url: img?.url?.trim() ?? "", alt: img?.alt ?? "" }))
    .filter((img) => img.url !== "");
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

        {/*
          이미지와 본문을 `figure` 하나로 묶는다. 묶지 않으면 "본문이 이미지를
          설명한다" 는 관계가 마크업에 없어서 보조기술이 그걸 알 수 없다.
          본문은 `figcaption` 이 아니라 `aria-describedby` 로 잇는다 —
          `figcaption` 으로 옮기면 본문이 "그림 설명" 으로 격하되고,
          이미지가 없는 글에서는 자리가 달라진다.
        */}
        {pics.length > 0 ? (
          <figure aria-describedby="board-article-body">
            {pics.map((img, i) => (
              // 운영자가 Storage 에 올린 이미지. 외부 도메인이라 최적화를 끈다
              // (`next.config` 의 remotePatterns 에 의존하지 않게 한다).
              //
              // `height` 를 고정하지 않는다. 홍보 이미지는 세로로 긴 상세페이지
              // 컷이 흔한데 `object-cover` 로 432px 에 맞추면 **중간을 잘라낸다.**
              // 비율을 모르는 이미지는 폭만 맞추고 높이는 따라오게 둔다.
              <Image
                key={`${img.url}-${i}`}
                src={img.url}
                alt={img.alt}
                width={768}
                height={0}
                sizes="(min-width: 768px) 768px, 100vw"
                unoptimized
                className="mt-8 h-auto w-full rounded-panel border border-line"
              />
            ))}
          </figure>
        ) : null}

        <div
          id="board-article-body"
          className="mt-8 text-[0.9375rem] leading-[1.9] whitespace-pre-wrap"
        >
          {content}
        </div>

        {footer}
      </div>
    </article>
  );
}
