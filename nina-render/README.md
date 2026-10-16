# Nina no Render

Serviço Node.js sem dependências: `node nina-render/server.cjs`. Usa `PORT` do ambiente e escuta em `0.0.0.0`.

## Configuração

No serviço nina-brittech, abra Environment e cadastre os segredos diretamente no painel:

- `MANDAPI_API_KEY`: chave da MandAPI.
- `MARITACA_API_KEY`: chave da MaritacaAI.
- `MANDAPI_MODEL`: `deepseek-v4-flash`.
- `MARITACA_MODEL`: `sabia-4`.

Endpoint principal: MandAPI Chat Completions. Em erro, tenta Maritaca. Nenhuma chave é entregue ao navegador ou incluída nos erros. `/health` expõe somente a presença das chaves. O serviço funciona sem elas, mas o chat remoto retorna 503.

## Memória

Histórico e trechos ensinados são guardados no localStorage do navegador. Busca lexical seleciona até quatro trechos para enviar ao provedor. Não existe sincronização entre dispositivos, treinamento dos pesos, banco vetorial nem importação da antiga base AIML do Termux nesta versão. A interface informa o envio dos trechos às APIs. Limpar os dados do navegador remove as memórias.

## Operação

GET `/` abre o chat; GET `/health` verifica o servidor; POST `/api/chat` recebe prompt, history e memories. Limites de corpo, histórico e saída, timeout por provedor e limite global por endereço de conexão reduzem uso excessivo. Atrás do proxy Render o limite pode ser compartilhado; ele não substitui autenticação individual nem quotas dos provedores.

Anabel e seu gateway Vercel permanecem separados. Esta pasta adiciona uma interface web Nina sem substituir o site existente.
