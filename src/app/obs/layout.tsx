export default function ObsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* OBS Browser Source: fundo transparente para sobrepor à câmara */}
      <style>{`html, body { background: transparent !important; }`}</style>
      {children}
    </>
  );
}
