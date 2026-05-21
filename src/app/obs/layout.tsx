export default function ObsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* OBS Browser Source: fundo transparente para sobrepor à câmara */}
      <style>{`html, body { background: transparent !important; }`}</style>

      {/* Refresh automático via HTML para webviews onde o JS não corre
          (YoloBox e similares). Se JS estiver activo, o <script> abaixo
          remove esta meta tag IMEDIATAMENTE (durante a fase de parsing
          do HTML) e o reload é cancelado — passa a usar polling JS.
          Se o JS NÃO correr, a meta tag fica activa e o browser
          recarrega a página cada 3 segundos, trazendo o estado novo. */}
      <meta id="obs-refresh" httpEquiv="refresh" content="1" />
      <script
        dangerouslySetInnerHTML={{
          __html: "document.getElementById('obs-refresh')?.remove();",
        }}
      />
      {children}
    </>
  );
}
