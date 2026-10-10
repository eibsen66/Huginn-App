// Deterministic derivatives of the owner-approved Huginn emblem; no artwork synthesis.
import {readFile,writeFile} from 'node:fs/promises';
import {inflateSync,deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {referenceCrc} from '../tests/flight-fixtures.mjs';
const base=new URL('../pwa/icons/',import.meta.url);
const source=await readFile(new URL('huginn-logo-original.png',base));
if(createHash('sha256').update(source).digest('hex')!=='3f576e521a31cb11dfce47dd3097dee3ab3e383fff43c1c7511d4dfa762835db')throw Error('APPROVED_LOGO_SOURCE_CHANGED');
const width=source.readUInt32BE(16),height=source.readUInt32BE(20);
if(width!==96||height!==96||source[24]!==8||source[25]!==6||source[28]!==0)throw Error('UNSUPPORTED_LOGO_PNG');
const parts=[];
for(let at=8;at<source.length;){const size=source.readUInt32BE(at),type=source.toString('ascii',at+4,at+8);if(type==='IDAT')parts.push(source.subarray(at+8,at+8+size));at+=12+size;}
const filtered=inflateSync(Buffer.concat(parts)),pixels=Buffer.alloc(width*height*4),stride=width*4;
const paeth=(a,b,c)=>{const p=a+b-c,x=Math.abs(p-a),y=Math.abs(p-b),z=Math.abs(p-c);return x<=y&&x<=z?a:y<=z?b:c;};
for(let y=0;y<height;y++){
  const filter=filtered[y*(stride+1)];if(filter>4)throw Error('UNSUPPORTED_PNG_FILTER');
  for(let x=0;x<stride;x++){
    const at=y*stride+x,a=x>=4?pixels[at-4]:0,b=y?pixels[at-stride]:0,c=y&&x>=4?pixels[at-stride-4]:0;
    const predictor=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];
    pixels[at]=(filtered[y*(stride+1)+1+x]+predictor)&255;
  }
}
function chunk(type,data){
  const name=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);
  size.writeUInt32BE(data.length);crc.writeUInt32BE(referenceCrc(Buffer.concat([name,data])));
  return Buffer.concat([size,name,data,crc]);
}
for(const [file,size,artSize] of [['icon-192.png',192,192],['icon-512.png',512,512],['icon-maskable-512.png',512,384],['apple-touch-icon.png',180,180]]){
  // Nearest-neighbour sampling preserves source RGBA values exactly. No recoloring or opaque background.
  const rows=Buffer.alloc((size*4+1)*size),inset=(size-artSize)/2;
  for(let y=0;y<artSize;y++)for(let x=0;x<artSize;x++){
    const from=(Math.floor(y*height/artSize)*width+Math.floor(x*width/artSize))*4;
    pixels.copy(rows,(y+inset)*(size*4+1)+1+(x+inset)*4,from,from+4);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  await writeFile(new URL(file,base),Buffer.concat([source.subarray(0,8),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));
}
console.log('PWA icons derived from approved 96x96 master; original RGBA preserved.');
