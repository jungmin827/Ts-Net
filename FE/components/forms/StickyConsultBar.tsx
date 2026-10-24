"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { PRODUCTS, checkNamePhone } from "@/lib/validation";
import { CONSENT, SITE, hasTel } from "@/lib/site-config";
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

/*
 * 입력칸의 접근 가능한 이름은 `aria-label` 로 준다.
 *
 * placeholder 는 라벨이 아니다 — 한 글자만 입력해도 사라지므로, 그 뒤로는
 * 스크린리더도 음성입력도 이 칸이 무엇인지 알 수 없다. 같은 파일의 `select`
 * 두 개는 이미 `aria-label` 을 갖고 있었는데 입력 네 칸만 빠져 있었다.
 *
 * `LeadForm` 처럼 `sr-only` 라벨을 쓰지 않는 이유: 이 바는 한 줄 안에 칸을
 * 밀어 넣는 레이아웃이라 라벨 요소가 하나 늘 때마다 flex 계산이 흔들린다.
 * 보이는 라벨이 없는 자리에서는 `aria-label` 이 같은 일을 더 간단히 한다.
 *
 * 오류 안내는 폼 단위라 칸마다 `aria-invalid` 를 붙이지 않는다. 대신 오류
 * 문단이 `role="alert"` 이라 뜨는 즉시 읽힌다 (298·403행).
 */
const barField =
  "w-full rounded-lg border border-line-strong bg-white px-3 py-2.5 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-faint focus:border-brand focus:ring-4 focus:ring-brand/15";

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
  // 퍼스트뷰에는 이미 히어로 폼이 있다. 바가 처음부터 떠 있으면 히어로 하단을 가리고
  // 같은 요청을 두 번 하는 꼴이라, 히어로를 지나친 뒤에 올라온다
  const [visible, setVisible] = useState(false);
  const tsRef = useRef<TurnstileInstance | null>(null);
  /** 위젯·스크립트 실패 — 차단되면 토큰이 영영 안 오므로 "잠시 후" 대신 원인을 말한다 */
  const [tsFailed, setTsFailed] = useState(false);
  // 스크립트 주입 effect 가 이 객체를 의존성으로 본다 — 매 렌더 새 객체면 주입을 재시도한다
  const tsScriptOptions = useMemo(() => ({ onError: () => setTsFailed(true) }), []);

  const { status, error, submit, fail } = useLeadSubmit();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    const onScroll = () =>
      setVisible(window.scrollY > window.innerHeight * 0.72);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    // 주 CTA 를 회색으로 비활성화해 두지 않는다 — 이유를 알 수 없는 죽은 버튼이
    // 전 페이지 하단에 상시 노출되는 셈이 된다
    const missing = checkNamePhone(name, phone);
    if (missing) {
      fail(missing);
      return;
    }
    if (!privacy) {
      fail("개인정보 수집·이용에 동의해 주세요");
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

  /**
   * 바가 화면 밖으로 내려가 있을 때 붙는 클래스. 등장은 위로 밀려 올라오는 모션 한 번.
   *
   * ⚠ `transform` 은 요소를 접근성 트리에서 빼지 않는다. 클래스만으로 내려두면
   *   화면 상단에서 Tab 을 눌렀을 때 **화면 밖에 있는 입력칸·버튼 7개로 포커스가
   *   들어간다** — 키보드 사용자는 포커스가 어디에도 보이지 않는 상태가 된다
   *   (WCAG 2.4.3 / 2.4.7). 그래서 컨테이너에 `inert` 를 함께 건다.
   *   시트가 열려 있는 동안에는 걸지 않는다 — 열린 시트를 닫지 못하게 된다.
   */
  const shell = `transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
    visible ? "translate-y-0" : "translate-y-full"
  }`;

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
      <div
        inert={!visible}
        className={`fixed inset-x-0 bottom-0 z-40 hidden lg:block ${shell}`}
      >
        {collapsed ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => toggleCollapsed(false)}
              className="cta-fill flex cursor-pointer items-center gap-2 rounded-t-xl px-6 py-2.5 text-sm font-bold shadow-float transition-colors"
            >
              <Icon name="chat" size={16} />
              빠른 상담 신청
              <Icon name="chevronDown" size={16} className="rotate-180" />
            </button>
          </div>
        ) : (
          <div className="border-t-2 border-line bg-white/97 shadow-float backdrop-blur-md">
            <form
              onSubmit={handleSubmit}
              onFocusCapture={() => setEngaged(true)}
              className="relative mx-auto flex max-w-6xl items-center gap-2.5 px-4 py-3"
            >
              <div className="flex shrink-0 items-center gap-2.5 pr-1 text-foreground">
                {/* 대표번호가 없으면 수화기 아이콘은 거짓말이 된다 */}
                <span className="flex size-9 items-center justify-center rounded-xl bg-brand-light text-brand-deep">
                  <Icon name={hasTel() ? "phone" : "chat"} size={18} />
                </span>
                <span>
                  <span className="block text-[11px] leading-none text-muted">
                    빠른 상담신청
                  </span>
                  {hasTel() ? (
                    <a
                      href={`tel:${SITE.tel}`}
                      className="tabular block text-lg leading-tight font-black text-brand-deep hover:underline"
                    >
                      {SITE.tel}
                    </a>
                  ) : (
                    <span className="block text-lg leading-tight font-black text-brand-deep">
                      상담 신청
                    </span>
                  )}
                </span>
              </div>

              <select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                aria-label="관심상품 선택"
                className={`${barField} select-chevron-sm w-36 cursor-pointer appearance-none pr-8`}
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
                aria-label="이름"
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
                aria-label="연락처"
                placeholder="연락처"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                required
                maxLength={13}
                autoComplete="tel"
              />

              {hiddenHoneypot}

              <label
                className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-muted transition-shadow duration-200 ${
                  error && !privacy ? "ring-2 ring-red-500" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={privacy}
                  onChange={(e) => setPrivacy(e.target.checked)}
                  className="size-4 cursor-pointer accent-brand"
                />
                <span>
                  <span className="font-bold text-brand-dark">[필수]</span>{" "}
                  {CONSENT.privacyShort}
                </span>
              </label>
              <button
                type="button"
                onClick={() => setDetail(true)}
                className="shrink-0 cursor-pointer text-xs text-muted underline underline-offset-2 hover:text-brand-dark"
              >
                자세히
              </button>

              <button
                type="submit"
                disabled={status === "loading"}
                className="ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg cta-fill px-5 py-2.5 text-sm font-black shadow-cta transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:translate-y-0 disabled:cursor-wait"
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
                className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-brand-dark"
              >
                <Icon name="chevronDown" size={18} />
              </button>
            </form>

            {error && (
              <p
                role="alert"
                className="bg-red-600 px-4 py-2 text-center text-sm font-bold text-white"
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
            className="fixed inset-0 z-40 bg-brand-deep/45"
            aria-hidden="true"
          />
        )}

        <div
          inert={!visible && !sheet}
          className={`fixed inset-x-0 bottom-0 z-40 ${shell}`}
        >
          {sheet && (
            <div className="animate-slide-down max-h-[70vh] overflow-y-auto rounded-t-panel border-t border-line bg-white p-5 shadow-float">
              <div className="mb-4 flex items-center justify-between">
                <p className="flex items-center gap-2 text-lg font-black">
                  <Icon name="chat" size={20} className="text-brand-dark" />
                  빠른 상담 신청
                </p>
                <button
                  type="button"
                  onClick={() => setSheet(false)}
                  aria-label="닫기"
                  className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-faint transition-colors hover:bg-surface-muted hover:text-brand-dark"
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
                  <option value="">관심상품 선택</option>
                  {PRODUCTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <input
                  className={fieldBase}
                  type="text"
                  aria-label="이름"
                  placeholder="이름을 입력해주세요."
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
                  aria-label="연락처"
                  placeholder="연락처를 입력해주세요."
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
                    <span className="mr-1 font-bold text-brand-dark">[필수]</span>
                    {CONSENT.privacyLabel}{" "}
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
                  variant="cta"
                  size="lg"
                  fullWidth
                  loading={status === "loading"}
                >
                  상담 신청하기
                </Button>
              </form>
            </div>
          )}

          <nav
            aria-label="빠른 상담"
            className={`grid shadow-float ${hasTel() ? "grid-cols-2" : "grid-cols-1"}`}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {hasTel() && (
              <a
                href={`tel:${SITE.tel}`}
                className="flex items-center justify-center gap-2 border-t-2 border-line bg-white py-4 font-black text-brand-deep transition-colors active:bg-surface-muted"
              >
                <Icon name="phone" size={18} />
                전화 상담
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                setSheet((v) => !v);
                setEngaged(true);
              }}
              aria-expanded={sheet}
              className="cta-fill flex cursor-pointer items-center justify-center gap-2 py-4 font-bold transition-colors"
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
        title={CONSENT.privacyShort}
      >
        {/* 항목이 ①②③④ 로 번호를 가지므로 체크 아이콘을 덧붙이지 않는다 */}
        <ul className="flex flex-col gap-3 text-sm leading-relaxed text-muted">
          {CONSENT.privacyDetail.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
