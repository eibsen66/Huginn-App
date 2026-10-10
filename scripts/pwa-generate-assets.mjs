// Deterministic synthetic fixtures and approved-logo icon derivatives only.
import {mkdir,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
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
await import('./pwa-icons.mjs');
