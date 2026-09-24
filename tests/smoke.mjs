import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file=resolve(process.cwd(),"index.html");
const html=readFileSync(file,"utf8");

if(!html.includes("window.DevAnabel")) throw new Error("DevAnabel global ausente");
if(!html.includes('sandbox="allow-scripts"')) throw new Error("Sandbox ausente");
if(!html.includes('id="review"')||!html.includes('id="corrected-output"')) throw new Error("Painel de revisão ausente");
if(/AIza[0-9A-Za-z_-]{20,}|gsk_[0-9A-Za-z_-]{20,}/i.test(html)) throw new Error("Chave de API exposta no frontend");

const browser=await chromium.launch({headless:true,channel:"chrome"});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];
page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text())});
page.on("pageerror",e=>errors.push("pageerror: "+e.message));

const routes=[
  {
    pattern:"https://pt.wikipedia.org/**",
    contentType:"application/json",
    body:{pages:[{title:"Canvas",key:"Canvas",description:"This function is a reusable block of code.",content_urls:{desktop:{page:"https://pt.wikipedia.org/wiki/Canvas"}}}]}
  },
  {
    pattern:"https://api.stackexchange.com/**",
    contentType:"application/json",
    body:{items:[{title:"Como usar Canvas",link:"https://pt.stackoverflow.com/q/1",tags:["javascript","canvas"]}]}
  },
  {
    pattern:"https://api.github.com/search/repositories**",
    contentType:"application/json",
    body:{items:[{full_name:"test/canvas",html_url:"https://github.com/test/canvas",description:"Canvas test",stargazers_count:42}]}
  },
  {
    pattern:"https://raw.githubusercontent.com/**",
    contentType:"text/plain",
    body:"const remoto = 7;"
  },
  {
    pattern:"https://r.jina.ai/**",
    contentType:"text/plain",
    body:"# Tutorial\n\n```javascript\nconst resultado = 99;\nconsole.log(resultado);\n```"
  },
  {
    pattern:"https://dev-anabel.vercel.app/api/gemini",
    contentType:"application/json",
    body:{text:"Resposta remota de teste",provider:"gemini",model:"gemini-2.5-flash"}
  },
  {
    pattern:"https://api.mymemory.translated.net/**",
    contentType:"application/json",
    body:{responseData:{translatedText:"Uma função é um bloco reutilizável de código."}}
  }
];

for(const routeDef of routes){
  await page.route(routeDef.pattern,route=>route.fulfill({
    status:200,
    contentType:routeDef.contentType,
    body:typeof routeDef.body==="string"?routeDef.body:JSON.stringify(routeDef.body)
  }));
}

await page.goto("file://"+file+"?selftest=1");
await page.waitForTimeout(300);

const base=await page.evaluate(()=>({
  selftest:window.DevAnabel.state.history.find(x=>x.startsWith("SELFTEST:")),
  selftestFailures:window.DevAnabel.state.history.filter(x=>x.startsWith("SELFTEST FALHA:")),
  dom:!!document.querySelector("#editor"),
  mobileTabs:document.querySelectorAll(".tab").length,
  mobilePad:document.querySelectorAll(".pad").length,
  sandbox:document.querySelector("#sandbox").getAttribute("sandbox"),
  noLiteralSecrets:![...document.scripts].some(s=>/AIza[0-9A-Za-z_-]{20,}|gsk_[0-9A-Za-z_-]{20,}/i.test(s.textContent))
}));

if(!/^SELFTEST: (\d+)\/\1 verificações aprovadas\.$/.test(base.selftest||"")) throw new Error("Selftest falhou: "+base.selftest+" | "+base.selftestFailures.join(" | ")+" | browserErrors: "+errors.join(" || "));
if(base.mobileTabs!==3||base.mobilePad!==3||base.sandbox!=="allow-scripts"||!base.dom||!base.noLiteralSecrets) throw new Error("Estrutura básica inválida");
if(!html.includes('referrerpolicy="no-referrer"')||html.includes('sandbox="allow-scripts allow-same-origin"')||!html.includes("e.source!==sandbox.contentWindow")) throw new Error("Hardening do Sandbox ausente");

const aiSmoke=await page.evaluate(async()=>{
  await window.DevAnabel.answer("teste remoto da inteligência artificial");
  return window.DevAnabel.state.history.slice(-4);
});
if(!aiSmoke.some(x=>x.includes("ANABEL [GEMINI]: Resposta remota de teste"))) throw new Error("Gateway Gemini/Groq não foi chamado pelo frontend: "+JSON.stringify(aiSmoke));

const runtimeTest=await page.evaluate(()=>new Promise(resolve=>{
  const timer=setTimeout(()=>resolve({ok:false,text:"",src:document.querySelector("#sandbox").src}),4000);
  addEventListener("message",function handler(e){
    const d=e.data||{};
    if(d.source!=="dev-anabel-runtime"||d.type!=="log"||d.text!=="EXEC_OK")return;
    clearTimeout(timer);
    removeEventListener("message",handler);
    resolve({ok:true,text:d.text,src:document.querySelector("#sandbox").src});
  });
  window.DevAnabel.run('console.log("EXEC_OK");');
}));
if(!runtimeTest.ok||!runtimeTest.src.startsWith("blob:")) throw new Error("JavaScript puro não foi executado no Sandbox");
const mainExecuteButton=await page.evaluate(()=>{
  const e=document.querySelector("#editor");
  e.value='console.log("MAIN_BUTTON_OK");';
  e.dispatchEvent(new Event("input",{bubbles:true}));
  document.querySelector("#input").value="";
  document.querySelector("#send").click();
  return true;
});
await page.waitForTimeout(150);
const mainExecute=await page.evaluate(()=>({
  src:document.querySelector("#sandbox").src,
  history:window.DevAnabel.state.history.slice(-3)
}));
if(!mainExecute.src.startsWith("blob:")||!mainExecute.history.some(x=>x.includes("execução direta do código do editor"))) {
  throw new Error("Botão principal EXECUTAR não executou o código do editor: "+JSON.stringify(mainExecute));
}


const blobCleanup=await page.evaluate(()=>{
  const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
  let created=0,revoked=0;
  URL.createObjectURL=(blob)=>{created++;return originalCreate.call(URL,blob)};
  URL.revokeObjectURL=(url)=>{if(String(url).startsWith("blob:"))revoked++;return originalRevoke.call(URL,url)};
  window.DevAnabel.run('console.log("BLOB_1")');
  window.DevAnabel.run('console.log("BLOB_2")');
  URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;
  return {created,revoked};
});
if(blobCleanup.created<2||blobCleanup.revoked<1) throw new Error("Blob URL antigo não foi revogado: "+JSON.stringify(blobCleanup));

const pythonEditor=await page.evaluate(()=>{
  const e=document.querySelector("#editor");
  e.value="def soma(a, b):\n    return a + b\n\npri";
  e.selectionStart=e.selectionEnd=e.value.length;
  e.dispatchEvent(new Event("input",{bubbles:true}));
  const suggestionBox=document.querySelector("#autocomplete");
  const meta=document.querySelector("#editor-meta")?.textContent||"";
  e.dispatchEvent(new KeyboardEvent("keydown",{key:" ",code:"Space",ctrlKey:true,bubbles:true}));
  return {python:window.DevAnabel.intent("explique Python").type==="question",meta,suggestions:suggestionBox?.textContent||"",visible:suggestionBox?.classList.contains("show")};
});
if(!pythonEditor.python||!pythonEditor.meta.includes("PYTHON")||!pythonEditor.visible||!pythonEditor.suggestions.includes("print")) throw new Error("Autocomplete Python não foi inicializado corretamente");

const editorUx=await page.evaluate(async()=>{
  const e=document.querySelector("#editor");
  e.value=["linha1","linha2","linha3"].join(String.fromCharCode(10));
  e.selectionStart=e.selectionEnd=e.value.length;
  e.dispatchEvent(new Event("input",{bubbles:true}));
  await new Promise(r=>setTimeout(r,350));
  const lines=document.querySelector("#line-numbers")?.textContent||"";
  e.scrollTop=20;
  e.dispatchEvent(new Event("scroll",{bubbles:true}));
  const synced=document.querySelector("#line-numbers")?.scrollTop===e.scrollTop;
  e.value='const js = true;';
  e.dispatchEvent(new Event("input",{bubbles:true}));
  const hidden=!document.querySelector("#autocomplete")?.classList.contains("show");
  return {lines,synced,hidden,stored:localStorage.getItem("dev-anabel-session-v2")};
});
if(editorUx.lines!==["1","2","3"].join(String.fromCharCode(10))||!editorUx.synced||!editorUx.hidden||!editorUx.stored) throw new Error("UX do editor ou persistência falhou: "+JSON.stringify(editorUx));

const intent=await page.evaluate(()=>[
  window.DevAnabel.intent("analise meu codigo").type,
  window.DevAnabel.intent("como criar um jogo").type,
  window.DevAnabel.intent("Anabel quero uma dica de jogo de estrategia").type,
  window.DevAnabel.intent("https://example.com/x.html").type,
  window.DevAnabel.intent("me dê o código").type,
  window.DevAnabel.intent("crie space invaders").type,
  window.DevAnabel.intent("sim").type,
  window.DevAnabel.intent("corrija meu código").type,
  window.DevAnabel.intent("me dê ideias de melhoria").type
]);
if(JSON.stringify(intent)!==JSON.stringify(["analyze","question","ideas","url","generate","space","confirm","fix","improve"])) throw new Error("Roteamento de intenção inválido: "+JSON.stringify(intent));

const ref=await page.evaluate(async()=>{
  const e=document.querySelector("#editor");
  e.value='var x=1;\nconsole.log(x);\nconst f = function(a) { return a+1; };\nconst txt="var y";';
  const result=await window.DevAnabel.refactor();
  return {result,value:e.value};
});
if(ref.result.varCount!==1||ref.result.logCount!==1||ref.result.arrowCount!==1) throw new Error("Contagem da refatoração inválida");
if(!ref.value.includes("let x=1;")||ref.value.includes("console.log")||!ref.value.includes("const f = (a) => a+1;")||!ref.value.includes('const txt="var y"')) throw new Error("Refatoração produziu resultado incorreto");

const autoFix=await page.evaluate(async()=>{
  const e=document.querySelector("#editor");
  e.value='var x=1;\nconsole.log(x);\nconst f = function(a) { return a+1; };\nconst canvas=document.createElement("canvas");\nconst ctx=canvas.getContext("2d");\nasync function carregar(){\n  await Promise.resolve(1);\n}';
  const result=await window.DevAnabel.autoFixSystem();
  return {result,value:e.value,summary:document.querySelector("#review-summary")?.textContent||"",suggestions:[...document.querySelectorAll("#review-list li")].map(x=>x.textContent),history:window.DevAnabel.state.history.filter(x=>x.includes("Consertando")||x.includes("AUTO-FIX"))};
});
if(autoFix.result.applied.length<4) throw new Error("Auto-correção não aplicou a cadeia esperada: "+JSON.stringify(autoFix.result));
if(!autoFix.value.includes("let x=1;")||autoFix.value.includes("console.log(x);")||!autoFix.value.includes("const f = (a) => a+1;")||!autoFix.value.includes("try {")) {
  throw new Error("Auto-correção não produziu as correções esperadas: "+autoFix.value);
}
if(!autoFix.summary.includes("correção")||autoFix.suggestions.length<4||autoFix.history.length<5) {
  throw new Error("Feedback de auto-correção incompleto: "+JSON.stringify(autoFix));
}


await page.evaluate(()=>window.DevAnabel.undo());
const undone=await page.evaluate(()=>document.querySelector("#editor").value);
if(!undone.includes("var x=1;")||!undone.includes("console.log(x);")||!undone.includes('const f = function(a) { return a+1; };')||!undone.includes('const canvas=document.createElement("canvas");')||!undone.includes('const ctx=canvas.getContext("2d");')||!undone.includes("async function carregar()")) throw new Error("Undo falhou: "+undone);

await page.evaluate(()=>window.DevAnabel.analyze());
await page.locator("#input").fill("sim");
await page.locator("#send").click();
await page.waitForTimeout(150);
const approval=await page.evaluate(()=>({pending:window.DevAnabel.state.pendingAction,value:document.querySelector("#editor").value}));
if(approval.pending||approval.value.includes("var x=1;")||approval.value.includes("console.log")) throw new Error("Aprovação de correção falhou");

const review=await page.evaluate(()=>({
  summary:document.querySelector("#review-summary")?.textContent||"",
  suggestions:document.querySelectorAll("#review-list li").length,
  corrected:document.querySelector("#corrected-output")?.value||""
}));
if(review.suggestions<1||!review.corrected.includes("let x=1;")||review.corrected.includes("console.log")) {
  throw new Error("Painel de revisão não recebeu sugestões/código corrigido.");
}

await page.evaluate(()=>{
  const e=document.querySelector("#editor");
  e.value='var vida=3;\nconsole.log(vida);';
  document.querySelector("#input").value="/corrigir";
  document.querySelector("#send").click();
});
await page.waitForTimeout(150);
const fixed=await page.evaluate(()=>({
  editor:document.querySelector("#editor").value,
  output:document.querySelector("#corrected-output").value,
  suggestions:document.querySelectorAll("#review-list li").length
}));
if(fixed.editor!=="let vida=3;"||fixed.output!=="let vida=3;"||fixed.suggestions<1) {
  throw new Error("Comando /corrigir não entregou código corrigido e melhorias.");
}

await page.evaluate(()=>{
  const e=document.querySelector("#editor");
  e.value='const ctx=canvas.getContext("2d");\nfetch("/api");';
  document.querySelector("#input").value="/melhorar";
  document.querySelector("#send").click();
});
await page.waitForTimeout(150);
const improved=await page.evaluate(()=>({
  suggestions:[...document.querySelectorAll("#review-list li")].map(x=>x.textContent).join(" | "),
  output:document.querySelector("#corrected-output").value
}));
if(!improved.suggestions.includes("response.ok")||!improved.suggestions.includes("requestAnimationFrame")||improved.output!=='const ctx=canvas.getContext("2d");\nfetch("/api");') {
  throw new Error("Comando /melhorar não gerou sugestões contextuais.");
}

await page.evaluate(()=>window.DevAnabel.ideas("jogo estratégia 8-bit"));
await page.waitForTimeout(100);
const ideaState=await page.evaluate(()=>({count:window.DevAnabel.state.ideas.length,sources:window.DevAnabel.state.sourceList.length}));
if(ideaState.count!==5||ideaState.sources<3) throw new Error("Pesquisa/ideias falhou");

await page.evaluate(()=>window.DevAnabel.selectIdea(2));
const selected=await page.evaluate(()=>window.DevAnabel.state.selectedIdea?.title);
if(!selected) throw new Error("Seleção de ideia falhou");

await page.evaluate(()=>window.DevAnabel.generate());
const generated=await page.evaluate(()=>document.querySelector("#editor").value);
if(!generated.includes("<!doctype html>")||!generated.includes("REINO DOS 16 TURNOS")) throw new Error("Geração de jogo falhou");

await page.evaluate(() => window.DevAnabel.run(document.querySelector("#editor").value));
await page.locator("#sandbox").waitFor({state:"attached"});
const gameFrame=page.frameLocator("#sandbox");
await gameFrame.locator("h1").waitFor({state:"visible",timeout:5000});
const frameText=await gameFrame.locator("body").innerText();
if(!frameText.includes("REINO DOS 16 TURNOS")) throw new Error("Sandbox não executou o jogo");

await page.evaluate(async()=>{
  const input=document.querySelector("#file-input");
  const file=new File(["const anexado = 42;"],"teste.js",{type:"text/javascript"});
  const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));
});
await page.waitForTimeout(100);
const attached=await page.evaluate(()=>document.querySelector("#editor").value);
if(attached!=="const anexado = 42;") throw new Error("Anexação falhou");

await page.evaluate(async()=>{
  const input=document.querySelector("#file-input");
  const file=new File(["const quebrado = ;"],"erro.js",{type:"text/javascript"});
  const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));
});
await page.waitForTimeout(900);
const autoFile=await page.evaluate(()=>({
  history:window.DevAnabel.state.history.filter(x=>x.includes("GATILHO AUTÔNOMO")),
  candidates:window.DevAnabel.state.autonomous.candidateCount
}));
if(autoFile.history.length<1||autoFile.candidates<1) throw new Error("Gatilho autônomo de arquivo não disparou");

await page.evaluate(()=>window.DevAnabel.loadUrl("https://github.com/test/repo/blob/main/app.js"));
await page.waitForTimeout(100);
const remote=await page.evaluate(()=>document.querySelector("#editor").value);
if(remote!=="const remoto = 7;") throw new Error("URL mock não retornou o conteúdo esperado");

await page.evaluate(()=>window.DevAnabel.loadUrl("https://example.com/tutorial"));
await page.waitForTimeout(100);
const extracted=await page.evaluate(()=>({editor:document.querySelector("#editor").value,output:document.querySelector("#corrected-output").value,language:window.DevAnabel.state.language}));
if(extracted.editor!=="const resultado = 99;\nconsole.log(resultado);"||extracted.output!==extracted.editor||extracted.language!=="javascript") throw new Error("Leitura do site não extraiu e entregou o código");

const researchCode=await page.evaluate(()=>window.DevAnabel.intent("pesquise um exemplo de código de canvas").type);
if(researchCode!=="researchCode") throw new Error("Modo pesquisa + código não foi reconhecido");

await page.evaluate(()=>window.DevAnabel.autonomousSearch("canvas", "teste autônomo"));
await page.waitForTimeout(250);
const autonomous=await page.evaluate(()=>({
  code:document.querySelector("#editor").value,
  selected:window.DevAnabel.state.autonomous.selected,
  candidates:window.DevAnabel.state.autonomous.candidateCount,
  score:window.DevAnabel.state.autonomous.score
}));
if(autonomous.code!=="const resultado = 99;\nconsole.log(resultado);"||autonomous.candidates<1||!autonomous.selected||typeof autonomous.score!=="number") {
  throw new Error("Loop de busca autônoma não entregou o melhor candidato");
}

await page.evaluate(()=>window.DevAnabel.answer("explique um assunto totalmente desconhecido"));
await page.waitForTimeout(100);
const translated=await page.evaluate(()=>window.DevAnabel.state.history.some(x=>x.includes("Uma função é um bloco reutilizável")));
if(!translated) throw new Error("Rota de tradução não funcionou");

await page.setViewportSize({width:390,height:780});
const mobile=await page.evaluate(()=>{
  document.querySelector('[data-tab="1"]').click();
  const p=document.querySelector("#p1");
  return getComputedStyle(p).display;
});
if(mobile!=="flex") throw new Error("Layout mobile falhou");
await page.reload();
await page.waitForTimeout(150);
const restored=await page.evaluate(()=>({
  value:document.querySelector("#editor").value,
  status:document.querySelector("#status")?.textContent||"",
  lines:document.querySelector("#line-numbers")?.textContent||""
}));
if(restored.value!=="const js = true;"||!restored.status.includes("Sessão anterior recuperada")||restored.lines!=="1") {
  throw new Error("Persistência após F5 falhou: "+JSON.stringify(restored));
}


if(errors.length) throw new Error(errors.join("\n"));

await browser.close();
console.log("SMOKE PASS: todas as verificações concluídas.");
