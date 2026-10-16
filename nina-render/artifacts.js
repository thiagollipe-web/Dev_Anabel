/* Pure, bounded artifact parsing. Generated source is never executed here. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NinaArtifacts=api;})(typeof globalThis==='object'?globalThis:this,()=>{
 const extensions={html:'html',css:'css',javascript:'js',js:'js',typescript:'ts',ts:'ts',jsx:'jsx',tsx:'tsx',python:'py',py:'py',java:'java',c:'c',cpp:'cpp','c++':'cpp',csharp:'cs','c#':'cs',go:'go',rust:'rs',ruby:'rb',php:'php',swift:'swift',kotlin:'kt',sql:'sql',json:'json',yaml:'yaml',yml:'yml',xml:'xml',bash:'sh',sh:'sh',powershell:'ps1',r:'r',lua:'lua',dart:'dart',vue:'vue',svelte:'svelte',markdown:'md',toml:'toml',text:'txt',txt:'txt'};
 function safePath(path){if(typeof path!=='string'||path.length>180||/[\x00-\x1f\\:]/.test(path)||path.startsWith('/')||path.split('/').some(x=>!x||x==='.'||x==='..'))return null;return /^[\w. /@+-]+$/.test(path)?path:null;}
 function files(text){const out=[],seen=new Set();let heading='',block=null;for(const line of String(text).split(/\r?\n/)){
  if(!block){const h=/^#{1,6}\s+`?([^`]+?)`?\s*$/.exec(line);if(h)heading=h[1];const m=/^\s*(`{3,}|~{3,})([\w+#.-]*)\s*$/.exec(line);if(m)block={fence:m[1],lang:m[2].toLowerCase(),lines:[],heading};}
  else if(new RegExp('^\\s*'+block.fence[0]+'{'+block.fence.length+',}\\s*$').test(line)){let name=safePath(block.heading);if(!name||!/(?:\.[a-z0-9]{1,12}|Dockerfile|Makefile)$/i.test(name))name=extensions[block.lang]?'arquivo-'+(out.length+1)+'.'+extensions[block.lang]:null;const content=block.lines.join('\n')+'\n';if(name&&content.trim()&&content.length<=300000&&out.length<40){if(seen.has(name))throw Error('Nome de arquivo repetido: '+name);seen.add(name);out.push({name,content,language:block.lang});}block=null;heading='';}else block.lines.push(line);
 }return out;}
 function formats(text){const q=String(text||'').trim();if(/\b(?:não|nao|sem)\b[^.!?\n]*\b(?:gerar|gere|criar|crie|arquivo|pptx?|pdf|word|planilha)\b/i.test(q))return [];
 if(!/\b(?:gere|gerar|crie|criar|faça|monte|exporte|converta|entregue|envie|quero|preciso)\b/i.test(q))return [];
 if(/\b(?:explique|analise|leia|resuma|revise)\b/i.test(q)&&!/\b(?:gere|crie|exporte|converta|entregue|envie)\b/i.test(q))return [];
 // A program that handles PDF is a code request, not a PDF export.
 if(/\b(?:código|codigo|script|programa|função|python|javascript|html|css)\b/i.test(q)&&!/\b(?:exporte|converta|entregue|envie)\b[^.!?]*\b(?:em|como)\s+(?:pdf|word|docx|pptx)\b/i.test(q))return [];
 return [['pptx',/\b(?:pptx?|powerpoint|slides|apresentação)\b/i],['pdf',/\bpdf\b/i],['xlsx',/\b(?:xlsx?|excel|planilha)\b/i],['docx',/\b(?:docx?|word|documento)\b/i]].filter(([,r])=>r.test(q)).map(([k])=>k);}
 return {files,safePath,formats};
});
