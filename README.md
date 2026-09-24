# Dev_Anabel

Bot retrô de desenvolvimento e aprendizado, sem LLM.

## Funcionalidades

- Terminal CRT em Canvas.
- Editor de código.
- Runtime Python resiliente: tenta distribuição local, Pyodide 314.0.7 e fallback 0.29.5; a versão 314.0.7 continua fixada por estabilidade.
- Sessão local: código, linguagem e tema são salvos no `localStorage` e recuperados após recarga.
- Editor com linhas numeradas sincronizadas com o `textarea`.
- Sandbox isolado em iframe.
- Sandbox endurecido: `allow-scripts` sem `allow-same-origin`, `referrerpolicy="no-referrer"` e validação da origem das mensagens.
- Controles mobile via Pointer Events e postMessage.
- Pesquisa online com referências.
- Agente autônomo: analisa o objetivo, gera até 4 estratégias de busca, consulta GitHub + Stack Overflow + documentação em paralelo, lê candidatos e seleciona código por heurística de relevância, completude, modernidade e segurança.
- Gatilhos autônomos para erros do Sandbox e arquivos anexados com problemas detectáveis.
- Respostas técnicas em português simples.
- Dicas e exemplos.
- Ideias de jogos e seleção de proposta.
- Geração de protótipos HTML/Canvas.
- Refatoração local: var -> let, remoção de console.log() e Arrow Functions simples.
- Base de conhecimento de bugs com regras sintoma → correção.
- Motor de diagnóstico e auto-correção em cadeia, com limite de segurança e revisão dos sintomas restantes.
- `/corrigir` usa o motor de auto-correção e registra cada correção aplicada.
- Entrega autônoma do código selecionado diretamente no editor, com justificativa técnica e alternativas disponíveis na sessão.
- Histórico e desfazer.
- Anexação de arquivos textuais por seleção ou arrastar e soltar.
- Importação de URLs, incluindo links GitHub blob convertidos para raw.
- Exportação de código.
- Redimensionamento do terminal com debounce de 200 ms.
- Tema CRT verde e âmbar.

## Comandos

/ajuda
/pesquisar Canvas
/ideias jogo estratégia 8-bit
/analisar
/refatorar
/executar
/desfazer
/fontes

A linguagem natural também é aceita.

## Rede

A pesquisa usa APIs públicas acessíveis pelo navegador:
- Wikipedia em português
- Stack Overflow em português
- GitHub
- Documentação técnica (MDN e Python), incluindo busca online e referências oficiais curadas.

CORS continua sendo uma restrição do navegador. A Anabel informa quando uma fonte não permite leitura direta.

A tradução de pequenos trechos usa uma tentativa de serviço externo e possui fallback local.

## Teste

A URL `?selftest=1` executa verificações internas.

O repositório também possui testes automatizados via GitHub Actions.
