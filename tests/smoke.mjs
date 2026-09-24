import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file=resolve(process.cwd(),"index.html");
const html=readFileSync(file,"utf8");

if(!html.includes("window.DevAnabel")) throw new Error("DevAnabel global ausente");
if(!html.includes('sandbox="allow-scripts"')) throw new Error("Sandbox ausente");
if(/openai|anthropic|gemini|ollama|qwen|gemma/i.test(html)) throw new Error("Dependência de LLM detectada");

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];
page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text())});
page.on("pageerror",e=>errors.push("pageerror: "+e.message));

const routes=[
  ["https://pt.wikipedia.org/**",{pages:[{title:"Canvas",key:"Canvas",description:"Área de desenho do navegador",content_urls:{desktop:{page:"https://pt.wikipedia.org/wiki/Canvas"}}]}],
  ["https://api.stackexchange.com/**",{items:[{title:"Como usar Canvas",link:"https://pt.stackoverflow.com/q/1",tags:["javascript","canvas"]}]}],
  ["https://api.github.com/search/repositories**",{items:[{full_name:"test/canvas",html_url:"https://github.com/test/canvas",description:"Canvas test",stargazers_count:42}]}],
  ["https://raw.githubusercontent.com/**",{body:"const remoto = 7;"}],
  ["https://api.mymemory.translated.net/**",{responseData:{translatedText:"Uma função é um bloco reutilizável de código."}}]
];

for(const [pattern,json] of routes){
  await page.route(pattern,route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(json)}));
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

if(base.selftest!=="SELFTEST: 17/17 verificações aprovadas.") throw new Error("Selftest falhou: "+base.selftest);
if(base.mobileTabs!==3||base.mobilePad!==3||base.sandbox!=="allow-scripts"||!base.dom||!base.noLlm) throw new Error("Estrutura básica inválida");

const intent=await page.evaluate(()=>[
  window.DevAnabel.intent("analise meu codigo").type,
  window.DevAnabel.intent("como criar um jogo").type,
  window.DevAnabel.intent("Anabel quero uma dica de jogo de estrategia").type,
  window.DevAnabel.intent("https://example.com/x.html").type,
  window.DevAnabel.intent("me dê o código").type,
  window.DevAnabel.intent("crie space invaders").type,
  window.DevAnabel.intent("sim").type
]);
if(JSON.stringify(intent)!==JSON.stringify(["analyze","question","ideas","url","generate","space","confirm"])) throw new Error("Roteamento de intenção inválido: "+JSON.stringify(intent));

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

await page.evaluate(()=>window.DevAnabel.run(document.querySelector("#editor").value));
await page.waitForTimeout(250);
const frameText=await page.evaluate(()=>{
  const f=document.querySelector("#sandbox");
  return f.contentDocument?.body?.innerText||"";
});
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
