export default function TotemDemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: #000;
          height: 100%;
        }
        body {
          font-family: Impact, "Arial Black", Arial, sans-serif;
        }
      `}</style>
      {children}
    </div>
  );
}
