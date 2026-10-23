import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "icon";
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-violet-500 text-white shadow-[0_5px_22px_rgba(128,107,255,.22)] hover:bg-violet-400",
  secondary: "border border-white/10 bg-white/[.045] text-slate-200 hover:bg-white/[.09]",
  ghost: "text-slate-400 hover:bg-white/[.07] hover:text-white",
  danger: "text-rose-300 hover:bg-rose-400/10",
};

const sizes = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  icon: "h-9 w-9 rounded-xl",
};

export function Button({ variant = "ghost", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
