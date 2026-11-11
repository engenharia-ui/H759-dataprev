# H759-dataprev

Visualizador IFC do modelo estrutural H759 da DATAPREV, feito com Three.js e
Web-IFC. A página permite navegar pelo modelo, identificar elementos, medir
distâncias e aplicar planos de corte.

## Publicação

O visualizador e o arquivo `modelo.ifc` estão na raiz deste repositório. Para
publicá-los, em **Settings > Pages**, selecione **Deploy from a branch**, a
branch `main` e a pasta `/(root)`. Depois que o GitHub Pages concluir a
publicação, o site estará em:

<https://engenharia-ui.github.io/H759-dataprev/>

O endereço só funcionará após a publicação. O repositório e o GitHub Pages são
públicos: qualquer pessoa com o endereço do site também poderá baixar o IFC em
`https://engenharia-ui.github.io/H759-dataprev/modelo.ifc`. A configuração
`noindex` da página não restringe o acesso ao arquivo. Publique somente se a
divulgação do modelo estiver autorizada.

Para atualizar o modelo, substitua `modelo.ifc` mantendo o mesmo nome.

## Execução local

Sirva a raiz do projeto por HTTP, por exemplo com `python -m http.server 8000`,
e abra <http://localhost:8000/>. O visualizador carrega Three.js e Web-IFC de
CDNs externos; o navegador precisa oferecer suporte a WebGL e WebAssembly.

As medições representam distâncias entre pontos da malha e não substituem
cotas contratuais de projeto.