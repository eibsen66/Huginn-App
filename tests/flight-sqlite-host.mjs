// Host-only reference adapter for the same schema/transitions. Never bundled in mobile assets.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {encodeMetadata,validateEvidence} from '../flight-evidence.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const require=(ok,code)=>{if(!ok)throw new Error(code);};
export class SqliteHost {
 constructor(path,{secure=true,packaged=true,space=true}={}){this.path=path;this.environment={secure,packaged,space};this.credentials=new Map();this.queue=Promise.resolve();this.open();}
 open(){this.db=new DatabaseSync(this.path);this.db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=EXTRA; PRAGMA foreign_keys=ON;');this.db.exec(readFileSync(new URL('../mobile/schema.sql',import.meta.url),'utf8'));}
 close(){this.db.close();}
 reopen(){this.close();this.open();}
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 one(sql,...args){return this.db.prepare(sql).get(...args);}
 run(sql,...args){return this.db.prepare(sql).run(...args);}
 metadata(e){const row=this.one('SELECT metadata FROM downloads WHERE e=?',e);require(row,'EVIDENCE_NOT_FOUND');return row.metadata;}
 status(e){const d=this.one('SELECT * FROM downloads WHERE e=?',e);require(d,'EVIDENCE_NOT_FOUND');return {evidence_ref:e,offset:String(d.offset),state:d.state,conflict:Number(this.one('SELECT count(*) AS n FROM downloads WHERE s=?',d.s).n)>1,ack_status:this.one('SELECT ack_status FROM flights WHERE e=?',e)?.ack_status??'NONE'};}
 list(){return this.db.prepare('SELECT * FROM flights ORDER BY e').all();}
 read(e,o,n){require(n>0&&n<=16384&&o+n<=Number(this.status(e).offset),'READ_RANGE');const rows=this.db.prepare('SELECT * FROM chunks WHERE e=? AND offset<? AND offset+length(bytes)>? ORDER BY offset').all(e,o+n,o);const out=Buffer.alloc(n);let written=0;for(const r of rows){require(hash(r.bytes)===r.sha,'CHUNK_HASH');const from=Math.max(Number(r.offset),o),to=Math.min(Number(r.offset)+r.bytes.length,o+n);require(from===o+written,'CHUNK_GAP');out.set(r.bytes.subarray(from-Number(r.offset),to-Number(r.offset)),written);written+=to-from;}require(written===n,'CHUNK_GAP');return out;}
 async verify(e){const m=this.metadataObjects.get(e),size=Number(m.physical_bytes);require(Number(this.status(e).offset)===size,'INCOMPLETE_DOWNLOAD');const pieces=[];for(let o=0;o<size;o+=16384)pieces.push(this.read(e,o,Math.min(16384,size-o)));await validateEvidence(Buffer.concat(pieces),m);return true;}
 // Host reconstruction uses the unchanged JS parser; native implementations stream their own verifier.
 metadataObjects=new Map();
 register(m){this.metadataObjects.set(`${m.source_device_id}|${m.session_id}|${m.metadata_sha256}`,structuredClone(m));}
 qualification(){let probe=false;try{this.transaction(()=>this.run('INSERT OR REPLACE INTO clients(id,bytes) VALUES(?,?)','__local_probe__',Buffer.from([0,1,255,0,42])));this.reopen();probe=Buffer.from(this.one("SELECT bytes FROM clients WHERE id='__local_probe__'").bytes).equals(Buffer.from([0,1,255,0,42]));this.transaction(()=>this.run("DELETE FROM clients WHERE id='__local_probe__'"));}catch{}const journal=this.one('PRAGMA journal_mode').journal_mode,sync=Number(this.one('PRAGMA synchronous').synchronous);const conflicts=this.one('SELECT count(*) AS n FROM (SELECT s FROM downloads GROUP BY s HAVING count(*)>1)').n>0;const checks={packaged_context:this.environment.packaged,recognized_platform:true,private_sqlite:true,durability_effective:journal==='delete'&&sync===3,serialized_worker:true,adequate_storage:this.environment.space,probe_reopen_exact:probe,secure_credentials:this.environment.secure,no_conflict:!conflicts};return {checks,journal_mode:journal,synchronous:sync,sqlite_version:this.one('SELECT sqlite_version() AS v').v,LOCAL_STORAGE_GATE_PASS:Object.values(checks).every(Boolean),FULL_ACK_GATE_PASS:false};}
 async dispatch(op,o){
  if(op==='evidenceListImported')return {flights:this.list().filter(f=>f.e>(o.after??'')).slice(0,64).map(f=>this.status(f.e)),limit:64};
  if(op==='platformInfo')return {platform:'synthetic-host',fixture_build:true};
  if(op==='storageQualification')return this.qualification();
  if(op.startsWith('credential')){let ref=o.credential_ref;if(op==='credentialStore'){require(o.fixture_id==='courier-v1','PAIRING_NOT_IMPLEMENTED');ref='fixture-'+String(this.credentials.size+1).padStart(32,'0');this.credentials.set(ref,Buffer.from('SYNTHETIC-CREDENTIAL'));}if(op==='credentialDelete')this.credentials.delete(ref);return {credential_ref:ref,exists:this.credentials.has(ref),synthetic:true};}
  if(op==='evidenceCreateStaging'){const m=Buffer.from(o.metadata_base64,'base64');require(m.length===108&&hash(m)===o.metadata_sha256,'METADATA_HASH');const s=o.source_device_id+'|'+m.subarray(8,24).toString('hex'),e=s+'|'+o.metadata_sha256;this.transaction(()=>{this.run('INSERT OR IGNORE INTO downloads(e,s,metadata) VALUES(?,?,?)',e,s,m);require(Buffer.from(this.metadata(e)).equals(m),'DUPLICATE_METADATA');});return this.status(e);}
  const e=o.evidence_ref,m=this.metadata(e);
  if(op==='evidenceGetStatus')return this.status(e);
  if(op==='evidenceReadRange')return {bytes_base64:this.read(e,Number(o.offset),o.length).toString('base64')};
  if(op==='evidenceCommitRange'){const start=Number(o.offset),bytes=Buffer.from(o.bytes_base64,'base64'),size=Number(Buffer.from(m).readBigUInt64LE(56));require(start<size&&bytes.length===Math.min(16384,size-start),'CHUNK_LENGTH');this.transaction(()=>{require(this.status(e).state==='STAGING'&&Number(this.status(e).offset)===start,'CONTIGUOUS_OFFSET');this.run('INSERT INTO chunks(e,offset,bytes,sha) VALUES(?,?,?,?)',e,start,bytes,hash(bytes));this.run('UPDATE downloads SET offset=? WHERE e=?',start+bytes.length,e);});return this.status(e);}
  if(op==='evidenceReopenVerify'){this.reopen();await this.verify(e);return {...this.status(e),verified:true};}
  if(op==='evidenceImport'){await this.verify(e);this.transaction(()=>{this.run('INSERT OR IGNORE INTO flights(e,s) SELECT e,s FROM downloads WHERE e=?',e);this.run("UPDATE downloads SET state='IMPORTED' WHERE e=?",e);});return this.status(e);}
  this.reopen();await this.verify(e);require(this.qualification().LOCAL_STORAGE_GATE_PASS,'LOCAL_GATE_DENIED');require(this.list().some(f=>f.e===e),'NOT_IMPORTED');
  if(op==='evidenceCreateAckPending')this.transaction(()=>{this.run("INSERT OR IGNORE INTO ack_outbox(e,state) VALUES(?,'PENDING_SYNTHETIC')",e);this.run('UPDATE flights SET ack_status=(SELECT state FROM ack_outbox WHERE e=?) WHERE e=?',e,e);});
  else if(op==='evidenceMarkAcked')this.transaction(()=>{require(this.one('SELECT * FROM ack_outbox WHERE e=?',e),'NO_PENDING_ACK');this.run("UPDATE ack_outbox SET state='ACKED_SYNTHETIC' WHERE e=?",e);this.run("UPDATE flights SET ack_status='ACKED_SYNTHETIC' WHERE e=?",e);});else throw new Error('UNKNOWN_OPERATION');return this.status(e);
 }
 bridge(operations){return Object.fromEntries(operations.map(op=>[op,o=>{const next=this.queue.then(()=>this.dispatch(op,o));this.queue=next.catch(()=>{});return next;}]));}
}
export const stagingOptions=m=>({source_device_id:m.source_device_id,metadata_base64:Buffer.from(encodeMetadata(m)).toString('base64'),metadata_sha256:m.metadata_sha256});
