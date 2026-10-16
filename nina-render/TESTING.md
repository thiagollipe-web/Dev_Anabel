# Estratégia de testes — NinaAI

Escopo: aplicação Node.js HTTP e interface HTML/CSS/JavaScript de `nina-render/`.
Frameworks: `node:test` para unidade/integração e Playwright com Chromium para interface.
Os testes usam credenciais locais fictícias e removem as chaves de LLM do processo.
Nunca execute testes destrutivos no serviço público ou com dados reais de estudantes.

## Como executar

Requer Node.js 22 ou superior e npm. Na raiz do repositório:

```bash
cd nina-render
npm install --ignore-scripts
npx playwright install chromium
npm test
npm run test:e2e
```

Em Linux, se faltarem bibliotecas do navegador, use `npx playwright install --with-deps chromium` em ambiente autorizado. Em Windows, `npx playwright install chromium` basta para instalar o navegador utilizado pela suíte. O servidor de teste utiliza uma porta efêmera e é encerrado ao final.

Opcional: `NINA_QA_CHROMIUM` seleciona um Chromium já instalado. A suíte usa um contexto novo por cenário; conversas e preferências de teste não entram no seu perfil pessoal.

## Casos e critérios de aceitação

| Área | Cenário positivo | Negativo / borda | Cobertura atual |
| --- | --- | --- | --- |
| Login | Credencial local abre o chat | Página e API sem sessão bloqueadas | Automatizada |
| Tema | Claro e escuro mudam as cores | Recarregar e alternar entre abas preserva/sincroniza preferência | Automatizada |
| Layout | Chat utilizável em 320, 390, 768 e 1440 px | Sem rolagem horizontal; Cancelar visível em tela pequena | Automatizada |
| Lateral | Abrir menu pelo botão | Escape fecha e atualiza atributos acessíveis | Automatizada |
| Atalhos | Preenchem o campo de mensagem | Não disparam requisição de chat | Automatizada |
| Texto | Campo cresce conforme conteúdo | Altura limitada com texto longo | Automatizada |
| Histórico | Conversa reaparece após recarga | Busca vazia não exclui registros; nova conversa não envia histórico anterior | Automatizada |
| Falha de API | Erro apresentado ao usuário | Preserva rascunho e reabilita envio | Automatizada |
| XSS de resposta | HTML aparece como texto | Nenhum elemento injetado ou evento executado | Automatizada; não equivale a pentest completo |
| JSON/HTTP | Corpo válido processado | null, array, primitivo, limite de bytes e URL malformada | Automatizada |
| Unicode | Texto preservado | Caractere UTF-8 dividido entre blocos de rede | Automatizada |
| Origem/CSP | Scripts recebem nonce | Origem externa e material inválido rejeitados | Automatizada |
| Concorrência/cache | Recurso disponível dentro da capacidade | Limites globais, por sessão e orçamento do cache | Automatizada em unidade |
| Notas | Média conferida sem LLM | Zero diferente de ausente; duplicata, nota inválida e fonte parcial recusadas | Automatizada |
| Escala de tabela | Todos os 1.800 alunos entram no cálculo | Sem amostragem ou corte silencioso | Automatizada |
| Modelo | Resposta completa aceita pelo fluxo | Saída truncada recusada | Automatizada no contrato do provedor |
| Intenção | Pedido real de notas reconhecido | Pergunta conceitual não deve exigir tabela | Automatizada; falso positivo corrigido |
| Anexos | CSV/XLSX, foto, PDF com texto/OCR | Arquivo corrompido, acima do limite, ZIP expandido e imagem muito grande | Roteiro a automatizar |
| Materiais | Baixar PPTX/DOCX/XLSX/PDF válidos | Arquivo vazio, tema errado e resposta de recusa não viram documento | Roteiro a automatizar |
| Áudio/vídeo | Transcrição de fixture licenciada conhecida | Acima de 120 s, sem fala e formato não decodificável | Roteiro a automatizar |
| PWA | Instalação no navegador compatível | Offline sem expor recursos protegidos | Verificação em aparelho real pendente |
| Acessibilidade | Navegar por teclado e leitor de tela | Foco preso, contraste insuficiente, zoom 200% | Verificação manual complementar pendente |

## Organização

- `test/grades.test.cjs`: cálculos e validação de tabelas.
- `test/http-safety.test.cjs`: limites, cache, concorrência e endereço do cliente.
- `test/server.test.cjs`: contratos HTTP reais e proteção do servidor.
- `test/intent-regression.test.cjs`: regressões do detector de intenção.
- `test/e2e/ui.test.cjs`: navegador real, autenticação, layout, temas, histórico e falhas.
- `.github/workflows/nina-qa.yml`: execução automática em push e pull request.

## Isolamento e limites da evidência

A suíte de interface usa o servidor real local para login, página, scripts, CSP e persistência IndexedDB. Apenas `/api/chat` é interceptado nos cenários que exigem resposta previsível ou erro de rede. Portanto, ela verifica a interface e o contexto enviado, mas não comprova a qualidade da LLM, disponibilidade do gateway ou failover real entre provedores.

Testes de carga devem ocorrer em ambiente isolado, com orçamento e concorrência limitados. Para materiais, adicionar fixtures sintéticas e verificar assinatura ZIP/PDF, XML interno, contagem de páginas/slides e valores de células, além de inspeção visual de amostras. Para OCR/transcrição, comparar com texto esperado usando tolerância definida; não usar dados pessoais.

## Regressões corrigidas na auditoria

- Perguntas conceituais sobre aprendizagem escolar não exigem planilha de notas.
- Nova conversa bloqueia o envio enquanto termina a persistência anterior.
- Erro ao salvar preserva o rascunho e o aviso de armazenamento.
- Navegação offline mostra aviso de conexão, sem cachear o chat privado.

Critério de liberação: testes afetados aprovados e ausência de novas falhas relevantes. Aprovação desta suíte não comprova desempenho de campo nem ausência total de defeitos.

## Resultado local

- 20 testes de unidade/integração aprovados.
- 9 cenários de interface aprovados em Chromium.
- Nenhuma regressão TODO nesta suíte.
- Exportações, OCR, mídia e carga prolongada não foram revalidados nesta execução.
