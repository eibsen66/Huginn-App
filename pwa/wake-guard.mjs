export function createWakeGuard({wakeLock=globalThis.navigator?.wakeLock}={}){
 let generation=0,sentinel=null;
 return {async acquire(){const id=++generation;if(sentinel&&!sentinel.released)return true;if(!wakeLock?.request)return false;try{const current=await wakeLock.request('screen');if(id!==generation){await current.release();return false;}sentinel=current;current.addEventListener?.('release',()=>{if(sentinel===current)sentinel=null;},{once:true});return true;}catch{return false;}},async release(){generation++;const current=sentinel;sentinel=null;if(current)try{await current.release();}catch{}}};
}
