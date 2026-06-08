import { Bebas_Neue } from "next/font/google";

const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-cavalete-display",
});

export default function CavaleteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={bebas.variable}>
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: #000;
          height: 100%;
        }
        body {
          font-family: var(--font-cavalete-display), "Bebas Neue", "Anton",
            Impact, "Arial Black", Arial, sans-serif;
        }
      `}</style>
      {children}
    </div>
  );
}
