import Icon from "@/components/ui/Icon";

/**
 * 평점 별. **평점이 없으면 아무것도 그리지 않는다.**
 *
 * 예전에는 `rating ?? 5` 로 NULL 을 만점으로 바꿔 그렸다. 평가를 남기지 않은
 * 후기를 전부 별 다섯 개로 보이게 만드는 코드였고, CLAUDE.md 규칙 1(가짜
 * 데이터를 생성하지 않는다)의 가장 명백한 위반이었다. 표시광고 리스크이기도 하다.
 *
 * 메인 섹션·목록·상세 세 곳에서 쓰므로 여기 한 곳에만 둔다 — 복사해 두면
 * 그중 한 곳만 `?? 5` 로 되돌아가도 아무도 못 본다.
 */
export default function Stars({
  rating,
  size = 15,
}: {
  rating: number | null;
  size?: number;
}) {
  if (rating === null || rating <= 0) return null;
  const r = rating;
  return (
    // `role="img"` 가 있어야 `aria-label` 이 이름으로 쓰인다 —
    // 역할이 generic 인 요소의 aria-label 은 상당수 스크린리더가 무시한다.
    // 별 5개가 각각 읽히는 대신 "5점 만점에 N점" 한 번으로 읽혀야 한다.
    <span role="img" className="flex gap-0.5" aria-label={`5점 만점에 ${r}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name="star"
          size={size}
          filled
          // 채운 별은 `--star`(흰 배경 4.56:1 · 빈 별 3.07:1). `--accent` 는
          // 1.97:1 이라 비문자 3:1 에 미달한다 — globals.css 토큰 주석 참고.
          className={n <= r ? "text-star" : "text-line-strong"}
        />
      ))}
    </span>
  );
}
