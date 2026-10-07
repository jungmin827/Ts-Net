import { CONSENT, PRIVACY_PROMISE } from "@/lib/site-config";
import Icon, { type IconName } from "@/components/ui/Icon";
import SectionHeading from "@/components/ui/SectionHeading";

/**
 * 개인정보 처리 안내.
 *
 * 이 사이트가 방문자에게 요구하는 것은 결국 연락처 하나다. 그걸 어떻게 다루는지를
 * 약관 모달 안에만 두지 않고 본문에 꺼내 놓는다. 레퍼런스 사이트에 없는 자리이고,
 * 우리는 실제로 구현해 둔 것이라 적을 수 있다 (근거는 `PRIVACY_PROMISE` 주석).
 *
 * 하단 고지는 폼의 동의 문구(`CONSENT.privacyDetail`)를 **그대로** 다시 보여준다.
 * 같은 사실을 두 군데에서 다른 문장으로 쓰면 둘 중 하나는 반드시 낡는다.
 */
export default function PrivacyPromise() {
  if (PRIVACY_PROMISE.points.length === 0) return null;

  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-5xl px-4">
        <SectionHeading
          eyebrow={PRIVACY_PROMISE.eyebrow}
          title={PRIVACY_PROMISE.title}
          description={PRIVACY_PROMISE.sub}
        />

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRIVACY_PROMISE.points.map((p) => (
            <li
              key={p.title}
              className="rounded-card border border-line bg-white p-5"
            >
              {/* 초록은 아이콘 타일 하나까지만. 카드 면까지 틴트로 깔면
                  여섯 장이 모여 큰 색면이 된다 */}
              <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-brand-light text-brand-deep">
                <Icon name={p.icon as IconName} size={20} />
              </span>
              <h3 className="mb-1.5 text-[0.95rem] leading-snug font-bold text-foreground">
                {p.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted">{p.desc}</p>
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-card border border-line bg-surface-muted p-5 md:p-6">
          <h3 className="text-sm font-black text-foreground">
            {PRIVACY_PROMISE.noticeTitle}
          </h3>
          <ul className="mt-3 flex flex-col gap-1.5">
            {CONSENT.privacyDetail.map((d) => (
              <li
                key={d}
                className="text-[11px] leading-relaxed text-muted md:text-xs"
              >
                {d}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
