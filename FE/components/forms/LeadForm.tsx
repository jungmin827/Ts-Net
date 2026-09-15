"use client";

import { useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { CARRIERS, PRODUCTS, type Carrier } from "@/lib/validation";
import { CARRIER_MENU } from "@/lib/site-config";
import Button from "@/components/ui/Button";

// 상담 접수 폼 — /api/leads 로 POST.
// variant "full": 통신사+관심상품 포함(랜딩 인라인), "compact": 관심상품+이름+연락처(플로팅 퀵상담)

interface Props {
  variant?: "full" | "compact";
  defaultCarrier?: Carrier;
}

interface Tracking {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  landing_path?: string;
  referrer?: string;
}

const UTM_KEY = "tsnet_utm";

/** 최초 진입 시점의 UTM을 세션에 고정해 폼 위치와 무관하게 유입경로를 보존 */
function collectTracking(): Tracking {
  if (typeof window === "undefined") return {};
  try {
    const saved = sessionStorage.getItem(UTM_KEY);
    if (saved) return JSON.parse(saved) as Tracking;
    const sp = new URLSearchParams(window.location.search);
    const t: Tracking = {
      utm_source: sp.get("utm_source") ?? undefined,
      utm_medium: sp.get("utm_medium") ?? undefined,
      utm_campaign: sp.get("utm_campaign") ?? undefined,
      utm_content: sp.get("utm_content") ?? undefined,
      landing_path: window.location.pathname + window.location.search,
      referrer: document.referrer || undefined,
    };
    sessionStorage.setItem(UTM_KEY, JSON.stringify(t));
    return t;
  } catch {
    return {};
  }
}

/** 접수 성공 시 전환 이벤트 발화. 스크립트 미설치 환경에서는 조용히 무시 */
function fireConversion() {
  const w = window as unknown as Record<string, ((...args: unknown[]) => void) | undefined>;
  w.gtag?.("event", "generate_lead");
  w.fbq?.("track", "Lead");
  // TODO: 네이버·카카오 픽셀은 트래킹 스크립트 도입 시 함께 연결
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-4 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export default function LeadForm({ variant = "full", defaultCarrier }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [carrier, setCarrier] = useState<string>(defaultCarrier ?? "");
  const [product, setProduct] = useState<string>("");
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");
  const tsRef = useRef<TurnstileInstance | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "loading") return;
    setError("");
    setStatus("loading");

    // honeypot — 사람 눈에 안 보이는 필드. 봇이 채우면 서버가 조용히 폐기
    const honeypot =
      (new FormData(e.currentTarget).get("website") as string) ?? "";

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          carrier: carrier || undefined,
          product: product || undefined,
          consent_privacy: consentPrivacy,
          consent_marketing: consentMarketing,
          turnstileToken: token,
          website: honeypot,
          ...collectTracking(),
        }),
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (res.ok && data.ok) {
        fireConversion();
        setStatus("done");
        return;
      }
      setError(data.error ?? "접수에 실패했습니다. 잠시 후 다시 시도해 주세요");
    } catch {
      setError("네트워크 오류입니다. 잠시 후 다시 시도해 주세요");
    }
    setStatus("idle");
    setToken("");
    tsRef.current?.reset(); // Turnstile 토큰은 1회용 — 실패 시 재발급
  }

  if (status === "done") {
    return (
      <div className="rounded-xl bg-brand/5 p-8 text-center">
        <p className="text-xl font-bold text-brand">상담 신청이 접수되었습니다</p>
        <p className="mt-2 text-sm text-gray-600">
          확인 후 순차적으로 연락드리겠습니다
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="relative flex flex-col gap-3">
      {variant === "full" && (
        <select
          className={inputCls}
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
        className={inputCls}
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
        className={inputCls}
        type="text"
        placeholder="이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={20}
        autoComplete="name"
      />
      <input
        className={inputCls}
        type="tel"
        placeholder="연락처 (010-0000-0000)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
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
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={consentPrivacy}
          onChange={(e) => setConsentPrivacy(e.target.checked)}
          className="mt-0.5 size-4 accent-brand"
        />
        <span>
          [필수] 개인정보 수집·이용 동의 — 이름·연락처를 상담 목적으로 수집하며
          2년 보관 후 파기합니다
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm text-gray-500">
        <input
          type="checkbox"
          checked={consentMarketing}
          onChange={(e) => setConsentMarketing(e.target.checked)}
          className="mt-0.5 size-4 accent-brand"
        />
        <span>[선택] 마케팅 정보 수신 동의</span>
      </label>

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

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <Button
        type="submit"
        variant="accent"
        disabled={!consentPrivacy || !token || status === "loading"}
      >
        {status === "loading" ? "접수 중..." : "상담 신청하기"}
      </Button>
    </form>
  );
}
