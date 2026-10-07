import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAccessSoft, requestIp } from "@/lib/admin/audit";
import { isSameOrigin } from "@/lib/admin/same-origin";

export async function POST(req: NextRequest) {
  // 세션을 끊는 것도 부수효과다. 외부 페이지의 폼 전송 한 줄로 일어나서는 안 된다.
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { ok: false, error: "잘못된 요청입니다" },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.auth.signOut();

  if (user) {
    await logAccessSoft({
      actorId: user.id,
      actorEmail: user.email ?? undefined,
      action: "LOGOUT",
      target: "admin",
      ip: requestIp(req.headers),
    });
  }

  return NextResponse.redirect(new URL("/admin/login", req.url), { status: 303 });
}
