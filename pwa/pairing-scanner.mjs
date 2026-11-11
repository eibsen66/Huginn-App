import {parsePairing} from './source.mjs';
export const DEV_ORIGIN='https://192.168.4.1';
export function validateScannedPairing(text,origin,profile){
  if(profile!=='DEV_BROWSER_OS_TLS_V1')throw Error('PAIR_PROFILE');
  if(origin!==DEV_ORIGIN)throw Error('PAIR_ORIGIN');
  return parsePairing(text);
}
export function decodePairingFrame(image,{decoder=globalThis.jsQR}={}){
  if(typeof decoder!=='function')throw Error('QR decoder vantar. Uppfærðu appið á nettengdu neti.');
  return decoder(image.data,image.width,image.height,{inversionAttempts:'attemptBoth'})?.data??null;
}
const cameraMessage=e=>({NotAllowedError:'Myndavélarheimild hafnað. Leyfðu myndavél fyrir þetta app og reyndu aftur.',NotFoundError:'Engin myndavél fannst.',NotReadableError:'Myndavél er upptekin eða óaðgengileg.',OverconstrainedError:'Myndavél styður ekki umbeðna stillingu.'}[e?.name]||'Ekki tókst að nota myndavél. Hættu við og reyndu aftur.');
export function createPairingScanner({video,canvas,getContext=()=>canvas.getContext('2d',{willReadFrequently:true}),getUserMedia=c=>navigator.mediaDevices.getUserMedia(c),requestFrame=cb=>requestAnimationFrame(cb),cancelFrame=id=>cancelAnimationFrame(id),setTimer=setTimeout,clearTimer=clearTimeout,decode=decodePairingFrame,validate,onValid,onError=()=>{},onStatus=()=>{},onActive=()=>{},onZoom=()=>{}}){
  let generation=0,stream=null,frame=null,timer=null,active=false,last=-Infinity;
  const release=s=>s?.getTracks().forEach(t=>t.stop());
  function stop(){generation++;active=false;if(frame!==null)cancelFrame(frame);frame=null;if(timer!==null)clearTimer(timer);timer=null;release(stream);stream=null;onZoom(null);try{video.pause();}catch{}video.srcObject=null;canvas.width=canvas.height=0;onActive(false);}
  async function start(){
    stop();const id=generation;active=true;onActive(true);onStatus('Leyfðu myndavél og beindu henni að ferskum QR-kóða á DEV.');
    timer=setTimer(()=>{if(id===generation){stop();onError('Skönnun rann út. Veldu Skanna QR til að reyna aftur.');}},120000);
    try{
      const acquired=await getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
      if(id!==generation){release(acquired);return;}
      stream=acquired;const camera=stream.getVideoTracks?.()[0];const zoom=camera?.getCapabilities?.().zoom;if(zoom&&Number.isFinite(zoom.min)&&Number.isFinite(zoom.max)&&zoom.max>zoom.min)onZoom({min:zoom.min,max:zoom.max,step:zoom.step||0.1,value:camera.getSettings?.().zoom||zoom.min});for(const track of stream.getTracks())track.addEventListener?.('ended',()=>{if(id===generation){stop();onError('Myndavél stöðvaðist. Reyndu aftur.');}},{once:true});
      video.muted=true;video.playsInline=true;video.srcObject=stream;await video.play();if(id!==generation)return;
      const ctx=getContext();if(!ctx)throw Error('CANVAS_UNAVAILABLE');last=-Infinity;
      const tick=time=>{
        if(id!==generation||!active)return;
        try{
          if(time-last>=120&&video.readyState>=2&&video.videoWidth&&video.videoHeight){
            last=time;const scale=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
            ctx.drawImage(video,0,0,canvas.width,canvas.height);const image=ctx.getImageData(0,0,canvas.width,canvas.height);let text;
            try{text=decode(image);}finally{image.data.fill(0);ctx.clearRect(0,0,canvas.width,canvas.height);}
            if(text!==null){let parsed;try{parsed=validate(text);}catch(error){const code=['PAIR_PROFILE','PAIR_ORIGIN','PAIR_SIZE','PAIR_DUPLICATE','PAIR_JSON','PAIR_KEYS','PAIR_SCHEMA','PAIR_DEVICE','PAIR_PIN','PAIR_TOKEN'].includes(error?.message)?error.message:'PAIR_VALIDATION';stop();onError('QR validation stopped ['+code+']. No connection attempted.');return;}
              stop();onValid(text,parsed);text=null;return;
            }
          }
          frame=requestFrame(tick);
        }catch{stop();onError('QR-lestur mistókst. Hættu við og reyndu aftur.');}
      };frame=requestFrame(tick);
    }catch(e){if(id===generation){stop();onError(cameraMessage(e));}}
  }
  return {start,stop,async setZoom(value){const camera=stream?.getVideoTracks?.()[0],range=camera?.getCapabilities?.().zoom;if(!range||!Number.isFinite(value)||value<range.min||value>range.max)return false;try{await camera.applyConstraints({advanced:[{zoom:value}]});return true;}catch{return false;}},get active(){return active;}};
}
