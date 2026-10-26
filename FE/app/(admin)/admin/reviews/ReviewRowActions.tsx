"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { patchReview } from "./patch-review";

/**
 * 후기 한 건의 승인 토글과 운영자 답글 편집.
 *
 * 어드민은 기본 서버 컴포넌트이고 `use client` 는 상호작용에만 쓴다
 * (CLAUDE.md). 그래서 행 전체가 아니라 **조작부만** 클라이언트다.
 */
export default function ReviewRowActions({
  id,
  published,
  reply,
  replyAvailable,
  needsAlts = false,
}: {
  id: number;
  published: boolean;
  reply: string | null;
  /** 007 미적용이면 답글 열이 없다 — 입력창을 띄워 두면 저장이 503 으로 실패한다 */
  replyAvailable: boolean;
  /** 사진은 있는데 설명이 아직 저장되지 않았다 — 게시를 누르면 무엇이 빠졌는지 말한다 */
  needsAlts?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(reply ?? "");
  const [editing, setEditing] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const res = await patchReview(id, body);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    // 목록은 서버 컴포넌트다 — 다시 읽어야 바뀐 상태가 보인다
    router.refresh();
    return true;
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {/*
          게시/비공개는 **되돌릴 수 있는 변경**이라 확인 창을 띄우지 않는다.
          반대로 삭제는 이 화면에 두지 않았다 — 되돌릴 수 없고, 잘못 누르면
          방문자가 쓴 글이 사라진다. 필요하면 Supabase 대시보드에서 한다.
        */}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            // 버튼을 죽이지 않고, 누르면 빠진 것을 말한다 (CLAUDE.md 주 CTA 규칙과 같은 판단)
            if (!published && needsAlts) {
              setError("사진 설명을 먼저 적고 ‘설명 저장’을 눌러 주세요");
              return;
            }
            void patch({ is_published: !published });
          }}
          className={`min-h-11 rounded-lg border-2 px-4 text-sm font-bold transition-colors duration-200 ${
            published
              ? "border-line bg-white text-muted hover:border-brand hover:text-brand-dark"
              : "border-brand-dark bg-brand-dark text-white hover:bg-brand-deep"
          }`}
        >
          {busy ? "처리 중…" : published ? "비공개로" : "게시 승인"}
        </button>

        {replyAvailable && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-11 rounded-lg border-2 border-line bg-white px-4 text-sm font-bold text-muted transition-colors duration-200 hover:border-brand hover:text-brand-dark"
          >
            {reply ? "답글 수정" : "답글 작성"}
          </button>
        )}
      </div>

      {editing && (
        <div className="flex flex-col gap-2">
          <label htmlFor={`reply-${id}`} className="text-xs font-bold text-muted">
            운영자 답변 (비우고 저장하면 삭제됩니다)
          </label>
          <textarea
            id={`reply-${id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            rows={4}
            className="w-full rounded-lg border-2 border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (await patch({ admin_reply: draft })) setEditing(false);
              }}
              className="min-h-11 rounded-lg border-2 border-brand-dark bg-brand-dark px-4 text-sm font-bold text-white"
            >
              {busy ? "저장 중…" : "저장"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDraft(reply ?? "");
                setEditing(false);
                setError("");
              }}
              className="min-h-11 rounded-lg border-2 border-line bg-white px-4 text-sm font-bold text-muted"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
