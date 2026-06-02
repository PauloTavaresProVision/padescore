import { Barlow_Condensed } from "next/font/google";

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-totem",
});

export default function TotemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={barlow.variable}>
      <style>{`
        html, body { margin: 0; padding: 0; overflow: hidden; background: #000; height: 100%; }
        body { font-family: var(--font-totem), Arial, sans-serif; }
      `}</style>
      {children}
    </div>
  );
}
