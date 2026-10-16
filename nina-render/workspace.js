'use strict';
function attachCodeDownloads(article,text){
 let files;try{files=NinaArtifacts.files(text);}catch(e){const note=document.createElement('small');note.textContent=e.message;article.append(note);return;}
 if(!files.length)return;
 const controls=document.createElement('div');controls.className='code-downloads';
 const note=document.createElement('small');note.textContent='Arquivos de código propostos — não executados. Revise antes de usar.';controls.append(note);
 for(const file of files){const button=document.createElement('button');button.type='button';button.textContent='↓ '+file.name;button.onclick=()=>download(new Blob([file.content],{type:'text/plain;charset=utf-8'}),file.name.split('/').pop());controls.append(button);}
 if(files.length>1){const all=document.createElement('button');all.type='button';all.textContent='↓ Projeto ZIP';all.onclick=async()=>{all.disabled=true;try{await lib('zip');const zip=new JSZip();for(const file of files)zip.file(file.name,file.content);download(await zip.generateAsync({type:'blob'}),'projeto-nina.zip');}catch(e){$('status').textContent='Não foi possível empacotar: '+e.message;}finally{all.disabled=false;}};controls.append(all);}
 article.append(controls);
}
(function(){
 const mic=$('voice-input'),speaker=$('voice-output'),prompt=$('prompt');
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 let recognition=null,listening=false,base='',timer=null;
 function stop(){if(recognition)recognition.abort();listening=false;clearTimeout(timer);mic.setAttribute('aria-pressed','false');mic.title='Ditar mensagem';}
 mic.setAttribute('aria-pressed','false');speaker.setAttribute('aria-pressed','false');
 mic.onclick=()=>{
  if(listening){recognition.stop();return;}
  if($('send').disabled){$('status').textContent='Aguarde a resposta antes de iniciar o microfone.';return;}
  if(!Recognition){$('status').textContent='Ditado ao vivo indisponível neste navegador. Use + → Áudio → texto ou o microfone do teclado.';return;}
  if(!confirm('Usar o reconhecimento de voz do navegador? O serviço do navegador pode processar seu áudio online. O texto aparecerá para revisão antes de enviar.'))return;
  window.speechSynthesis?.cancel();recognition=new Recognition();recognition.lang='pt-BR';recognition.continuous=false;recognition.interimResults=true;base=prompt.value;
  recognition.onstart=()=>{listening=true;mic.setAttribute('aria-pressed','true');mic.title='Parar ditado';$('status').textContent='Ouvindo… toque no microfone para parar.';timer=setTimeout(()=>recognition?.stop(),60000);};
  recognition.onresult=e=>{let words='';for(let i=0;i<e.results.length;i++)words+=e.results[i][0].transcript+' ';prompt.value=(base+(base?'\n':'')+words.trim()).slice(0,8000);prompt.dispatchEvent(new Event('input'));};
  recognition.onerror=e=>{$('status').textContent=({'not-allowed':'Permissão de microfone negada. Você pode continuar digitando.','no-speech':'Nenhuma fala reconhecida. Tente novamente.','network':'O serviço de voz está sem conexão.'}[e.error]||'Não foi possível reconhecer a fala. Tente novamente.');};
  recognition.onend=()=>{listening=false;clearTimeout(timer);mic.setAttribute('aria-pressed','false');if($('status').textContent.startsWith('Ouvindo'))$('status').textContent='Ditado concluído. Revise o texto e toque em Enviar.';};
  try{recognition.start();}catch{stop();$('status').textContent='Microfone indisponível. Tente novamente.';}
 };
 speaker.onclick=()=>{
  if(!window.speechSynthesis){$('status').textContent='Leitura em voz alta indisponível neste navegador.';return;}
  if(speechSynthesis.speaking){speechSynthesis.cancel();speaker.setAttribute('aria-pressed','false');return;}
  const text=[...history].reverse().find(m=>m.role==='assistant')?.content;if(!text){$('status').textContent='Envie uma mensagem para receber uma resposta primeiro.';return;}
  const speech=new SpeechSynthesisUtterance(text.replace(/```[\s\S]*?```/g,'Trecho de código disponível na tela.').slice(0,6000));speech.lang='pt-BR';speech.onend=speech.onerror=()=>speaker.setAttribute('aria-pressed','false');speechSynthesis.speak(speech);speaker.setAttribute('aria-pressed','true');
 };
 $('form').addEventListener('submit',stop,true);
 for(const id of ['new-conversation','nin','logout'])$(id).addEventListener(id==='nin'?'change':'click',()=>{stop();window.speechSynthesis?.cancel();});
 window.addEventListener('pagehide',()=>{stop();window.speechSynthesis?.cancel();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 // Keep the editor compact after asynchronous send completion.
 new MutationObserver(()=>{if(!$('send').disabled)prompt.dispatchEvent(new Event('input'));}).observe($('send'),{attributes:true,attributeFilter:['disabled']});
})();
