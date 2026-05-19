export function Card({
  className = "",
  children,
  as: As = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: React.ElementType;
}) {
  return (
    <As
      className={[
        "rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_1px_2px_rgba(16,24,40,0.04)]",
        className,
      ].join(" ")}
    >
      {children}
    </As>
  );
}

export function SectionTitle({
  children,
  hint,
  action,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-slate-900">{children}</h2>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Fieldset({
  legend,
  hint,
  children,
}: {
  legend: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/70 via-white to-white px-5 py-3.5">
        <div className="flex items-center gap-2 text-sm font-bold tracking-tight text-slate-900">
          <span className="h-4 w-1.5 rounded-full bg-gradient-to-b from-lime-400 to-emerald-500" />
          {legend}
        </div>
        {hint && <p className="mt-1 pl-3.5 text-xs text-slate-500">{hint}</p>}
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </fieldset>
  );
}
