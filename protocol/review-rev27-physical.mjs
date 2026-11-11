// Saved-file verification only. No serial, network, build or firmware writes.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root='C:/HuginnEIS/Huginn/Firmware/huginn',build=root+'/build-rev2.7-20261105';
const folder='C:/HuginnEIS/Evidence/REV2.7-COM5/console-20261105T205803Z';
const out='build/rev27-physical-acceptance';await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await readFile(p));
const retained={};async function pin(p){const bytes=await readFile(p);retained[p]=sha(bytes);return bytes;}
const raw=await pin(folder+'/console.raw');assert.equal(sha(raw),'a9c3fe07982e813c56e391317a3c775d58e672e0a9bc9c380a4e4f6c9801191a');
const status=JSON.parse(await pin(folder+'/status.json')),summary=JSON.parse(await pin(folder+'/settings-send-summary.json'));
assert.equal(status.status,'STOPPED');assert.equal(status.bytes_received,raw.length);assert.equal(summary.raw_sha256,sha(raw));
const rows=(await pin(folder+'/console.jsonl')).toString('utf8').trim().split(/\r?\n/).map(JSON.parse);
assert.equal(rows[0].event,'ARMED');let at=0;for(const r of rows.filter(r=>r.bytes!==undefined)){assert.equal(r.offset,at);const bytes=Buffer.from(r.text,'utf8');assert.equal(bytes.length,r.bytes);assert.deepEqual(bytes,raw.subarray(at,at+r.bytes));at+=r.bytes;}assert.equal(at,raw.length);
const end=summary.settings_send_records.find(r=>r.event==='end');
assert.equal(end.id,1);assert.equal(end.bytes,29502);assert.equal(end.tls_body_accepted,29502);assert.equal(end.https_return,29502);assert.equal(end.http_result,0);
assert.equal(summary.allocation_failure_records.length,1);assert.equal(summary.allocation_failure_records[0].records,0);assert.equal(summary.allocation_failure_records[0].dropped,0);
assert.match(raw.toString(),/HS2_SEND: end id=1 bytes=29502 tls_body_accepted=29502 http_result=0 /);
const start=JSON.parse(await pin(build+'/owner-build-start.json')),complete=JSON.parse(await pin(build+'/owner-build-complete.json')),result=JSON.parse(await pin(build+'/owner-build-result.json'));
assert.equal(complete.start_sha256,retained[build+'/owner-build-start.json']);assert.equal(result.complete_sha256,retained[build+'/owner-build-complete.json']);assert.equal(result.successful,true);assert.equal(result.exit_code,0);
for(const [p,h] of Object.entries(complete.outputs))assert.equal(sha(await pin(build+'/'+p)),h,p);
for(const [p,h] of Object.entries(start.sources))assert.equal(sha(await readFile(root+'/'+p)),h,'source correspondence: '+p);
assert.equal(summary.intended_app_sha256,complete.outputs['lvgl_porting.bin']);assert.equal(status.intended_app_sha256,complete.outputs['lvgl_porting.bin']);
const report={capture:folder,raw_sha256:sha(raw),raw_bytes:raw.length,jsonl_contiguous_and_matches_raw:true,artifact_sha256:complete.outputs['lvgl_porting.bin'],artifact_bytes:(await readFile(build+'/lvgl_porting.bin')).length,build_receipts_outputs_and_current_sources_match:true,settings_device_result:end,phone_evidence:'Owner-reported matching screenshot: HTTP 200; declaredBytes=29502; receivedBytes=29502; outcome=valid; phase=complete. No separate screenshot file inspected.',acceptance:'One physically successful read-only Settings retrieval',repeated_reliability:false,persistence_tested:false,flight_release:false,flight_list_503_cause:'Not identified by retained capture; no branch/error-body record',physical_image_readback:summary.physical_image_readback,retained};
await writeFile(out+'/verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,retained:undefined,settings_device_result:undefined},null,2));
