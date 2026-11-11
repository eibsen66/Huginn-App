// Reuse actual H2 scanner, HFM read/recovery, MAIN snapshot and Courier pagination.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync,mkdirSync,mkdtempSync,cpSync} from 'node:fs';
import {join,resolve} from 'node:path';import {execFileSync} from 'node:child_process';
import {sha256,assertApprovedFirmware,DOWNLOAD_ONLY_REFERENCE} from './firmware-reference.mjs';
const ROOT=resolve(new URL('../',import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/,'$1'));
const FW='C:/HuginnEIS/Huginn/Firmware/huginn';
const fixtureText=readFileSync(new URL('./fixtures/selected-huginn-recording.json',import.meta.url),'utf8').replace(/\r\n/g,'\n');
assert.equal(sha256(fixtureText),'fc685842975028721e941017fcee41c6c045d2cf22bd05d63ec7a96a60d50740','SELECTED_FIXTURE_DRIFT');
export const selected=JSON.parse(fixtureText);
const linux=p=>'/mnt/'+p[0].toLowerCase()+p.slice(2).replaceAll('\\','/');
function inventory(root){const result={};function walk(p){for(const e of readdirSync(p,{withFileTypes:true})){assert(!e.isSymbolicLink(),'BACKUP_SYMLINK');const q=join(p,e.name);if(e.isDirectory())walk(q);else{const raw=readFileSync(q);result[q.slice(root.length+1).replaceAll('\\','/')]={bytes:raw.length,sha256:sha256(raw)};}}}walk(root);return result;}
export function prepareRetained(output){
 assertApprovedFirmware(DOWNLOAD_ONLY_REFERENCE);
 const root=selected.path.replace(/[\\/]FLIGHT[\\/][^\\/]+$/,'');assert.deepEqual(inventory(root),selected.backup_inventory,'PRESERVED_BACKUP_DRIFT');
 mkdirSync(output,{recursive:true});const work=mkdtempSync(join(ROOT,'build','hfm-select-')),copy=join(work,'HUGINN');cpSync(root,copy,{recursive:true,errorOnExist:true});
 const main=readFileSync(FW+'/main/main.c','utf8'),start=main.indexOf('static hfc_snapshot_result_t huginn_flight_courier_snapshot(');assert(start>=0);const end=main.indexOf('#endif',start);assert(end>start);
 writeFileSync(join(work,'retained-snapshot.inc'),main.slice(start,end));
 const component=FW+'/components/huginn_flight_courier',manifest=FW+'/components/huginn_flight_manifest',logger=FW+'/components/huginn_flight_log';
 const args=['gcc','-std=c11','-Wall','-Wextra','-Werror','-Wno-misleading-indentation','-DHFM_TRANSFER_HOST_TEST','-DHUGINN_DEV_DOWNLOAD_ONLY=1','-DHUGINN_DISPOSABLE_ROOT='+JSON.stringify(linux(copy)),... [work,component+'/tests/stubs',manifest,manifest+'/include',logger+'/include',component+'/include'].map(p=>'-I'+linux(p)),linux(join(ROOT,'tests','retained-huginn-host.c')),linux(logger+'/huginn_flight_log.c'),linux(component+'/huginn_flight_courier.c'),'-Wl,--wrap=fopen','-Wl,--wrap=stat','-o',linux(join(work,'inspect'))];
 execFileSync('wsl',['-d','Ubuntu','--exec',...args],{encoding:'utf8',windowsHide:true});
 const inspect=(path,extra=[])=>JSON.parse(execFileSync('wsl',['-d','Ubuntu','--exec',linux(join(work,'inspect')),linux(path),...extra],{encoding:'utf8',windowsHide:true}));
 const original=inspect(root),recovered=inspect(copy,['recover-disposable']);
 assert.equal(original.load_valid,false);assert.equal(original.selected_slot,'MANIFEST.A');
 const old=original.slots[0].entries.find(x=>x.entry.filename==='F578CE0.FLG');assert(old.metadata_consistent);assert.deepEqual(old.entry,selected.original_manifest.selected_entry);
 assert.deepEqual(original.slots[0].entries.filter(x=>!x.metadata_consistent).map(x=>x.entry.filename).sort(),selected.original_manifest.mismatching_selected_slot_entries.slice().sort());
 assert(recovered.load_valid&&recovered.recovery_on_disposable);assert.deepEqual(recovered.pages,selected.disposable_recovery.pages);
 const copyFiles=inventory(copy);for(const [p,value] of Object.entries(selected.backup_inventory))if(p.endsWith('.FLG'))assert.deepEqual(copyFiles[p],value,'RECOVERY_CHANGED_FLG '+p);
 assert.deepEqual(inventory(root),selected.backup_inventory,'ORIGINAL_BACKUP_CHANGED');
 const p=recovered.pages[selected.disposable_recovery.page-1].entries[selected.disposable_recovery.position_on_page-1];assert.equal(p.filename,'F578CE0.FLG');assert.equal(p.state,'COMPLETE');assert.equal(p.reason,'AUTOMATIC');assert(p.eligible);
 writeFileSync(join(output,'production-manifest-inspection.json'),JSON.stringify({original,recovered,disposable_copy:copy,all_16_FLG_bytes_unchanged:true,original_22_files_unchanged:true},null,2));
 return selected;
}
