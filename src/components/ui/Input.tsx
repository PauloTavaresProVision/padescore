import { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      {...props}
      className={[
        "w-full rounded-lg border bg-slate-900 px-3.5 py-2.5 text-sm text-white",
        "placeholder:text-slate-500",
        "transition outline-none",
        invalid
          ? "border-red-500/50 focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
          : "border-slate-700/80 hover:border-slate-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      ].join(" ")}
    />
  );
});

export function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-200">
        {children}
      </label>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  help,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  help?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor} hint={hint}>
        {label}
      </Label>
      {children}
      {help && <p className="mt-1.5 text-xs text-slate-500">{help}</p>}
    </div>
  );
}
