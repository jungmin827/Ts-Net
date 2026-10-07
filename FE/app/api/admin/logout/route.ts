import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAccessSoft, requestIp } from "@/lib/admin/audit";

export async function POST(req: NextRequest) {
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
