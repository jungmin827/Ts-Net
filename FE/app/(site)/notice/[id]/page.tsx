import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ConsultSection from "@/components/sections/ConsultSection";
import BoardNav from "@/components/sections/BoardNav";
import BoardArticle from "@/components/sections/BoardArticle";
import { excerpt, formatDate } from "@/lib/board";
import { getNeighbors, getPublishedIds, getNotice } from "@/lib/board-data";

export const revalidate = 300;

/**
 * 프리렌더 대상 — **이게 없으면 `revalidate` 가 아무것도 지키지 않는다.**
 *
 * 빌드 라우트 표로 확인한 사실: `generateStaticParams` 가 없던 동안
 * 이 라우트는 `ƒ (Dynamic)` 이고 재생성 주기 칸이 비어 있었다
 * (`/` 와 `/[carrier]` 는 `5m` 으로 찍힌다). "게시판은 5분 재생성" 은
 * 문서에만 있던 말이다.
 *
 * 목록에 없는 id 도 요청 시 렌더된다(`dynamicParams` 기본 `true`) —
 * 500건 상한은 빌드 시간을 묶는 장치이고 접근을 막지 않는다.
 */
export async function generateStaticParams() {
  const ids = await getPublishedIds("notices");
  return ids.map((id) => ({ id: String(id) }));
}

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const n = parseId(id);
  const notice = n ? await getNotice(n) : null;
  if (!notice) return { title: "게시글을 찾을 수 없습니다" };
  return {
    // canonical 은 페이지마다 적는다 — 루트 레이아웃에 두면 전 페이지가
    // 같은 주소를 정본으로 선언해 자기를 중복으로 떨어뜨린다.
    alternates: { canonical: `/notice/${n}` },
    title: notice.title,
    description: excerpt(notice.content, 80),
  };
}

export default async function NoticeDetailPage({ params }: Params) {
  const { id } = await params;
  const n = parseId(id);
  if (!n) notFound();

  const notice = await getNotice(n);
  if (!notice) notFound();

  const { prev, next } = await getNeighbors("notices", notice.id);

  return (
    <main>
      <BoardArticle
        breadcrumb={{ href: "/notice", label: "정보공유" }}
        badge={
          notice.is_pinned ? (
            <span className="mb-3 inline-block rounded-md bg-brand-light px-2 py-0.5 text-[11px] font-black text-brand-deep">
              공지
            </span>
          ) : null
        }
        title={notice.title}
        meta={
          /* 조회수는 공개 화면에 띄우지 않는다 — 이유는 후기 상세 주석 참고 */
          <time dateTime={notice.created_at} className="text-sm text-muted">
            {formatDate(notice.created_at, { withTime: true })}
          </time>
        }
        /*
          장과 설명을 짝지어 넘긴다. 009 가 **길이를 같게** 묶으므로 짝이
          어긋난 행은 DB 가 받지 않는다 — 여기서 길이를 맞추는 코드가
          필요 없는 이유다. 009 미적용 환경에서는 `image_alts` 가 없어
          전부 장식으로 떨어진다(그 사실은 서버 로그에 한 줄로 남는다).
        */
        images={(notice.image_urls ?? []).map((url, i) => ({
          url,
          alt: notice.image_alts?.[i] ?? "",
        }))}
        content={notice.content}
      />

      <BoardNav base="/notice" listLabel="정보공유 목록" prev={prev} next={next} />
      <ConsultSection title="가입 상담 신청" />
    </main>
  );
}
