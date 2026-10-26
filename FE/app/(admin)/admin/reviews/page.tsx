import { requireAdmin } from "@/lib/admin/auth";
import ReviewModRow from "./ReviewModRow";

/**
 * 후기 승인 화면.
 *
 * **승인 대기(비공개)가 먼저** 온다. 운영자가 이 화면에 오는 이유의 대부분은
 * "새로 들어온 글을 보려고" 이고, 게시된 글은 공개 페이지에서도 볼 수 있다.
 *
 * 전화번호 같은 민감정보가 없는 테이블이라 복호화·감사로그 분기가 없다.
 * 다만 변경은 전부 `/api/admin/reviews/[id]` 를 거치고 거기서
 * `access_logs` 에 기록한다 — 공개 노출 여부를 바꾸는 조작이기 때문이다.
 */
export const dynamic = "force-dynamic";

export interface ReviewModRowData {
  id: number;
  title: string;
  content: string;
  rating: number | null;
  carrier: string | null;
  /** 가린 형태(`박*민`)로만 저장된다 */
  author: string | null;
  is_published: boolean;
  created_at: string;
  admin_reply?: string | null;
  admin_reply_at?: string | null;
  /** 첨부 사진(010). 승인 전에도 운영자는 볼 수 있다 — 주소를 아는 쪽이 운영자뿐이다 */
  image_paths: string[] | null;
  image_alts: string[] | null;
}

export default async function AdminReviewsPage() {
  const { supabase } = await requireAdmin("/admin/reviews");

  /*
   * 007 미적용 환경에서도 화면이 뜨게 한다 — 공개 게시판과 같은 판단이다
   * (`lib/board-data.ts` 의 `selectWithOptional` 주석). 여기서는 답글 열이
   * 없으면 답글 버튼 자체를 숨긴다. 버튼을 띄워 두면 누르는 순간 503 이 난다.
   */
  const BASE =
    "id, title, content, rating, carrier, author, is_published, created_at, image_paths, image_alts";
  let replyAvailable = true;
  let rows: ReviewModRowData[] = [];
  let loadError: string | null = null;

  const first = await supabase
    .from("reviews")
    .select(`${BASE}, admin_reply, admin_reply_at`)
    .order("is_published", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);

  if (first.error?.code === "42703") {
    replyAvailable = false;
    const retry = await supabase
      .from("reviews")
      .select(BASE)
      .order("is_published", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);
    if (retry.error) {
      console.error(
        "[admin/reviews] 조회 실패:",
        retry.error.code,
        retry.error.message,
      );
      loadError = retry.error.message;
    } else {
      rows = (retry.data as ReviewModRowData[]) ?? [];
    }
  } else if (first.error) {
    console.error(
      "[admin/reviews] 조회 실패:",
      first.error.code,
      first.error.message,
    );
    loadError = first.error.message;
  } else {
    rows = (first.data as ReviewModRowData[]) ?? [];
  }

  const pending = rows.filter((r) => !r.is_published).length;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-black">후기 승인</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          방문자가 제출한 후기는 <strong>비공개로 들어옵니다.</strong> 내용을
          확인한 뒤 게시 승인하세요. 승인 전에는 공개 페이지에 노출되지
          않습니다.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          사진이 있는 글은 <strong>장마다 설명을 적어야</strong> 게시할 수 있습니다
          (화면을 못 보는 분께 읽어 주는 글입니다). 이름·주소·번호가 보이는 사진은{" "}
          <strong>사진 빼기</strong>로 내리고 게시하세요.
        </p>
        {!replyAvailable && (
          <p className="mt-3 rounded-lg border border-line bg-surface-muted px-3.5 py-3 text-sm leading-relaxed text-muted">
            운영자 답글 기능은 마이그레이션{" "}
            <code className="font-bold">007_board_reply_and_images.sql</code>{" "}
            적용 후 사용할 수 있습니다 (`BE/APPLY.md`).
          </p>
        )}
      </header>

      {loadError ? (
        <p className="rounded-panel border-2 border-dashed border-line bg-surface-muted px-6 py-10 text-center text-sm text-muted">
          후기를 불러오지 못했습니다. 서버 로그를 확인해 주세요.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-panel border-2 border-dashed border-line bg-surface-muted px-6 py-10 text-center text-sm text-muted">
          등록된 후기가 없습니다.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">
            전체{" "}
            <span className="font-bold text-foreground">{rows.length}</span>건
            {pending > 0 && (
              <>
                {" "}
                · 승인 대기{" "}
                <span className="font-bold text-foreground">{pending}</span>건
              </>
            )}
          </p>

          <ul className="flex flex-col gap-4">
            {rows.map((r) => (
              <ReviewModRow
                key={r.id}
                row={r}
                replyAvailable={replyAvailable}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
