// Deterministic synthetic fixtures and programmatic app icons only.
import {mkdir,writeFile} from 'node:fs/promises';import {deflateSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {fixture,referenceCrc,referenceEncoding} from '../tests/flight-fixtures.mjs';
const base=new URL('../pwa/',import.meta.url);
await mkdir(new URL('fixtures/',base),{recursive:true});await mkdir(new URL('icons/',base),{recursive:true});
const catalog={schema:'huginn.pwa.synthetic-fixtures',schema_version:1,provenance:'Synthetic only; independent fixture CRC/metadata encoder and Node SHA-256. Not device evidence.',fixtures:[]};
for(const [label,file,kind,samples] of [['COMPLETE','complete.FLG','complete',0],['INCOMPLETE','incomplete.FLG','incomplete',0],['ceiling (1 MiB limit)','ceiling.FLG','incomplete',6549]]){
  const f=fixture(kind,{samples});
  const ordinal=catalog.fixtures.length+1;
  f.metadata.filename='F00000'+ordinal+'.FLG';
  f.metadata.session_id=String(ordinal).padStart(2,'0')+f.metadata.session_id.slice(2);
  Buffer.from(f.metadata.session_id,'hex').copy(f.raw,8);
  f.raw.writeUInt32LE(referenceCrc(f.raw.subarray(0,124)),124);
  if(samples){f.raw=Buffer.concat([f.raw,Buffer.alloc(128,0xa5)]);f.metadata.integrity=2;}
  f.metadata.physical_bytes=String(f.raw.length);
  f.metadata.physical_sha256=createHash('sha256').update(f.raw).digest('hex');
  if(samples)f.metadata.runtime_us=String(300000000n+BigInt(samples-1)*100000n);
  f.metadata.metadata_sha256=createHash('sha256').update(referenceEncoding(f.metadata)).digest('hex');
  await writeFile(new URL('fixtures/'+file,base),f.raw);
  catalog.fixtures.push({label,file,metadata:f.metadata});
}
await writeFile(new URL('fixtures/catalog.json',base),JSON.stringify(catalog,null,2)+'\n');
function chunk(type,data){
  const name=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(referenceCrc(Buffer.concat([name,data])));
  return Buffer.concat([size,name,data,crc]);
}
for(const [file,size] of [['icon-192.png',192],['icon-512.png',512],['icon-maskable-512.png',512],['apple-touch-icon.png',180]]){
  const raw=Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const a=x/size,b=y/size;
    const h=((a>.29&&a<.38)||(a>.62&&a<.71))&&b>.25&&b<.75||a>.29&&a<.71&&b>.455&&b<.545;
    const color=h?[244,192,86,255]:[16,40,59,255],at=y*(size*4+1)+1+x*4;raw.set(color,at);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  await writeFile(new URL('icons/'+file,base),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
console.log('Generated synthetic fixtures and PNG icons; no physical evidence accessed.');
