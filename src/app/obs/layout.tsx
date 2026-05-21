export default function ObsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* OBS Browser Source: fundo transparente para sobrepor à câmara */}
      <style>{`html, body { background: transparent !important; }`}</style>

      {/* Polling em VANILLA JS — substitui o conteúdo do #sb-mount pelo
          HTML novo a cada 1s. Confirmou-se que o webview do YoloBox
          executa JS deste tipo (provisionpadel.vercel.app/broadcast usa
          o mesmo padrão e funciona). Vantagens vs meta-refresh:
          - Sem flicker (só o scoreboard pisca, não a página toda)
          - Updates a cada 1s sem reload da página
          - DOM estável, animações CSS continuam */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){
            function poll(){
              fetch(window.location.href, {cache:'no-store'})
                .then(function(r){return r.text();})
                .then(function(html){
                  var parser = new DOMParser();
                  var doc = parser.parseFromString(html, 'text/html');
                  var newMount = doc.getElementById('sb-mount');
                  var oldMount = document.getElementById('sb-mount');
                  if (newMount && oldMount) {
                    oldMount.innerHTML = newMount.innerHTML;
                  }
                })
                .catch(function(){});
            }
            setInterval(poll, 1000);
          })();`,
        }}
      />
      {children}
    </>
  );
}
