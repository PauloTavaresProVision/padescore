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
        "rounded-2xl border border-slate-800/80 bg-slate-900/40 shadow-xl shadow-black/20 backdrop-blur",
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
        <h2 className="text-base font-semibold tracking-tight text-white">{children}</h2>
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
    <fieldset className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-5">
      <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {legend}
      </legend>
      {hint && <p className="-mt-1 mb-4 px-2 text-xs text-slate-500">{hint}</p>}
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}
