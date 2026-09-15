import { SITE } from "@/lib/site-config";

// 푸터 — 사업자 정보 6종 표기는 법적 필수 (런칭 전 체크리스트).
// TODO: 이용약관·개인정보처리방침 모달 (content/terms.mdx, privacy.mdx 작성 후 연결)
export default function Footer() {
  const b = SITE.business;
  return (
    <footer className="border-t border-gray-100 bg-gray-50 pb-24 lg:pb-10">
      <div className="mx-auto max-w-6xl px-4 py-10 text-xs leading-relaxed text-gray-500">
        <p className="mb-3 flex gap-4 text-sm font-medium text-gray-700">
          <span>이용약관</span>
          <span>개인정보처리방침</span>
        </p>
        <p>
          상호: {b.companyName} | 대표자: {b.ceo} | 사업자등록번호: {b.bizRegNo}
        </p>
        <p>
          부가통신사업 신고번호: {b.telecomReportNo} | 통신판매업 신고번호:{" "}
          {b.mailOrderNo}
        </p>
        <p>
          주소: {b.address} | 대표번호: {SITE.tel}
        </p>
        <p className="mt-3 text-gray-400">
          본 사이트는 통신사 공식 대리점/판매점의 가입 상담 접수 페이지이며,
          계약 체결은 각 통신사 절차에 따릅니다.
        </p>
      </div>
    </footer>
  );
}
