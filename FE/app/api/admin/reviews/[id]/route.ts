import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/auth";
import { requestIp } from "@/lib/admin/audit";
import { isSameOrigin } from "@/lib/admin/same-origin";
import { logAccess } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { REVIEW_IMAGE_BUCKET, isReviewImagePath, thumbPath } from "@/lib/review-images";

/**
 * 후기 게시 승인 / 운영자 답글.
 *
 * ── 왜 이 라우트가 필요한가 ────────────────────────────────────
 * `008` 이 방문자 제출 경로를 열었는데, 제출된 행은 `is_published = false` 로
 * 들어오고 anon 에게는 UPDATE 권한이 없다. 승인 화면이 없으면 **제출된 후기는
 * 영원히 비공개**고, 운영자는 Supabase 대시보드에서 직접 SQL 을 쳐야 한다.
 * 제출 경로만 만들고 승인 경로를 안 만드는 건 기능을 반만 만든 것이다.
 *
 * ── 왜 service_role 이 아니라 세션 클라이언트인가 ──────────────
 * `reviews_admin_write` 정책이 `is_admin()` 으로 authenticated 세션에 쓰기를
 * 준다. 즉 세션 클라이언트로 충분하고, 공개 콘텐츠 승인에 RLS 를 통째로
 * 우회하는 키를 쥘 이유가 없다. (`leads` 쪽은 트리거가 `lead_logs` 에
 * 쓰느라 폴백이 필요했는데, `reviews` 에는 그 트리거가 없다.)
 *
 * ── 사진 (010) ──────────────────────────────────────────────────
 *   · `image_alts` — 장마다 대체 텍스트(선택, 011). 없어도 승인만으로 게시된다 —
 *     화면이 자동 문구를 쓴다(`reviewImageAlt`)
 *   · `remove_image` — 한 장 빼기. 계약서·고지서처럼 개인정보가 찍힌 사진을
 *     글은 살리고 사진만 내리는 길이다. 파일 삭제만 service_role 로 한다 —
 *     storage 에는 authenticated 정책도 주지 않았다(010: 업로드·삭제는 서버만).
 */

const idSchema = z.coerce.number().int().positive();

const patchSchema = z
  .object({
    is_published: z.boolean().optional(),
    /**
     * 답글. 빈 문자열은 **삭제**로 받는다 — `null` 을 JSON 으로 보내는 것보다
     * 폼에서 지우는 동작과 직관적으로 맞다. 변환은 아래에서 한 번만 한다.
     */
    admin_reply: z.string().max(2000).optional(),
    /**
     * 사진 설명(선택). 빈 칸은 "그 장은 자동 문구" 라는 뜻이다(011).
     * 전부 비우면 `null` 로 저장한다 — 빈 문자열 배열과 null 이 같은 뜻이 되지 않게.
     */
    image_alts: z.array(z.string().trim().max(200)).max(3).optional(),
    remove_image: z.string().refine(isReviewImagePath, "잘못된 요청입니다").optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "변경할 항목이 없습니다",
  });

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { ok: false, error: "잘못된 요청입니다" },
      { status: 403 },
    );
  }

  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  if (guard.admin.role !== "OWNER") {
    return NextResponse.json(
      { ok: false, error: "변경 권한이 없는 계정입니다" },
      { status: 403 },
    );
  }

  const { id: rawId } = await ctx.params;
  const parsedId = idSchema.safeParse(rawId);
  if (!parsedId.success) {
    return NextResponse.json(
      { ok: false, error: "잘못된 요청입니다" },
      { status: 400 },
    );
  }
  const id = parsedId.data;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "잘못된 요청입니다" },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요",
      },
      { status: 400 },
    );
  }

  const { data: before, error: beforeError } = await guard.supabase
    .from("reviews")
    .select("id, is_published, image_paths, image_alts")
    .eq("id", id)
    .maybeSingle<{
      id: number;
      is_published: boolean;
      image_paths: string[] | null;
      image_alts: string[] | null;
    }>();
  if (beforeError) {
    console.error(
      "[/api/admin/reviews] 조회 실패:",
      beforeError.code,
      beforeError.message,
    );
    return NextResponse.json(
      { ok: false, error: "조회에 실패했습니다" },
      { status: 500 },
    );
  }
  if (!before) {
    return NextResponse.json(
      { ok: false, error: "존재하지 않는 글입니다" },
      { status: 404 },
    );
  }

  /*
   * 답글 본문과 시각은 **같이 있거나 같이 없어야** 한다.
   * 007 의 `reviews_admin_reply_paired` 제약이 DB 에서도 막지만, 여기서
   * 맞춰 두지 않으면 그 제약 때문에 UPDATE 가 실패해 사용자는 이유 없는
   * "변경 실패" 만 본다. 제약은 최후 방어선이고, 맞추는 건 이쪽 일이다.
   */
  const patch: Record<string, unknown> = {};
  if (parsed.data.is_published !== undefined)
    patch.is_published = parsed.data.is_published;

  /*
   * 사진. 010 의 제약(짝 길이·게시 전 설명 필수)이 DB 에서도 막지만, 그대로
   * 부딪히면 운영자는 "변경 실패" 만 본다 — 무엇이 빠졌는지 여기서 말한다.
   */
  let paths = before.image_paths;
  let alts = before.image_alts;
  let removed: string | null = null;
  if (parsed.data.remove_image !== undefined) {
    const at = (paths ?? []).indexOf(parsed.data.remove_image);
    if (at === -1) {
      return NextResponse.json(
        { ok: false, error: "이미 빠진 사진입니다. 새로고침해 주세요" },
        { status: 409 },
      );
    }
    removed = parsed.data.remove_image;
    const keep = (_: string, i: number) => i !== at;
    paths = paths!.filter(keep);
    alts = alts ? alts.filter(keep) : null;
    // 빈 배열은 받지 않는다(010) — 마지막 장을 빼면 "사진 없음" 이다
    if (paths.length === 0) {
      paths = null;
      alts = null;
    }
    patch.image_paths = paths;
    patch.image_alts = alts;
  }
  if (parsed.data.image_alts !== undefined) {
    if (!paths || parsed.data.image_alts.length !== paths.length) {
      return NextResponse.json(
        { ok: false, error: "사진 장수와 설명 수가 다릅니다. 새로고침해 주세요" },
        { status: 409 },
      );
    }
    alts = parsed.data.image_alts.some((a) => a !== "") ? parsed.data.image_alts : null;
    patch.image_alts = alts;
  }
  if (parsed.data.admin_reply !== undefined) {
    const body = parsed.data.admin_reply.trim();
    patch.admin_reply = body === "" ? null : body;
    patch.admin_reply_at = body === "" ? null : new Date().toISOString();
  }

  const { error: updateError } = await guard.supabase
    .from("reviews")
    .update(patch)
    .eq("id", id);

  if (updateError) {
    // 42703 = 열 없음(007 미적용). 원인을 이름으로 찍는다.
    if (updateError.code === "42703") {
      console.error(
        "[/api/admin/reviews] 007_board_reply_and_images.sql 가 적용되지 않았습니다:",
        updateError.message,
      );
      return NextResponse.json(
        {
          ok: false,
          error: "운영자 답글 기능은 마이그레이션 007 적용 후 사용할 수 있습니다",
        },
        { status: 503 },
      );
    }
    console.error(
      "[/api/admin/reviews] update 실패:",
      updateError.code,
      updateError.message,
    );
    return NextResponse.json(
      { ok: false, error: "변경에 실패했습니다" },
      { status: 500 },
    );
  }

  /*
   * 감사로그. **기록 실패로 요청을 되돌리지 않는다** — 변경은 이미 커밋됐고,
   * 여기서 500 을 내면 "실패했다" 는 응답과 "바뀐 데이터" 가 어긋난다.
   * 다만 조용히 넘어가지도 않는다. (`logAccess` 는 service_role 을 쓰므로
   * 키가 없으면 던진다.)
   */
  try {
    await logAccess({
      actorId: guard.admin.userId,
      actorEmail: guard.admin.email,
      action: "UPDATE",
      target: `reviews:${id}`,
      rowCount: 1,
      detail: {
        fields: Object.keys(patch),
        is_published:
          parsed.data.is_published !== undefined
            ? { before: before.is_published, after: parsed.data.is_published }
            : undefined,
        reply_changed: parsed.data.admin_reply !== undefined,
        image_removed: removed ?? undefined,
        alts_changed: parsed.data.image_alts !== undefined || undefined,
      },
      ip: requestIp(req.headers),
    });
  } catch (e) {
    console.error(
      "[/api/admin/reviews] access_logs 기록 실패 (변경은 적용됨):",
      e instanceof Error ? e.message : String(e),
    );
  }

  // 행에서 뺀 뒤에 파일을 지운다. 순서가 반대면 지운 파일을 가리키는 행이
  // 남아 깨진 그림이 게시될 수 있다. 이 순서면 실패해도 남는 건 아무도 주소를
  // 모르는 파일뿐이다.
  if (removed) await removeImageFiles(removed);

  return NextResponse.json({ ok: true });
}

/**
 * 사진 파일(원본 + 썸네일) 삭제 — **다른 글이 같은 경로를 가리키지 않을 때만.**
 *
 * anon 은 PostgREST 로 직접 INSERT 할 수 있고(008), 010 은 경로의 **모양**만
 * 본다. 게시된 글의 사진 주소는 공개돼 있으니, 그 경로를 그대로 적은 가짜
 * 제출이 들어올 수 있다. 운영자가 그 가짜 글에서 사진을 빼면 진짜 글의 사진이
 * 같이 사라진다 — 그래서 지우기 전에 다른 참조가 있는지 본다.
 */
async function removeImageFiles(path: string) {
  try {
    const admin = createAdminClient();
    const { count, error: refError } = await admin
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .contains("image_paths", [path]);
    if (refError) throw new Error(`참조 확인 실패: ${refError.message}`);
    if ((count ?? 0) > 0) return;

    const { error } = await admin.storage
      .from(REVIEW_IMAGE_BUCKET)
      .remove([path, thumbPath(path)]);
    if (error) throw new Error(error.message);
  } catch (e) {
    // 행에서는 이미 빠졌다 — 남은 파일은 주소를 아무도 모르는 채로 용량만 차지한다
    console.error(
      "[/api/admin/reviews] 사진 파일 삭제 실패 (행에서는 빠짐):",
      path,
      e instanceof Error ? e.message : String(e),
    );
  }
}
