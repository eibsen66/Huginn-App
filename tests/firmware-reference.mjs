// Named, hash-bound authorities: historical UTC remains distinct from reviewed download-only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export const sha256=b=>createHash('sha256').update(b).digest('hex');
export const UTC_REFERENCE='APPROVED_UTC_20261021';
export const DOWNLOAD_ONLY_REFERENCE='DEV_DOWNLOAD_ONLY_20261021';
const definitions={
 [UTC_REFERENCE]:{file:'approved-utc-firmware.json',hash:'44afa470379ca0c97335946f814db2fce704ca782478d7868750444ff24d6ca8'},
 [DOWNLOAD_ONLY_REFERENCE]:{file:'reviewed-download-only-firmware.json',hash:'cd6a5b9742f3183a7d2979c85fa73fa58ee05361ad44d9208e4de981cc73861c'}
};
export function parseReference(profile,text){
 const d=definitions[profile];assert(d,'FIRMWARE_REFERENCE_PROFILE');
 assert.equal(sha256(text.replace(/\r\n/g,'\n')),d.hash,'APPROVED_FIXTURE_DRIFT');return JSON.parse(text);
}
const freeze=o=>{for(const v of Object.values(o))if(v&&typeof v==='object')freeze(v);return Object.freeze(o);};
const references=Object.fromEntries(Object.entries(definitions).map(([id,d])=>[id,freeze(parseReference(id,readFileSync(new URL('./fixtures/'+d.file,import.meta.url),'utf8')))]));
export const approved=references[UTC_REFERENCE];
export const reviewedDownloadOnly=references[DOWNLOAD_ONLY_REFERENCE];
function reference(profile){assert(Object.hasOwn(references,profile),'FIRMWARE_REFERENCE_PROFILE');return references[profile];}
// Resolve relocated files without changing frozen provenance paths or hashes.
function relocatedPath(value){
 let path=value.replaceAll('\\','/');
 const roots=[['C:/Huginn-Muninn/','C:/HuginnEIS/'],['C:/Huginn-App/','C:/HuginnAPP/'],['C:/Users/egill/Documents/Huginn_FirstFlight_Candidates/','C:/HuginnEIS/Evidence/Huginn_FirstFlight_Candidates/']];
 for(const [oldRoot,newRoot] of roots)if(path.startsWith(oldRoot))return newRoot+path.slice(oldRoot.length);
 return path;
}
export function collectFirmware(root='C:/HuginnEIS',profile=UTC_REFERENCE){
 const pinned=reference(profile);
 const git=(...args)=>execFileSync('git',['-c','safe.directory='+root,'-C',root,...args],{encoding:'utf8',windowsHide:true,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}}).replace(/\r\n/g,'\n').trimEnd();
 const hashes=(paths,prefix=root+'/')=>Object.fromEntries(Object.keys(paths).map(p=>[p,sha256(readFileSync(relocatedPath(prefix+p)))]));
 const actual={HEAD:git('rev-parse','HEAD'),tag_object:git('rev-parse',pinned.tag),tag_target:git('rev-parse',pinned.tag+'^{}'),status:git('status','--porcelain=v1','--untracked-files=all'),index:git('diff','--cached','--name-only'),allowed_dirty_sha256:hashes(pinned.allowed_dirty_sha256),source_sha256:hashes(pinned.source_sha256)};
 if(profile===DOWNLOAD_ONLY_REFERENCE){
  actual.task_files_sha256=hashes(pinned.task_files_sha256);
  const image=readFileSync(relocatedPath(pinned.artifact.path));actual.artifact={path:pinned.artifact.path,bytes:image.length,sha256:sha256(image)};
  actual.authority_files_sha256=hashes(pinned.authority_files_sha256,'');
  const cache=readFileSync(relocatedPath(pinned.cache_path),'utf8');actual.configuration={};
  for(const k of Object.keys(pinned.configuration)){const m=cache.match(new RegExp('^'+k+':[^=]+=(.*)$','m'));assert(m,'CONFIGURATION_MISSING '+k);actual.configuration[k]=m[1].trim();}
  const units=JSON.parse(readFileSync(relocatedPath(pinned.compile_commands_path),'utf8'));
  for(const name of ['main.c','huginn_flight_courier_http.c','huginn_flight_ack_http.c','huginn_flight_authorization_http.c','huginn_flight_manifest.c']){
   const rows=units.filter(u=>u.file.replaceAll('\\','/').endsWith('/'+name));assert.equal(rows.length,1,'COMPILE_UNIT '+name);
   assert(rows[0].command.includes('-DHUGINN_DEV_DOWNLOAD_ONLY=1'),'DOWNLOAD_ONLY_NOT_COMPILED '+name);
   if(name.includes('courier_http'))assert(rows[0].command.includes('https://huginnapp-pwa-test.pages.dev'),'COMPILED_ORIGIN');
  }
 }
 return actual;
}
export function assertApprovedSnapshot(actual,profile=UTC_REFERENCE){
 const pinned=reference(profile);
 assert.equal(actual.HEAD,pinned.HEAD,'FIRMWARE_HEAD');assert.equal(actual.tag_object,pinned.tag_object,'FIRMWARE_TAG');assert.equal(actual.tag_target,pinned.HEAD,'FIRMWARE_TAG_TARGET');
 assert.equal(actual.status,pinned.status,'FIRMWARE_DIRTY_INVENTORY');assert.equal(actual.index,'','FIRMWARE_INDEX');
 assert.deepEqual(actual.allowed_dirty_sha256,pinned.allowed_dirty_sha256,'FIRMWARE_RETAINED_BYTES');assert.deepEqual(actual.source_sha256,pinned.source_sha256,'FIRMWARE_PROTECTED_SOURCE');
 if(profile===DOWNLOAD_ONLY_REFERENCE){
  assert.deepEqual(actual.task_files_sha256,pinned.task_files_sha256,'FIRMWARE_TASK_BYTES');
  assert.deepEqual(actual.artifact,pinned.artifact,'FIRMWARE_ARTIFACT');
  assert.deepEqual(actual.configuration,pinned.configuration,'FIRMWARE_CONFIGURATION');
  assert.deepEqual(actual.authority_files_sha256,pinned.authority_files_sha256,'FIRMWARE_REVIEW_AUTHORITY');
 }
}
export function assertApprovedFirmware(profile=UTC_REFERENCE){assertApprovedSnapshot(collectFirmware(undefined,profile),profile);}
