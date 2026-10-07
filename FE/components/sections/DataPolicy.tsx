import Link from "next/link";
import { CARRIER_MENU } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";
import SectionHeading from "@/components/ui/SectionHeading";

/**
 * 실시간 현황이 비어 있을 때 그 자리를 대신하는 블록.
 *
 * 레퍼런스는 같은 자리에 접수 내역을 상시 롤링시킨다(지원금 금액까지 적혀 있다).
 * 우리는 **실제 접수가 5건 미만이면 아무것도 띄우지 않는다** (CLAUDE.md 규칙 1).
 * 그 결과 700px 짜리 전환 장치 자리가 영구 공백이 됐다.
 *
 * 공백을 지어낸 데이터로 메우는 건 규칙 위반이고, 그냥 비워 두는 건 낭비다.
 * 그래서 **비어 있다는 사실 자체를 말한다.** 이 업종에서 방문자가 가장 의심하는
 * 지점이 "저 숫자들 진짜인가"이므로, 꾸미지 않는다는 선언이 곧 차별점이 된다.
 *
 * 경쟁사를 언급하지 않는다 — 우리가 무엇을 하는지만 적는다 (비방 광고 회피).
 *
 * ⚠ `reason` 없이 늘 같은 문장을 쓰면 안 된다.
 *   "아직 공개할 만큼 쌓이지 않았습니다"는 **건수를 안다고 주장하는 문장**이다.
 *   조회가 실패했거나 아직 응답을 못 받은 상태에서 그 말을 하면 거짓이 된다.
 *   서버 렌더·크롤러·JS 미동작 환경은 언제나 "아직 모름" 상태라 더 그렇다.
 *   그래서 단정하는 문장은 `tooFew` 일 때만 쓴다.
 */
export default function DataPolicy({
  reason = "loading",
}: {
  reason?: "loading" | "tooFew" | "error";
}) {
  /** 상태별 머리 문장. 어느 것도 모르는 것을 아는 척하지 않는다 */
  const headline =
    reason === "tooFew"
      ? "아직 공개할 만큼 쌓이지 않았습니다."
      : reason === "error"
        ? "지금은 현황을 불러오지 못했습니다."
        : "이 자리에는 실제 접수 건만 올립니다.";
  return (
    <section className="bg-surface-muted py-16 md:py-20">
      <div className="mx-auto max-w-4xl px-4">
        <SectionHeading
          title="실시간 신청 현황"
          description="실제 접수된 건만 마스킹해 공개합니다"
        />

        <div className="rounded-panel border border-line bg-white p-6 md:p-9">
          <p className="text-base leading-relaxed font-bold text-foreground md:text-lg">
            {headline}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted md:text-base">
            이 자리에는 <strong className="font-bold text-foreground">실제 접수 건</strong>만
            이름을 가려 올립니다. 꾸며낸 내역은 올리지 않습니다.
            {reason === "error"
              ? " 잠시 후 다시 확인해 주세요."
              : " 그래서 표시할 수 있는 건수가 모이기 전까지는 비워 둡니다."}
          </p>

          <dl className="mt-7 grid grid-cols-1 gap-x-8 gap-y-4 border-t border-line pt-6 sm:grid-cols-2">
            <div>
              <dt className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Icon name="compare" size={16} className="text-brand-dark" />
                취급 통신사
              </dt>
              <dd className="mt-2 flex flex-wrap gap-1.5">
                {CARRIER_MENU.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/${c.slug}`}
                    className="flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1.5 text-[0.8125rem] font-bold text-foreground transition-colors hover:border-brand"
                  >
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full"
                      style={{ backgroundColor: `var(${c.colorVar})` }}
                    />
                    {c.label}
                  </Link>
                ))}
              </dd>
            </div>

            <div>
              <dt className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Icon name="shield" size={16} className="text-brand-dark" />
                접수한 연락처는
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">
                암호화해 저장하고, 목록 화면에서도 가린 번호만 보입니다. 원본을 열람하면
                누가 언제 열었는지 기록이 남습니다.
              </dd>
            </div>
          </dl>

          <p className="mt-7 border-t border-line pt-5 text-sm text-muted">
            먼저 남겨주시면 확인 후 순차적으로 연락드립니다.{" "}
            <Link
              href="#consult"
              className="font-black text-brand-dark underline-offset-4 hover:underline"
            >
              상담 신청하기
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
