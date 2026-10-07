import Link from "next/link";
import Icon from "@/components/ui/Icon";

/**
 * 섹션 사이에 끼우는 가벼운 전환 유도 한 줄.
 *
 * 실측 결과 메인 7,328px 에 전환 수단이 3개뿐이고 최대 간격이 2,859px 였다.
 * 하단 고정바가 상시 떠 있긴 하지만, 바를 접은 사람에겐 본문 안의 유도가
 * 유일한 경로다.
 *
 * 푸터의 전환 밴드와 **역할이 겹치지 않도록 색면을 쓰지 않는다.**
 * 이 사이트의 색면은 CTA 버튼 하나뿐이어야 한다 (CLAUDE.md 색 운용 규칙).
 * 그래서 여기서는 테두리 한 줄 + 텍스트 링크로만 만든다.
 */
export default function ConsultCue({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white">
      <div className="mx-auto max-w-4xl px-4">
        <div className="flex flex-col items-start gap-3 border-y border-line py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted md:text-[0.9375rem]">{children}</p>
          <Link
            href="#consult"
            className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-black whitespace-nowrap text-brand-dark underline-offset-4 hover:underline md:text-base"
          >
            상담 신청하기
            <Icon
              name="arrowRight"
              size={17}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>
        </div>
      </div>
    </div>
  );
}
