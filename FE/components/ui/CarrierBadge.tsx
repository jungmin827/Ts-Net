import { CARRIER_COLOR, carrierByCode } from "@/lib/site-config";

/**
 * 통신사 뱃지 — 목록·상세·측정 하네스가 **같은 한 곳**을 쓴다.
 *
 * ── 왜 컴포넌트인가 ──────────────────────────────────────────
 * 이 요소에서 정확히 한 번 사고가 났다. 상세 마크업을 측정 하네스가 손으로
 * 베끼면서 배경 클래스를 `bg-kt-ink`(존재하지 않는 클래스)로 적었고, 배경이
 * 안 칠해져 흰 글자가 흰 바탕에 얹혀 **대비 1.00 의 거짓 위반**이 잡혔다.
 * 제품은 멀쩡했는데 측정값이 거짓이었다 — 반대(제품이 깨졌는데 하네스는
 * 맞는 경우)도 똑같이 생길 수 있고, 그쪽은 아무도 모른다.
 *
 * 그 사고를 겪고 `BoardArticle` 은 컴포넌트로 뽑았는데, **뱃지는 `badge`
 * prop 으로 넘기는 구조여서 하네스가 그 자리에서 계속 손으로 베끼고 있었다.**
 * 즉 사고가 난 바로 그 요소만 공유되지 않은 상태였다.
 *
 * 흰 글자가 얹히므로 배경은 원색이 아니라 대비를 맞춘 `-ink` 변형이다
 * (`CARRIER_COLOR`, globals.css 주석 참고).
 */
export default function CarrierBadge({
  code,
  label = "short",
  className = "",
}: {
  /** `KT` `SK` `LG` `SKYLIFE` — 모르는 코드는 중립 배경으로 떨어진다 */
  code: string;
  /**
   * `short` — 카드 격자용. `SKYLIFE` 를 `SKY` 로 줄인다. 카드 폭이 좁아
   * 전체 표기(`KT스카이라이프`)가 들어가면 제목 줄을 밀어낸다.
   * `full` — 상세용. 자리가 있으므로 정식 표기를 쓴다.
   */
  label?: "short" | "full";
  /** 여백만 호출부가 정한다 (목록 `mb-2.5` / 상세 `mb-3`) */
  className?: string;
}) {
  const text =
    label === "full"
      ? (carrierByCode(code)?.label ?? code)
      : code === "SKYLIFE"
        ? "SKY"
        : code;
  return (
    <span
      className={`inline-block w-fit rounded-md px-2 py-0.5 text-[11px] font-black text-white ${CARRIER_COLOR[code] ?? "bg-muted"} ${className}`}
    >
      {text}
    </span>
  );
}
