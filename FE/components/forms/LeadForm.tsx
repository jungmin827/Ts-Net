"use client";

import { useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { CARRIERS, PRODUCTS, type Carrier } from "@/lib/validation";
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
}

export default function LeadForm({ variant = "full", defaultCarrier }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [carrier, setCarrier] = useState<string>(defaultCarrier ?? "");
  const [product, setProduct] = useState<string>("");
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [token, setToken] = useState("");
  const tsRef = useRef<TurnstileInstance | null>(null);

  const { status, error, submit } = useLeadSubmit();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

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
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-brand text-white shadow-brand">
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
    <form onSubmit={handleSubmit} className="relative flex flex-col gap-3">
      {variant === "full" && (
        <select
          className={selectBase}
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          aria-label="통신사 선택"
        >
          <option value="">통신사 선택 (선택사항)</option>
          {CARRIERS.map((c) => (
            <option key={c} value={c}>
              {CARRIER_MENU.find((m) => m.code === c)?.label ?? c}
            </option>
          ))}
        </select>
      )}

      <select
        className={selectBase}
        value={product}
        onChange={(e) => setProduct(e.target.value)}
        aria-label="관심상품 선택"
      >
        <option value="">관심상품 선택 (선택사항)</option>
        {PRODUCTS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <input
        className={fieldBase}
        type="text"
        placeholder="이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={20}
        autoComplete="name"
      />
      <input
        className={fieldBase}
        type="tel"
        inputMode="numeric"
        placeholder="연락처 (010-0000-0000)"
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
      <div className="mt-1 flex flex-col gap-2">
        <ConsentCheck
          checked={consentPrivacy}
          onChange={setConsentPrivacy}
          required
        >
          {CONSENT.privacyInline}
        </ConsentCheck>
        <ConsentCheck checked={consentMarketing} onChange={setConsentMarketing}>
          {CONSENT.marketingLabel}
        </ConsentCheck>
      </div>

      {siteKey ? (
        <Turnstile
          ref={tsRef}
          siteKey={siteKey}
          onSuccess={setToken}
          onExpire={() => setToken("")}
          options={{ size: "flexible" }}
        />
      ) : (
        <p className="text-xs text-red-500">
          Turnstile 사이트 키가 설정되지 않았습니다 (.env.local)
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="animate-pop rounded-lg bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="accent"
        size="lg"
        fullWidth
        loading={status === "loading"}
        disabled={!consentPrivacy || !token}
      >
        {status === "loading" ? "접수 중..." : "상담 신청하기"}
      </Button>
    </form>
  );
}
