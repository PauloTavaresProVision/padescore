export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/*
        Garante que html/body são transparentes para o OBS renderizar
        apenas o scoreboard. Sobrepõe o bg do root layout.
      */}
      <style>{`html, body { background: transparent !important; }`}</style>
      {children}
    </>
  );
}
