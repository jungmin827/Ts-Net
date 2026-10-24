"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { PRODUCTS, checkNamePhone, type Carrier } from "@/lib/validation";
import { CARRIER_MENU, CONSENT } from "@/lib/site-config";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { ConsentCheck, fieldBase, selectBase } from "@/components/ui/Field";
import { PrivacyPolicyBody } from "@/components/sections/LegalLinks";
import { formatPhone, useLeadSubmit } from "./useLeadSubmit";

// 본문 인라인 상담 폼. 제출 규격은 useLeadSubmit 이 담당한다.
// variant "full": 통신사+관심상품 포함(랜딩 인라인), "compact": 관심상품부터(서브페이지)

interface Props {
  variant?: "full" | "compact";
  defaultCarrier?: Carrier;
  /** 통신사를 바깥(히어로 칩 등)에서 제어할 때. 주면 controlled 로 동작한다 */
  carrier?: string;
  onCarrierChange?: (v: string) => void;
  /**
   * 포스터 위에 얹는 카드용 압축 배치 (메인 `#consult`).
   * 관심상품을 빼고 간격·입력칸·동의 박스를 줄이며, Turnstile 은 확인이 필요할 때만
   * 나타나게 한다(interaction-only, 하단 고정바와 같은 방식). 배경 포스터 높이에
   * 카드를 맞추기 위한 것이다 — 필수 항목·동의 분리·법정 고지는 그대로다.
   */
  dense?: boolean;
}

export default function LeadForm({
  variant = "full",
  defaultCarrier,
  carrier: carrierProp,
  onCarrierChange,
  dense = false,
}: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [carrierState, setCarrierState] = useState<string>(defaultCarrier ?? "");
  const [product, setProduct] = useState<string>("");
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [token, setToken] = useState("");
  const tsRef = useRef<TurnstileInstance | null>(null);
  /**
   * 위젯·스크립트가 실패했는지. 광고 차단기나 사내망이 challenges.cloudflare.com
   * 을 막으면 토큰이 영영 안 온다 — 그때 "잠시 후 다시" 는 거짓말이다.
   */
  const [tsFailed, setTsFailed] = useState(false);
  // 스크립트 주입 effect 가 이 객체를 의존성으로 본다 — 매 렌더 새 객체면 주입을 재시도한다
  const tsScriptOptions = useMemo(() => ({ onError: () => setTsFailed(true) }), []);
  const consentRef = useRef<HTMLDivElement>(null);

  /**
   * 아주 좁은 화면에서는 Turnstile 을 `compact`(150×140)로 떨어뜨린다.
   *
   * `flexible` 의 **최소 폭이 300px** 이라 320px 기기에서는 어떤 여백 조합으로도
   * 들어가지 않는다 — 거터·패딩·테두리를 다 합쳐 양쪽 10px 안에 끝내야 하는데
   * 그런 카드는 만들 수 없다. 실측 가용폭 260px, 40px 모자란다.
   *
   * 지금은 `overflow-x-auto` 가 받아내 페이지는 안 깨지지만, **가로로 밀어야
   * 풀 수 있는 캡차**가 된다. 이 사이트의 유일한 폼에서 그건 전환 차단이다.
   * compact 는 Cloudflare 가 공식 지원하는 크기라 안전하게 작아진다.
   */
  const [compactTs, setCompactTs] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 359px)");
    const apply = () => setCompactTs(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // 통신사는 controlled(히어로 칩 연동) / uncontrolled(단독 사용) 양쪽을 지원한다
  const controlled = carrierProp !== undefined;
  const carrier = controlled ? carrierProp : carrierState;
  const setCarrier = (v: string) =>
    controlled ? onCarrierChange?.(v) : setCarrierState(v);

  const { status, error, submit, fail } = useLeadSubmit();
  const field = dense ? fieldBase.replace("py-3.5", "py-2.5") : fieldBase;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // 버튼을 비활성으로 두지 않는다 — 누르면 무엇이 빠졌는지 말해준다.
    // 랜딩의 주 CTA 가 회색으로 죽어 있으면 페이지 전체가 미완성으로 읽힌다.
    const missing = checkNamePhone(name, phone);
    if (missing) {
      fail(missing);
      return;
    }
    if (!consentPrivacy) {
      fail("개인정보 수집·이용에 동의해 주세요");
      consentRef.current?.scrollIntoView({ block: "center" });
      return;
    }
    if (!token) {
      fail(
        tsFailed
          ? "보안 확인을 불러오지 못했습니다. 광고 차단 기능을 끄거나 새로고침한 뒤 다시 시도해 주세요"
          : "자동입력 방지 확인 중입니다. 잠시 후 다시 눌러주세요",
      );
      return;
    }

    // honeypot — 사람 눈에 안 보이는 필드. 봇이 채우면 서버가 조용히 폐기
    const website =
      (new FormData(e.currentTarget).get("website") as string) ?? "";

    const ok = await submit({
      name,
      phone,
      carrier: carrier || undefined,
      product: product || undefined,
      consent_privacy: consentPrivacy,
      consent_marketing: consentMarketing,
      turnstileToken: token,
      website,
    });
    if (ok) return;

    setToken(""); // Turnstile 토큰은 1회용 — 실패 시 재발급
    tsRef.current?.reset();
  }

  if (status === "done") {
    return (
      <div className="animate-pop rounded-panel border border-brand/20 bg-brand-soft p-8 text-center">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-brand-dark text-white shadow-brand">
          <Icon name="check" size={28} />
        </span>
        <p className="text-xl font-black text-brand-deep">
          상담 신청이 접수되었습니다
        </p>
        <p className="mt-2 text-sm text-muted">
          확인 후 순차적으로 연락드리겠습니다
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`relative flex flex-col ${dense ? "gap-2" : "gap-3"}`}
    >
      {/* 통신사는 드롭다운이 아니라 칩 라디오로 받는다.
          선택지가 4개뿐이라 펼칠 이유가 없다(2탭 → 1탭). 선택된 칩은 검게 채운다.
          radio 로 구현해 키보드 화살표 이동과 스크린리더 그룹 읽기가 살아 있다. */}
      {variant === "full" && (
        <fieldset className={`rounded-xl border border-line-strong ${dense ? "px-2.5 pt-1 pb-2.5" : "p-3"}`}>
          <legend className="px-1.5 text-xs font-bold text-muted">
            통신사 선택
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {CARRIER_MENU.map((m) => {
              const on = carrier === m.code;
              return (
                <label
                  key={m.slug}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg border-2 px-2.5 py-1.5 text-[0.8125rem] font-bold transition-all duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                    on
                      ? "border-foreground bg-foreground text-white"
                      : "border-line-strong bg-surface text-foreground hover:border-foreground"
                  }`}
                >
                  <input
                    type="radio"
                    name="carrier"
                    value={m.code}
                    checked={on}
                    onChange={() => setCarrier(m.code)}
                    className="sr-only"
                  />
                  {m.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {!dense && (
      <select
        className={selectBase}
        value={product}
        onChange={(e) => setProduct(e.target.value)}
        aria-label="관심상품 선택"
      >
        <option value="">관심상품 선택</option>
        {PRODUCTS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      )}

      {/* placeholder 는 입력을 시작하면 사라진다. 그것만으로는 라벨이 아니다 —
          스크린리더와 음성입력이 칸을 식별할 수단이 필요하다 */}
      <label htmlFor="lead-name" className="sr-only">
        이름
      </label>
      <input
        id="lead-name"
        className={field}
        type="text"
        aria-invalid={error ? true : undefined}
        placeholder="이름을 입력해주세요."
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={20}
        autoComplete="name"
      />
      <label htmlFor="lead-phone" className="sr-only">
        연락처
      </label>
      <input
        id="lead-phone"
        className={field}
        type="tel"
        inputMode="numeric"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "lead-error" : undefined}
        placeholder="연락처를 입력해주세요."
        value={phone}
        onChange={(e) => setPhone(formatPhone(e.target.value))}
        required
        maxLength={13}
        autoComplete="tel"
      />

      {/* honeypot — 시각적으로 숨김. display:none 은 봇이 감지하므로 offscreen 배치 */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      {/* 개인정보 동의와 마케팅 동의는 반드시 분리 (CLAUDE.md 규칙 2) */}
      <div ref={consentRef} className={`flex flex-col ${dense ? "gap-1.5" : "mt-1 gap-2"}`}>
        <ConsentCheck
          checked={consentPrivacy}
          onChange={setConsentPrivacy}
          required
          compact={dense}
        >
          {CONSENT.privacyLabel}
        </ConsentCheck>
        <p className="text-xs text-muted">{CONSENT.privacyRequiredHint}</p>

        {/* 동의 대상 전문을 체크박스 바로 아래 스크롤 박스로 펼쳐 둔다.
            법정 고지 4항목(목적·항목·기간·거부권)을 맨 위에 두어 스크롤하지 않아도
            보이게 하고, 그 아래로 처리방침 전문(푸터 모달과 같은 글)을 잇는다.
            스크롤 영역은 키보드로도 내릴 수 있어야 하므로 포커스를 받는다. */}
        <div
          role="region"
          aria-label="개인정보 수집 및 이용 안내"
          tabIndex={0}
          className={`${dense ? "h-24 px-4 py-3" : "h-28 p-4"} overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface-muted outline-none focus-visible:ring-2 focus-visible:ring-brand`}
        >
          <p className="mb-2 text-sm font-bold text-foreground">
            개인정보 수집·이용 안내
          </p>
          <ul className="mb-4 flex flex-col gap-1 border-b border-line pb-4 text-[13px] leading-[1.6] text-muted">
            {CONSENT.privacyDetail.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <PrivacyPolicyBody />
        </div>

        <ConsentCheck
          checked={consentMarketing}
          onChange={setConsentMarketing}
          compact={dense}
        >
          {CONSENT.marketingLabel}
        </ConsentCheck>
      </div>

      {siteKey ? (
        // 흰 카드 안에 검은 위젯이 박히지 않도록 라이트 테마로 맞춘다.
        // `flexible` 이어도 **최소 폭이 300px** 이라 그보다 좁은 자리에서는 줄지 않는다.
        // 마지막 안전장치로 가로 스크롤 컨테이너에 담는다 — 더 좁아지는 기기가
        // 나오더라도 페이지 레이아웃을 밀지 않고 이 칸 안에서만 넘친다.
        <div className="w-full overflow-x-auto">
        <Turnstile
          ref={tsRef}
          siteKey={siteKey}
          onSuccess={(t) => {
            setToken(t);
            setTsFailed(false);
          }}
          onExpire={() => setToken("")}
          onError={() => {
            setToken("");
            setTsFailed(true);
          }}
          onUnsupported={() => setTsFailed(true)}
          scriptOptions={tsScriptOptions}
          options={{
            size: compactTs ? "compact" : "flexible",
            theme: "light",
            // 압축 배치에서는 확인이 필요할 때만 위젯이 나타난다 — 통과면 자리를 먹지 않는다
            ...(dense ? { appearance: "interaction-only" as const } : {}),
          }}
        />
        </div>
      ) : (
        <p className="text-xs text-red-500">
          Turnstile 사이트 키가 설정되지 않았습니다 (.env.local)
        </p>
      )}

      {error && (
        <p
          id="lead-error"
          role="alert"
          className="animate-pop rounded-lg bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="cta"
        size={dense ? "md" : "lg"}
        fullWidth
        loading={status === "loading"}
      >
        {status === "loading" ? "접수 중..." : "상담 신청하기"}
      </Button>
    </form>
  );
}
