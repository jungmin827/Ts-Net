import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/auth";
import { requestIp } from "@/lib/admin/audit";
import { isSameOrigin } from "@/lib/admin/same-origin";
import { logAccess } from "@/lib/audit";
import { GIFT_STATUSES, LEAD_STATUSES } from "@/lib/admin/labels";
import { createAdminClient } from "@/lib/supabase/admin";

// 상태·사은품상태·메모 변경.
//
// 쓰기는 **세션 클라이언트를 먼저** 쓰고, RLS 에 막히면 service_role 로 물러난다.
//
// 배경: leads 변경 트리거(log_lead_change)가 lead_logs 에 이력을 남기는데,
// 001 스키마에는 lead_logs INSERT 정책이 없어 authenticated 세션으로는 막힌다.
// 마이그레이션 005 가 그 정책을 열고 트리거를 SECURITY DEFINER 로 올린다.
// 005 적용 후에는 세션 경로가 통과하면서 lead_logs.actor_id 가 채워진다.
// 그 전까지는 service_role 로 물러나므로 actor_id 는 NULL 이고,
// 변경 주체는 access_logs(UPDATE) 로만 확인된다.

const idSchema = z.coerce.number().int().positive();

const patchSchema = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    gift_status: z.enum(GIFT_STATUSES).optional(),
    memo: z.string().max(2000).optional(),
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

  // 읽기 전용 계정은 변경할 수 없다
  if (guard.admin.role !== "OWNER") {
    return NextResponse.json(
      { ok: false, error: "변경 권한이 없는 계정입니다" },
      { status: 403 },
    );
  }

  const { id: rawId } = await ctx.params;
  const parsedId = idSchema.safeParse(rawId);
  if (!parsedId.success) {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다" }, { status: 400 });
  }
  const id = parsedId.data;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" },
      { status: 400 },
    );
  }
  const patch = parsed.data;

  // 변경 전 값 — 감사로그와 memo 이력에 남긴다 (전화번호는 읽지 않는다)
  const { data: before, error: beforeError } = await guard.supabase
    .from("leads")
    .select("id, status, gift_status, memo")
    .eq("id", id)
    .maybeSingle();

  if (beforeError) {
    return NextResponse.json({ ok: false, error: "조회에 실패했습니다" }, { status: 500 });
  }
  if (!before) {
    return NextResponse.json({ ok: false, error: "존재하지 않는 건입니다" }, { status: 404 });
  }

  /**
   * 쓰기는 **세션 클라이언트를 먼저 시도**한다.
   *
   * 이유: `leads` 변경 트리거(`log_lead_change`)가 `lead_logs` 에 이력을 남기는데,
   * 그 행의 `actor_id` 는 **호출자 세션**에서 온다. service_role 로 쓰면 누가 바꿨는지가
   * 늘 NULL 로 남아, 변경 이력과 접속기록을 대조해야만 주체를 알 수 있다.
   *
   * 다만 마이그레이션 005(`lead_logs_insert_policy`)가 적용되기 전에는 RLS 가
   * 트리거의 INSERT 를 막아 UPDATE 자체가 실패한다. 그래서 실패하면
   * service_role 로 물러난다 — 기능을 멈추지 않되, 물러났다는 사실은 로그에 남긴다.
   *
   * 005 가 적용되면 자동으로 세션 경로로 올라가고 `actor_id` 가 채워진다.
   */
  const session = guard.supabase;
  let writer = session;
  let { error: updateError } = await session.from("leads").update(patch).eq("id", id);

  if (updateError) {
    console.warn(
      "[/api/admin/leads] 세션 클라이언트 쓰기 실패 — service_role 로 물러납니다",
      "(마이그레이션 005 미적용 시 정상):",
      updateError.code,
    );
    try {
      writer = createAdminClient();
    } catch {
      return NextResponse.json(
        { ok: false, error: "서버 설정 오류입니다 (SUPABASE_SERVICE_ROLE_KEY)" },
        { status: 500 },
      );
    }
    ({ error: updateError } = await writer.from("leads").update(patch).eq("id", id));
  }

  if (updateError) {
    console.error("[/api/admin/leads] update 실패:", updateError.code, updateError.message);
    return NextResponse.json({ ok: false, error: "변경에 실패했습니다" }, { status: 500 });
  }

  /**
   * memo 는 트리거 대상이 아니므로 직접 이력을 남긴다 (본문은 길이만).
   *
   * ⚠ **반환 error 를 반드시 본다.** 예전에는 `await` 만 하고 결과를 버렸는데,
   *   그게 조용한 이력 유실을 만들었다. 경로를 따라가 보면 —
   *     · `log_lead_change()` 는 status·gift_status 가 바뀔 때만 INSERT 한다.
   *     · 그래서 **memo 만 고친 PATCH 는 005 미적용 상태에서도 UPDATE 가 성공**하고,
   *       위쪽 폴백이 돌지 않아 `writer` 는 세션 클라이언트로 남는다.
   *     · 그 상태에서 이 INSERT 는 RLS(005 가 추가하는 정책이 아직 없다)에 막힌다.
   *     · 반환값을 아무도 보지 않으니 라우트는 `{ok:true}` 를 돌려준다.
   *   화면에는 "저장했습니다"가 뜨고 메모도 실제로 저장되는데 이력만 사라진다.
   *   폴백이 "실패하면 물러난다"로만 되어 있어 **실패하지 않고 일부만 빠지는 경로**를
   *   덮지 못했다. 그래서 여기서 한 번 더 폴백하고, 그래도 안 되면 알린다.
   */
  if (patch.memo !== undefined && patch.memo !== (before.memo ?? "")) {
    const memoLog = {
      lead_id: id,
      actor_id: guard.admin.userId,
      field: "memo",
      before_val: before.memo ? `(${String(before.memo).length}자)` : null,
      after_val: patch.memo ? `(${patch.memo.length}자)` : "(삭제)",
    };

    let { error: logError } = await writer.from("lead_logs").insert(memoLog);

    if (logError && writer === session) {
      // 세션 경로가 막힌 것뿐일 수 있다 (005 미적용). 전권 키로 한 번 더.
      try {
        ({ error: logError } = await createAdminClient()
          .from("lead_logs")
          .insert(memoLog));
      } catch {
        // service_role 키가 없는 경우 — logError 를 그대로 둔다
      }
    }

    if (logError) {
      console.error(
        "[/api/admin/leads] memo 변경 이력 기록 실패:",
        logError.code,
        logError.message,
      );
      // 변경은 이미 반영됐다. 감사로그 실패와 **같은 등급**으로 알린다 —
      // 이력이 빠진 사실을 운영자가 모르고 지나가서는 안 된다.
      return NextResponse.json(
        { ok: false, error: "변경은 저장됐지만 변경 이력 기록에 실패했습니다" },
        { status: 500 },
      );
    }
  }

  try {
    await logAccess({
      actorId: guard.admin.userId,
      actorEmail: guard.admin.email,
      action: "UPDATE",
      target: `leads:${id}`,
      rowCount: 1,
      detail: {
        fields: Object.keys(patch),
        status: patch.status
          ? { before: before.status, after: patch.status }
          : undefined,
        gift_status: patch.gift_status
          ? { before: before.gift_status, after: patch.gift_status }
          : undefined,
        memo_changed: patch.memo !== undefined,
      },
      ip: requestIp(req.headers),
    });
  } catch (e) {
    // 변경은 이미 반영됐다 — 기록 실패를 숨기지 않고 알린다
    console.error(
      "[/api/admin/leads] 감사로그 기록 실패:",
      e instanceof Error ? e.message : e,
    );
    return NextResponse.json(
      { ok: false, error: "변경은 저장됐지만 접속기록 저장에 실패했습니다" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
