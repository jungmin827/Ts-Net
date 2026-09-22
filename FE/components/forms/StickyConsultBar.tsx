"use client";

import { useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { PRODUCTS } from "@/lib/validation";
import { CONSENT, SITE } from "@/lib/site-config";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { fieldBase, selectBase } from "@/components/ui/Field";
import { formatPhone, useLeadSubmit } from "./useLeadSubmit";

/**
 * 화면 하단에 상시 고정되는 상담 신청 바.
 * 스크롤 위치와 무관하게 접수 수단이 항상 보이도록 하는, 이 업종의 핵심 전환 장치다.
 *
 * - 데스크톱: 한 줄 폼 (대표번호 / 관심상품 / 이름 / 연락처 / 필수동의 / 신청)
 * - 모바일: 전화·상담신청 2분할 → 상담신청을 누르면 시트가 올라오며 폼이 펼쳐진다
 *
 * 마케팅 수신 동의는 이 바에서 받지 않는다(항상 false).
 * 좁은 바에 두 동의를 욱여넣다 하나로 묶이는 사고를 원천 차단하기 위함이며,
 * 선택 동의까지 받으려면 본문 인라인 폼을 쓰면 된다. (CLAUDE.md 규칙 2)
 */

const COLLAPSE_KEY = "tsnet_consultbar_collapsed";

const barField =
  "w-full rounded-lg border border-transparent bg-white px-3 py-2.5 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-white focus:ring-4 focus:ring-white/25";

export default function StickyConsultBar() {
  const [product, setProduct] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [token, setToken] = useState("");
  const [honeypot, setHoneypot] = useState("");

  // Turnstile 은 사용자가 바를 건드린 뒤에만 띄운다.
  // 방문자 대부분은 바를 쓰지 않으므로 불필요한 위젯 로딩을 피하고,
  // 숨겨진 컨테이너에서 위젯이 렌더를 재시도하는 문제도 생기지 않는다.
  const [engaged, setEngaged] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [detail, setDetail] = useState(false);
  const tsRef = useRef<TurnstileInstance | null>(null);

  const { status, error, submit } = useLeadSubmit();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // 접기 상태는 세션 동안 유지 — 닫았는데 페이지마다 다시 뜨면 성가시다
  useEffect(() => {
    try {
      setCollapsed(sessionStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* 스토리지 차단 환경 — 기본값(펼침) 유지 */
    }
  }, []);

  function toggleCollapsed(next: boolean) {
    setCollapsed(next);
    try {
      sessionStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* 무시 */
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ok = await submit({
      name,
      phone,
      product: product || undefined,
      consent_privacy: privacy,
      consent_marketing: false,
      turnstileToken: token,
      website: honeypot,
    });
    if (ok) {
      setSheet(false);
      return;
    }
    setToken(""); // Turnstile 토큰은 1회용 — 실패 시 재발급
    tsRef.current?.reset();
  }

  const canSubmit = privacy && !!token && status !== "loading";

  /**
   * Turnstile 위젯은 이 컴포넌트를 통틀어 **딱 하나만** 마운트한다.
   * - 데스크톱 바와 모바일 바 마크업은 둘 다 DOM에 있고 CSS로만 숨겨지므로,
   *   양쪽에 각각 넣으면 숨겨진 쪽 위젯이 렌더를 무한 재시도해 메인 스레드를 먹는다.
   * - 바의 flex 행 안에 두면 폭을 차지해 입력칸을 좁히므로 고정 위치로 띄운다.
   * appearance=interaction-only 라 챌린지가 필요할 때만 실제로 보인다.
   */
  const turnstile = siteKey && engaged && (
    <div className="fixed right-4 bottom-24 z-50 lg:bottom-28">
      <Turnstile
        ref={tsRef}
        siteKey={siteKey}
        onSuccess={setToken}
        onExpire={() => setToken("")}
        options={{ appearance: "interaction-only" }}
      />
    </div>
  );

  const hiddenHoneypot = (
    <input
      type="text"
      name="website"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      value={honeypot}
      onChange={(e) => setHoneypot(e.target.value)}
      className="absolute -left-[9999px] h-0 w-0 opacity-0"
    />
  );

  // 접수 완료 — 폼 대신 확인 메시지를 같은 자리에 보여준다
  if (status === "done") {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-brand-deep">
        <div
          className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-4 text-white"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Icon name="check" size={18} />
          </span>
          <p className="text-sm font-bold sm:text-base">
            상담 신청이 접수되었습니다. 확인 후 순차적으로 연락드리겠습니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {turnstile}

      {/* ── 데스크톱: 한 줄 폼 ─────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 hidden lg:block">
        {collapsed ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => toggleCollapsed(false)}
              className="flex cursor-pointer items-center gap-2 rounded-t-xl bg-brand-deep px-6 py-2.5 text-sm font-bold text-white shadow-float transition-colors hover:bg-brand-dark"
            >
              <Icon name="chat" size={16} />
              빠른 상담 신청
              <Icon name="chevronDown" size={16} className="rotate-180" />
            </button>
          </div>
        ) : (
          <div className="border-t border-white/10 bg-brand-deep/95 shadow-float backdrop-blur-md">
            <form
              onSubmit={handleSubmit}
              onFocusCapture={() => setEngaged(true)}
              className="relative mx-auto flex max-w-6xl items-center gap-2.5 px-4 py-3"
            >
              <div className="flex shrink-0 items-center gap-2.5 pr-1 text-white">
                <span className="flex size-9 items-center justify-center rounded-xl bg-white/15">
                  <Icon name="phone" size={18} />
                </span>
                <span>
                  <span className="block text-[11px] leading-none text-white/60">
                    빠른 상담신청
                  </span>
                  <a
                    href={`tel:${SITE.tel}`}
                    className="block text-lg leading-tight font-black hover:underline"
                  >
                    {SITE.tel}
                  </a>
                </span>
              </div>

              <select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                aria-label="관심상품 선택"
                className={`${barField} w-36 cursor-pointer appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")] bg-[length:18px] bg-[position:right_0.6rem_center] bg-no-repeat pr-8`}
              >
                <option value="">관심상품</option>
                {PRODUCTS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              <input
                className={`${barField} w-28`}
                type="text"
                placeholder="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={20}
                autoComplete="name"
              />
              <input
                className={`${barField} w-40`}
                type="tel"
                inputMode="numeric"
                placeholder="연락처"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                required
                maxLength={13}
                autoComplete="tel"
              />

              {hiddenHoneypot}

              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-white/85">
                <input
                  type="checkbox"
                  checked={privacy}
                  onChange={(e) => setPrivacy(e.target.checked)}
                  className="size-4 cursor-pointer accent-accent"
                />
                <span>
                  <span className="font-bold text-accent">[필수]</span>{" "}
                  {CONSENT.privacyLabel}
                </span>
              </label>
              <button
                type="button"
                onClick={() => setDetail(true)}
                className="shrink-0 cursor-pointer text-xs text-white/55 underline underline-offset-2 hover:text-white"
              >
                자세히
              </button>

              <button
                type="submit"
                disabled={!canSubmit}
                className="ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-5 py-2.5 text-sm font-black text-white shadow-accent transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-dark active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/50 disabled:shadow-none"
              >
                {status === "loading" ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Icon name="chat" size={16} />
                )}
                상담 신청
              </button>

              <button
                type="button"
                onClick={() => toggleCollapsed(true)}
                aria-label="상담 바 접기"
                className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon name="chevronDown" size={18} />
              </button>
            </form>

            {error && (
              <p
                role="alert"
                className="border-t border-white/10 bg-red-500/15 px-4 py-2 text-center text-sm font-medium text-red-100"
              >
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── 모바일: 2분할 바 + 펼침 시트 ─────────────────────── */}
      <div className="lg:hidden">
        {sheet && (
          <div
            onClick={() => setSheet(false)}
            className="fixed inset-0 z-40 bg-slate-900/45"
            aria-hidden="true"
          />
        )}

        <div className="fixed inset-x-0 bottom-0 z-40">
          {sheet && (
            <div className="animate-slide-down max-h-[70vh] overflow-y-auto rounded-t-panel border-t border-line bg-white p-5 shadow-float">
              <div className="mb-4 flex items-center justify-between">
                <p className="flex items-center gap-2 text-lg font-black">
                  <Icon name="chat" size={20} className="text-brand" />
                  빠른 상담 신청
                </p>
                <button
                  type="button"
                  onClick={() => setSheet(false)}
                  aria-label="닫기"
                  className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-surface-muted hover:text-brand"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                onFocusCapture={() => setEngaged(true)}
                className="relative flex flex-col gap-3"
              >
                <select
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  aria-label="관심상품 선택"
                  className={selectBase}
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

                {hiddenHoneypot}

                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-white p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={privacy}
                    onChange={(e) => setPrivacy(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 cursor-pointer accent-brand"
                  />
                  <span>
                    <span className="mr-1 font-bold text-brand">[필수]</span>
                    {CONSENT.privacyInline}{" "}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setDetail(true);
                      }}
                      className="cursor-pointer underline underline-offset-2"
                    >
                      자세히
                    </button>
                  </span>
                </label>

                {error && (
                  <p
                    role="alert"
                    className="rounded-lg bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600"
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
                  disabled={!canSubmit}
                >
                  상담 신청하기
                </Button>
              </form>
            </div>
          )}

          <nav
            aria-label="빠른 상담"
            className="grid grid-cols-2 shadow-float"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <a
              href={`tel:${SITE.tel}`}
              className="flex items-center justify-center gap-2 bg-brand-deep py-4 font-bold text-white transition-colors active:bg-brand-dark"
            >
              <Icon name="phone" size={18} />
              전화 상담
            </a>
            <button
              type="button"
              onClick={() => {
                setSheet((v) => !v);
                setEngaged(true);
              }}
              aria-expanded={sheet}
              className="flex cursor-pointer items-center justify-center gap-2 bg-accent py-4 font-bold text-white transition-colors active:bg-accent-dark"
            >
              <Icon name="chat" size={18} />
              상담 신청
              <Icon
                name="chevronDown"
                size={16}
                className={`transition-transform duration-300 ${sheet ? "" : "rotate-180"}`}
              />
            </button>
          </nav>
        </div>
      </div>

      <Modal
        open={detail}
        onClose={() => setDetail(false)}
        title={CONSENT.privacyLabel}
      >
        <ul className="flex flex-col gap-3 text-sm leading-relaxed text-muted">
          {CONSENT.privacyDetail.map((d) => (
            <li key={d} className="flex gap-2.5">
              <Icon
                name="check"
                size={17}
                className="mt-0.5 shrink-0 text-brand"
              />
              {d}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
