"use client";

import { useState } from "react";
import {
  PRIVACY_OFFICER,
  PRIVACY_POLICY,
  SITE,
  TERMS_DOC,
  hasTel,
  isPlaceholder,
  orPending,
} from "@/lib/site-config";
import Modal from "@/components/ui/Modal";
import PolicyView from "@/components/ui/PolicyView";

/**
 * 푸터 법적 고지 링크.
 *
 * 이전에는 `<span className="cursor-pointer">` 두 개였다 — 눌리게 생겼는데
 * 아무 일도 일어나지 않는 컨트롤이라, 화면에서 가장 신뢰가 필요한 자리에
 * 죽은 버튼이 놓여 있었다. 지금은 실제로 열린다.
 *
 * 그다음 문제는 **내용**이었다. 개인정보처리방침 자리에 폼 체크박스 아래
 * 고지 4줄(`CONSENT.privacyDetail`)을 그대로 다시 보여주고 있었다.
 * 수집목적·항목·보유기간·거부권만 있는 글이다. 그런데 이 사이트는
 * 가입 접수를 위해 통신사에 신청 정보를 넘기고(제3자 제공), 어드민 엑셀
 * 내보내기로 상담 인력에게 이름·연락처를 전달한다(처리위탁). 둘 다 **실제로
 * 하는 일**인데 방침에 한 줄도 없었다 — 보호법 §30 기재사항 미달이다.
 *
 * 지금은 `PRIVACY_POLICY` · `TERMS_DOC` 전문을 띄운다. 문구는 모두
 * `lib/site-config.ts` 에 있고, 코드가 실제로 하는 일(암호화 방식·보유기간·
 * 접속기록)과 일치시켜 작성했다. 운영자가 채워야 하는 값은 상호 6항목과
 * 보호책임자 3항목뿐이며, 미입력이면 "등록 전"으로 **표기**한다 — 숨기지 않는다.
 */

/** 보호책임자·사업자 정보 중 하나라도 미입력이면 안내 줄을 붙인다 */
function pendingNotice(values: (string | null | undefined)[]): string | null {
  return values.some((v) => isPlaceholder(v))
    ? "표기되지 않은 항목은 사업자 등록 절차 확인 후 기재합니다."
    : null;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-line py-2 last:border-0">
      <dt className="w-24 shrink-0 font-bold text-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function LegalLinks() {
  const [open, setOpen] = useState<"terms" | "privacy" | null>(null);

  const linkClass =
    "cursor-pointer underline-offset-4 transition-colors hover:text-brand hover:underline";

  const officerNotice = pendingNotice([
    PRIVACY_OFFICER.name,
    PRIVACY_OFFICER.position,
    PRIVACY_OFFICER.email,
  ]);
  const contactNotice = pendingNotice([
    SITE.business.companyName,
    SITE.tel,
    PRIVACY_OFFICER.email,
  ]);

  return (
    <>
      <nav className="flex gap-5 text-sm font-bold text-muted">
        <button type="button" className={linkClass} onClick={() => setOpen("terms")}>
          이용약관
        </button>
        <button
          type="button"
          className={linkClass}
          onClick={() => setOpen("privacy")}
        >
          개인정보처리방침
        </button>
      </nav>

      <Modal
        open={open === "terms"}
        onClose={() => setOpen(null)}
        title="이용약관"
        size="lg"
      >
        <PolicyView
          doc={TERMS_DOC}
          operatorBlock={
            <>
              <dl className="text-[13px]">
                <InfoRow label="상호" value={orPending(SITE.business.companyName)} />
                <InfoRow
                  label="문의 전화"
                  value={hasTel() ? SITE.tel : "등록 전"}
                />
                <InfoRow label="이메일" value={orPending(PRIVACY_OFFICER.email)} />
              </dl>
              {contactNotice && (
                <p className="text-xs text-faint">{contactNotice}</p>
              )}
            </>
          }
        />
      </Modal>

      <Modal
        open={open === "privacy"}
        onClose={() => setOpen(null)}
        title="개인정보처리방침"
        size="lg"
      >
        <PolicyView
          doc={PRIVACY_POLICY}
          operatorBlock={
            <>
              <dl className="text-[13px]">
                <InfoRow label="성명" value={orPending(PRIVACY_OFFICER.name)} />
                <InfoRow label="직책" value={orPending(PRIVACY_OFFICER.position)} />
                <InfoRow label="이메일" value={orPending(PRIVACY_OFFICER.email)} />
                <InfoRow
                  label="전화"
                  value={hasTel() ? SITE.tel : "등록 전"}
                />
              </dl>
              {officerNotice && (
                <p className="text-xs text-faint">{officerNotice}</p>
              )}
            </>
          }
        />
      </Modal>
    </>
  );
}
