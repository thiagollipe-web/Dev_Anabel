# Nina — Brittech inc

Serviço Node sem dependências de instalação. Execute `node nina-render/server.cjs`; configure `NINA_LOGIN`, `NINA_PASSWORD` e as chaves dos provedores no ambiente. Nunca coloque segredos no repositório.

## Verificação

`node --test nina-render/test/*.test.cjs`

A CI executa os contratos e cálculos de notas sem chamar LLMs nem usar chaves reais. Testes de navegador também devem verificar migração IndexedDB, exportação, leitura XLSX em worker, áudio, cancelamento e logout.

## Segurança e limites

- APIs protegidas por sessão opaca, cookie HttpOnly/Secure/SameSite e verificação de origem.
- Sessões atuais ficam em memória: reiniciar o serviço exige novo login. O acesso configurado é uma conta única; Nins são perfis locais, não usuários independentes. Não executar múltiplas réplicas sem armazenamento compartilhado de sessões e identidade por usuário.
- Limites de tamanho em stream, concorrência global e por sessão, cancelamento do provedor ao desconectar e recusa de resposta truncada.
- CSP com nonce para scripts inline. Bibliotecas principais têm URLs fixas e SHA-256 verificado no servidor. O leitor XLSX usa ExcelJS 4.4.0 e roda em worker encerrado após 45 segundos.
- `TRUST_RENDER_EDGE=1` só pode ser usado no ingresso Render/Cloudflare: aceita `CF-Connecting-IP` válido de peer privado. Nunca habilitar ao expor o Node diretamente à internet.
- Conversas e texto dos anexos ficam no IndexedDB deste aparelho. A migração apaga cópias legadas redundantes apenas após a transação concluir; não recupera mensagens que versões antigas já descartaram. Escritas concorrentes em abas são rejeitadas por revisão.
- Limpeza no logout é opcional e explícita. Quem desmarca mantém os dados no aparelho. Não há criptografia do histórico local ou sincronização entre dispositivos.

## Notas de alunos

O cálculo é determinístico e usa tabelas CSV/XLSX com colunas reconhecidas (Aluno/Nome e Nota/Média/Bimestre). Ausentes não viram zero. Notas inválidas, duplicatas na mesma tabela e fontes parciais são recusadas. Transferidos/remanejados só são excluídos quando essa situação consta explicitamente na tabela. Grupos e bimestres são calculados separadamente, sem médias globais entre disciplinas.

O PDF mantém leitura/OCR, mas não se adivinha uma tabela quantitativa a partir de texto achatado. Para cálculos, use uma tabela estruturada conferida. A LLM não determina as médias nem inventa causas de desempenho. PPTs de notas incorporam gráficos e tabelas dos dados; não usam fotos genéricas.

## Mídia

Fotos até 12 MP após validação de cabeçalho. Fala até 120 segundos; arquivos maiores precisam ser recortados antes de decodificar. Vídeo usa quadros amostrados e não equivale a entendimento contínuo. A precisão de OCR, reconhecimento de fala e interpretação de imagens continua probabilística.
