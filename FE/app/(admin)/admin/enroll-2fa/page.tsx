import { redirect } from "next/navigation";
import { checkAdmin, ENROLL_PATH, LOGIN_PATH } from "@/lib/admin/auth";
import EnrollForm from "./EnrollForm";

/**
 * TOTP 등록 페이지.
 *
 * 어드민 경로 중 **유일하게 aal1(비밀번호만) 세션으로 들어올 수 있다.**
 * Supabase 는 TOTP 등록을 로그인된 세션에서 `mfa.enroll()` 로만 제공하므로,
 * 미등록 계정에게 이 문을 열어두지 않으면 등록할 방법이 없어 계정이 영구 잠긴다.
 *
 * 이미 등록을 마친 계정이 여기로 오면 어드민 홈으로 돌려보낸다.
 */
export const dynamic = "force-dynamic";

export default async function Enroll2faPage() {
  const result = await checkAdmin({ allowAal1: true });

  if (!result.ok) {
    if (result.reason === "MFA_REQUIRED") redirect(`${LOGIN_PATH}?error=mfa`);
    redirect(LOGIN_PATH);
  }

  return (
    <div className="mx-auto w-full max-w-md py-10">
      <h1 className="text-lg font-bold">2단계 인증 등록</h1>
      <p className="mt-1 text-sm text-muted">
        상담신청 데이터를 다루는 화면입니다. 비밀번호만으로는 열 수 없습니다.
      </p>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        휴대폰의 인증 앱(Google OTP, Authy 등)으로 아래 QR 코드를 찍고, 앱에 뜨는
        6자리 숫자를 입력하세요. 등록은 한 번만 하면 됩니다.
      </p>
      <div className="mt-5">
        <EnrollForm nextPath="/admin" enrollPath={ENROLL_PATH} />
      </div>
    </div>
  );
}
