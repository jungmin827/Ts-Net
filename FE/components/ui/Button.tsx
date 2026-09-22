import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "outline" | "ghost" | "white";
type Size = "sm" | "md" | "lg";

// 눌림감: hover에서 살짝 뜨고(-translate-y) active에서 원위치로 내려앉는다.
// 그림자도 같이 커졌다 줄어들어야 "떠 있다"는 인상이 생긴다.
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-brand hover:bg-brand-dark hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 active:shadow-soft disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0",
  accent:
    "bg-accent text-white shadow-accent hover:bg-accent-dark hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 active:shadow-soft disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0",
  outline:
    "border border-line-strong bg-white text-brand shadow-soft hover:border-brand hover:bg-brand-soft hover:-translate-y-0.5 hover:shadow-card active:translate-y-0 disabled:border-line disabled:text-slate-400 disabled:shadow-none disabled:translate-y-0",
  ghost:
    "text-brand hover:bg-brand-light active:bg-brand-light/70 disabled:text-slate-400",
  white:
    "bg-white text-brand shadow-card hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 disabled:text-slate-400",
};

const SIZES: Record<Size, string> = {
  sm: "px-4 py-2 text-sm rounded-lg gap-1.5",
  md: "px-5 py-3 text-base rounded-xl gap-2",
  lg: "px-7 py-4 text-lg rounded-xl gap-2.5",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  className = "",
  children,
  disabled,
  ...props
}: Props) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex cursor-pointer items-center justify-center font-bold transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {loading && (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
