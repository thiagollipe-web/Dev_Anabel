import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file=resolve(process.cwd(),"index.html");
const html=readFileSync(file,"utf8");

if(!html.includes("window.DevAnabel")) throw new Error("DevAnabel global ausente");
if(!html.includes('sandbox="allow-scripts"')) throw new Error("Sandbox ausente");
if(!html.includes('id="review"')||!html.includes('id="corrected-output"')) throw new Error("Painel de revisão ausente");
if(/openai|anthropic|gemini|ollama|qwen|gemma/i.test(html)) throw new Error("Dependência de LLM detectada");

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
  dom:!!document.querySelector("#editor"),
  mobileTabs:document.querySelectorAll(".tab").length,
  mobilePad:document.querySelectorAll(".pad").length,
  sandbox:document.querySelector("#sandbox").getAttribute("sandbox"),
  noLlm:![...document.scripts].some(s=>/openai|anthropic|gemini|ollama|qwen|gemma/i.test(s.textContent))
}));

if(base.selftest!=="SELFTEST: 19/19 verificações aprovadas.") throw new Error("Selftest falhou: "+base.selftest);
if(base.mobileTabs!==3||base.mobilePad!==3||base.sandbox!=="allow-scripts"||!base.dom||!base.noLlm) throw new Error("Estrutura básica inválida");

const runtimeTest=await page.evaluate(async()=>{
  window.DevAnabel.run('document.body.innerHTML="<h1 id="\'exec-ok\'">EXECUÇÃO OK</h1>"; console.log("EXEC_OK");');
  return new Promise(resolve=>{
    const frame=document.querySelector("#sandbox");
    frame.addEventListener("load",async()=>{
      const text=frame.contentDocument?.body?.innerText||"";
      resolve({text,src:frame.src});
    },{once:true});
  });
});
if(!runtimeTest.text.includes("EXECUÇÃO OK")||!runtimeTest.src.startsWith("blob:")) throw new Error("JavaScript puro não foi executado no Sandbox");

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

const ref=await page.evaluate(()=>{
  const e=document.querySelector("#editor");
  e.value='var x=1;\nconsole.log(x);\nconst f = function(a) { return a+1; };\nconst txt="var y";';
  const result=window.DevAnabel.refactor();
  return {result,value:e.value};
});
if(ref.result.varCount!==1||ref.result.logCount!==1||ref.result.arrowCount!==1) throw new Error("Contagem da refatoração inválida");
if(!ref.value.includes("let x=1;")||ref.value.includes("console.log")||!ref.value.includes("const f = (a) => a+1;")||!ref.value.includes('const txt="var y"')) throw new Error("Refatoração produziu resultado incorreto");

await page.evaluate(()=>window.DevAnabel.undo());
const undone=await page.evaluate(()=>document.querySelector("#editor").value);
if(undone!=='var x=1;\nconsole.log(x);\nconst f = function(a) { return a+1; };\nconst txt="var y";') throw new Error("Undo falhou");

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

await page.evaluate(()=>window.DevAnabel.loadUrl("https://github.com/test/repo/blob/main/app.js"));
await page.waitForTimeout(100);
const remote=await page.evaluate(()=>document.querySelector("#editor").value);
if(remote!=="const remoto = 7;") throw new Error("URL mock não retornou o conteúdo esperado");

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

if(errors.length) throw new Error(errors.join("\n"));

await browser.close();
console.log("SMOKE PASS: todas as verificações concluídas.");
