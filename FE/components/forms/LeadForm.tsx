"use client";

import { useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { PRODUCTS, type Carrier } from "@/lib/validation";
import { CARRIER_MENU, CONSENT } from "@/lib/site-config";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { ConsentCheck, fieldBase, selectBase } from "@/components/ui/Field";
import { formatPhone, useLeadSubmit } from "./useLeadSubmit";

// 본문 인라인 상담 폼. 제출 규격은 useLeadSubmit 이 담당한다.
// variant "full": 통신사+관심상품 포함(랜딩 인라인), "compact": 관심상품부터(서브페이지)

interface Props {
  variant?: "full" | "compact";
  defaultCarrier?: Carrier;
  /** 통신사를 바깥(히어로 칩 등)에서 제어할 때. 주면 controlled 로 동작한다 */
  carrier?: string;
  onCarrierChange?: (v: string) => void;
}

export default function LeadForm({
  variant = "full",
  defaultCarrier,
  carrier: carrierProp,
  onCarrierChange,
}: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [carrierState, setCarrierState] = useState<string>(defaultCarrier ?? "");
  const [product, setProduct] = useState<string>("");
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [token, setToken] = useState("");
  const tsRef = useRef<TurnstileInstance | null>(null);
  const consentRef = useRef<HTMLDivElement>(null);

  // 통신사는 controlled(히어로 칩 연동) / uncontrolled(단독 사용) 양쪽을 지원한다
  const controlled = carrierProp !== undefined;
  const carrier = controlled ? carrierProp : carrierState;
  const setCarrier = (v: string) =>
    controlled ? onCarrierChange?.(v) : setCarrierState(v);

  const { status, error, submit, fail } = useLeadSubmit();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // 버튼을 비활성으로 두지 않는다 — 누르면 무엇이 빠졌는지 말해준다.
    // 랜딩의 주 CTA 가 회색으로 죽어 있으면 페이지 전체가 미완성으로 읽힌다.
    if (!consentPrivacy) {
      fail("개인정보 수집·이용에 동의해 주세요");
      consentRef.current?.scrollIntoView({ block: "center" });
      return;
    }
    if (!token) {
      fail("자동입력 방지 확인 중입니다. 잠시 후 다시 눌러주세요");
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
      className="relative flex flex-col gap-3"
    >
      {/* 통신사는 드롭다운이 아니라 칩 라디오로 받는다.
          선택지가 4개뿐이라 펼칠 이유가 없고(2탭 → 1탭), 통신사 고유색이
          그대로 드러나 무엇을 고르는 자리인지 한눈에 읽힌다.
          radio 로 구현해 키보드 화살표 이동과 스크린리더 그룹 읽기가 살아 있다. */}
      {variant === "full" && (
        <fieldset className="rounded-xl border border-line-strong p-3">
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
                      ? "border-transparent text-white"
                      : "border-line-strong bg-white text-foreground hover:border-brand"
                  }`}
                  // 선택 시 흰 글자가 얹히므로 ink 변형을 쓴다.
                    // 원색은 SK 3.50:1 · 스카이라이프 2.91:1 로 기준 미달이었다.
                    style={on ? { backgroundColor: `var(${m.inkVar})` } : undefined}
                >
                  <input
                    type="radio"
                    name="carrier"
                    value={m.code}
                    checked={on}
                    onChange={() => setCarrier(m.code)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full ${on ? "bg-white/85" : ""}`}
                    style={on ? undefined : { backgroundColor: `var(${m.colorVar})` }}
                  />
                  {m.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

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

      {/* placeholder 는 입력을 시작하면 사라진다. 그것만으로는 라벨이 아니다 —
          스크린리더와 음성입력이 칸을 식별할 수단이 필요하다 */}
      <label htmlFor="lead-name" className="sr-only">
        이름
      </label>
      <input
        id="lead-name"
        className={fieldBase}
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
        className={fieldBase}
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
      <div ref={consentRef} className="mt-1 flex flex-col gap-2">
        <ConsentCheck
          checked={consentPrivacy}
          onChange={setConsentPrivacy}
          required
          detail={CONSENT.privacyDetail}
        >
          {CONSENT.privacyLabel}
        </ConsentCheck>
        <ConsentCheck checked={consentMarketing} onChange={setConsentMarketing}>
          {CONSENT.marketingLabel}
        </ConsentCheck>
      </div>

      {siteKey ? (
        // 흰 카드 안에 검은 위젯이 박히지 않도록 라이트 테마로 맞춘다
        <Turnstile
          ref={tsRef}
          siteKey={siteKey}
          onSuccess={setToken}
          onExpire={() => setToken("")}
          options={{ size: "flexible", theme: "light" }}
        />
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
        size="lg"
        fullWidth
        loading={status === "loading"}
      >
        {status === "loading" ? "접수 중..." : "상담 신청하기"}
      </Button>
    </form>
  );
}
