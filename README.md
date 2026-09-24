# Dev_Anabel

Bot retrô de desenvolvimento e aprendizado, sem LLM.

## Funcionalidades

- Terminal CRT em Canvas.
- Editor de código.
- Sandbox isolado em iframe.
- Controles mobile via Pointer Events e postMessage.
- Pesquisa online com referências.
- Respostas técnicas em português simples.
- Dicas e exemplos.
- Ideias de jogos e seleção de proposta.
- Geração de protótipos HTML/Canvas.
- Refatoração local: var -> let, remoção de console.log() e Arrow Functions simples.
- Histórico e desfazer.
- Anexação de arquivos textuais por seleção ou arrastar e soltar.
- Importação de URLs, incluindo links GitHub blob convertidos para raw.
- Exportação de código.
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

CORS continua sendo uma restrição do navegador. A Anabel informa quando uma fonte não permite leitura direta.

A tradução de pequenos trechos usa uma tentativa de serviço externo e possui fallback local.

## Teste

A URL `?selftest=1` executa verificações internas.

O repositório também possui testes automatizados via GitHub Actions.
