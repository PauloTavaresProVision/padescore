export default function TotemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Reset agressivo — esta página é fullscreen "kiosk" no browser. */}
      <style>{`
        html, body { margin: 0; padding: 0; overflow: hidden; background: #000; height: 100%; }
        body { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
      `}</style>
      {children}
    </>
  );
}
