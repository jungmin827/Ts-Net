import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ConsultSection from "@/components/sections/ConsultSection";
import BoardNav from "@/components/sections/BoardNav";
import BoardArticle from "@/components/sections/BoardArticle";
import { excerpt, formatDate } from "@/lib/board";
import { getNeighbors, getNotice } from "@/lib/board-data";

export const revalidate = 300;

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

  const { prev, next } = await getNeighbors("notices", notice.created_at);

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
        images={notice.image_urls}
        content={notice.content}
      />

      <BoardNav base="/notice" listLabel="정보공유 목록" prev={prev} next={next} />
      <ConsultSection title="가입 상담 신청" />
    </main>
  );
}
