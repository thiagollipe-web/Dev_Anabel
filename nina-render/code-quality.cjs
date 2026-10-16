'use strict';
// Bounded static checks. These checks never run generated code or certify safety.
const POLICY=`Para pedidos de programação, entregue uma implementação coerente com o escopo solicitado. Quando o usuário pedir projeto completo, forneça todos os arquivos necessários, dependências, configuração, ponto de entrada e testes. Não substitua integração real por mock/stub, exceto se solicitado. Separe nomes de arquivos da área de código: use cabeçalho ### caminho/arquivo.ext e um bloco da linguagem correta para cada arquivo. Não coloque saídas de terminal em blocos Python. Confira imports, funções definidas, assinaturas e chamadas. No YAML, não use o prefixo Python r antes de strings de regex. Normalize padrões e entradas de forma compatível; preserve o nome original do usuário. Templates devem refletir o estado real da sessão. Implemente e aplique a expiração e o limite de histórico se prometidos. Testes devem aceitar as respostas válidas e controlar aleatoriedade. Não apresente filtros de palavras como garantia contra prompt injection. Separe dados de instruções, minimize PII em logs e não ofereça execução de comandos no servidor. Grounding exige fontes realmente disponíveis, não citações inventadas. Se usar regras próprias, descreva como inspirado em A.L.I.C.E.; só afirme compatibilidade AIML quando implementada. Nunca afirme ter executado, testado, aprovado ou certificado código nesta conversa. Não há execução de código nem ambiente de testes para a resposta gerada. Diferencie código proposto, revisão estática limitada e testes fornecidos para o usuário executar. Não altere o assunto para as regras desta instrução.`;
function isCodeRequest(prompt){return typeof prompt==='string'&&/\b(?:c[oó]digo|python|javascript|typescript|node\.?js|aiml|pytest|programa[çc][aã]o|software|api|regex|html|css|java|rust|golang|go|ruby|php|swift|kotlin|lua|dart|sql|typescript|elixir|csharp|cpp)\b/i.test(prompt)&&/\b(?:cri\w*|corr\w*|implement\w*|projet\w*|bot|fun[çc][aã]o|program\w*|refator\w*|test\w*|c[oó]digo)\b/i.test(prompt);}
function blocks(text){const found=[];let current=null;for(const line of text.split(/\r?\n/)){if(!current){const m=/^\s*(`{3,}|~{3,})([^\r\n]*)$/.exec(line);if(m)current={fence:m[1],lang:m[2].trim().toLowerCase(),lines:[]};}else if(new RegExp('^\\s*'+current.fence[0]+'{'+current.fence.length+',}\\s*$').test(line)){found.push({lang:current.lang,code:current.lines.join('\n')});current=null;}else current.lines.push(line);}return {found,unclosed:Boolean(current)};}
function inspect(text,prompt=''){
 if(typeof text!=='string'||!text.trim())return ['empty_response'];
 const {found,unclosed}=blocks(text),issues=[];
 if(unclosed)issues.push('unclosed_code_fence');
 const py=found.filter(b=>/^python\b|^py$/.test(b.lang)).map(b=>b.code).join('\n');
 const yaml=found.filter(b=>/^ya?ml\b/.test(b.lang)).map(b=>b.code).join('\n');
 if(/^\s*(?:-\s*)?regex:\s*r["']/m.test(yaml))issues.push('python_raw_prefix_in_yaml');
 if(/^\s*[\w./-]+\.py\s+[—–]\s/m.test(py))issues.push('filename_prose_inside_python');
 if(/def\s+render_template\(\s*templates_list\s*,\s*kwargs\s*\)/.test(py)&&/render_template\([\s\S]{0,500}?\buser_name\s*=/.test(py))issues.push('template_signature_mismatch');
 if(/from\s+fallback_llm\s+import\s+llm_fallback\b/.test(py)&&/def\s+call_with_guardrails\(/.test(py)&&!/(?:class\s+llm_fallback\b|^llm_fallback\s*=)/m.test(py))issues.push('fallback_import_mismatch');
 if(/unicodedata\.normalize/.test(py)&&/unicodedata\.combining/.test(py)&&/^\s*(?:-\s*)?regex:.*[áéíóúãõç]/mi.test(yaml))issues.push('accent_normalization_mismatch');
 if(/def\s+is_expired\(/.test(py)&&/def\s+process_turn\(/.test(py)&&(py.match(/\bis_expired\s*\(/g)||[]).length===1)issues.push('unused_session_expiry');
 if(/def\s+sanitize_input\(/.test(py)&&/def\s+process_turn\(/.test(py)&&(py.match(/\bsanitize_input\s*\(/g)||[]).length===1)issues.push('unused_input_validation');
 const complete=/complet|reprodut[ií]vel|todos os arquivos/i.test(prompt),mockAllowed=/\bmock|simulad|stub/i.test(prompt);
 if(complete&&/projeto|artefato|implementa/i.test(prompt)&&found.length===0)issues.push('missing_implementation');
 if(complete&&/aiml|alice|bot/i.test(prompt)){for(const m of py.matchAll(/from\s+(?:matcher|preprocess|templates|fallback_llm|state)\s+import\s+(\w+)/g)){const symbol=m[1];if(!new RegExp('(?:def|class)\\s+'+symbol+'\\b|^'+symbol+'\\s*=','m').test(py))issues.push('missing_local_symbol:'+symbol);}}
 if(complete&&!mockAllowed&&/resposta simulada|configure sua API aqui|substituir por chamada a API/i.test(py))issues.push('mock_instead_of_requested_integration');
 if(/random\.choice/.test(py)&&!/random\.seed|Random\(|monkeypatch|mock\.patch|rng\s*=/.test(py)&&/assert\s+["'](?:Olá|Até logo)["']\s+in\s+process_turn/.test(py))issues.push('random_templates_with_fixed_assertions');
 // Positive execution claims only; quotations inside code are not evidence claims.
 const prose=text.replace(/(^\s*(`{3,}|~{3,})[^\n]*\n)[\s\S]*?^\s*\2\s*$/gm,'');
 for(const m of prose.matchAll(/\b(?:todos (?:os )?testes (?:passaram|foram aprovados)|(?:executei|rodei|testei|validei) (?:o |os |este |todos )?(?:c[oó]digo|testes|projeto)|testes executados com sucesso)\b/gi)){if(!/\bn[aã]o\s*$/i.test(prose.slice(Math.max(0,m.index-12),m.index)))issues.push('unsupported_execution_claim');}
 return [...new Set(issues)];
}
async function review(result,messages,{prompt,generate,options}){
 const issues=inspect(result.text,prompt);let final=result,repaired=false;
 if(issues.length){const repairMessages=[...messages,{role:'assistant',content:result.text},{role:'system',content:POLICY+'\nA verificação estática encontrou os seguintes sinais de inconsistência: '+JSON.stringify(issues)+'. Reescreva a resposta completa corrigindo-os. Isso não significa que testes tenham sido executados. Preserve o pedido original.'}];const repairedResult=await generate(repairMessages,options);if(!repairedResult)return {ok:false,issues};final=repairedResult;repaired=true;}
 const remaining=inspect(final.text,prompt);if(remaining.length)return {ok:false,issues:remaining};
 return {ok:true,result:{...final,text:final.text+'\n\nVerificação nesta conversa: revisão estática limitada. O código e os testes fornecidos não foram executados.',quality:{scope:'static_limited',executed:false,repaired}}};
}
module.exports={POLICY,isCodeRequest,inspect,review,blocks};
