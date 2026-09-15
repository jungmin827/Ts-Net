import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "outline";

const styles: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-dark disabled:bg-gray-300 disabled:text-gray-500",
  accent:
    "bg-accent text-white hover:brightness-95 disabled:bg-gray-300 disabled:text-gray-500",
  outline:
    "border border-brand text-brand hover:bg-brand/5 disabled:border-gray-300 disabled:text-gray-400",
};

export default function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center rounded-lg px-5 py-3 text-base font-bold transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
