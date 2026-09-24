"use strict";

const http=require("http");
const fs=require("fs");
const path=require("path");
const {URL}=require("url");

const HOST="127.0.0.1";
const PORT=8787;
const ROOT=__dirname;
const OLLAMA_URL="http://127.0.0.1:11434/api/chat";

const MIME={
  ".html":"text/html; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".txt":"text/plain; charset=utf-8",
  ".svg":"image/svg+xml",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",
  ".ico":"image/x-icon"
};

function send(res,status,body,type="text/plain; charset=utf-8"){
  res.writeHead(status,{
    "Content-Type":type,
    "Cache-Control":"no-store",
    "Access-Control-Allow-Origin":"*"
  });
  res.end(body);
}

function readBody(req,limit=256*1024){
  return new Promise((resolve,reject)=>{
    let size=0;
    const chunks=[];
    req.on("data",chunk=>{
      size+=chunk.length;
      if(size>limit){
        req.destroy();
        reject(new Error("Payload muito grande."));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end",()=>resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error",reject);
  });
}

async function proxyOllama(req,res){
  try{
    const body=await readBody(req);
    const parsed=JSON.parse(body||"{}");
    const payload={
      model:typeof parsed.model==="string"&&parsed.model?parsed.model:"gemma4:31b-cloud",
      messages:Array.isArray(parsed.messages)?parsed.messages:[],
      stream:false
    };

    const response=await fetch(OLLAMA_URL,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });

    const text=await response.text();
    res.writeHead(response.status,{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"no-store",
      "Access-Control-Allow-Origin":"*"
    });
    res.end(text);
  }catch(error){
    send(res,502,JSON.stringify({
      error:"Falha ao conectar ao Ollama.",
      detail:String(error&&error.message||error)
    }),"application/json; charset=utf-8");
  }
}

async function health(res){
  try{
    const response=await fetch("http://127.0.0.1:11434/api/tags");
    const text=await response.text();
    res.writeHead(response.status,{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"no-store",
      "Access-Control-Allow-Origin":"*"
    });
    res.end(text);
  }catch(error){
    send(res,503,JSON.stringify({
      ok:false,
      error:"Ollama não respondeu.",
      detail:String(error&&error.message||error)
    }),"application/json; charset=utf-8");
  }
}

function safePath(urlPath){
  const decoded=decodeURIComponent(urlPath);
  const relative=decoded==="/"?"index.html":decoded.replace(/^/+/,"");
  const target=path.resolve(ROOT,relative);
  if(target!==ROOT&&!target.startsWith(ROOT+path.sep))return null;
  return target;
}

const server=http.createServer(async(req,res)=>{
  if(req.method==="OPTIONS"){
    res.writeHead(204,{
      "Access-Control-Allow-Origin":"*",
      "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
      "Access-Control-Allow-Headers":"Content-Type"
    });
    res.end();
    return;
  }

  const parsed=new URL(req.url||"/","http://"+HOST+":"+PORT);

  if(parsed.pathname==="/api/ollama"){
    if(req.method!=="POST"){
      send(res,405,"Use POST.");
      return;
    }
    await proxyOllama(req,res);
    return;
  }

  if(parsed.pathname==="/api/health"){
    if(req.method!=="GET"){
      send(res,405,"Use GET.");
      return;
    }
    await health(res);
    return;
  }

  if(req.method!=="GET"&&req.method!=="HEAD"){
    send(res,405,"Método não permitido.");
    return;
  }

  const file=safePath(parsed.pathname);
  if(!file){
    send(res,403,"Acesso negado.");
    return;
  }

  fs.stat(file,(error,stat)=>{
    if(error||!stat.isFile()){
      send(res,404,"Arquivo não encontrado.");
      return;
    }
    const ext=path.extname(file).toLowerCase();
    res.writeHead(200,{
      "Content-Type":MIME[ext]||"application/octet-stream",
      "Cache-Control":"no-store"
    });
    if(req.method==="HEAD"){
      res.end();
      return;
    }
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT,HOST,()=>{
  console.log("Dev_Anabel local: http://"+HOST+":"+PORT+"/");
  console.log("Proxy Ollama: http://"+HOST+":"+PORT+"/api/ollama");
  console.log("Health: http://"+HOST+":"+PORT+"/api/health");
  console.log("Feche esta janela para encerrar o servidor.");
});

process.on("SIGINT",()=>server.close(()=>process.exit(0)));
process.on("SIGTERM",()=>server.close(()=>process.exit(0)));
