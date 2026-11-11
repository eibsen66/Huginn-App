import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {DOWNLOAD_ONLY_REFERENCE as PROFILE,reviewedDownloadOnly as reviewed,collectFirmware,assertApprovedSnapshot,parseReference,sha256} from './firmware-reference.mjs';
const base=collectFirmware(undefined,PROFILE);
test('exact reviewed download-only source/config/artifact and 35-entry inventory',()=>assertApprovedSnapshot(base,PROFILE));
const main='Huginn/Firmware/huginn/main/main.c',ack='Huginn/Firmware/huginn/components/huginn_flight_courier/huginn_flight_ack_http.c';
const changeFile=(s,p,bytes)=>{s.source_sha256[p]=sha256(bytes);s.task_files_sha256[p]=sha256(bytes);};
for(const [name,mutate] of [
 ['MAIN mutation',s=>changeFile(s,main,readFileSync('C:/HuginnEIS/'+main,'utf8')+'\n/* unapproved */')],
 ['Courier mutation',s=>changeFile(s,ack,readFileSync('C:/HuginnEIS/'+ack,'utf8')+'\n/* unapproved */')],
 ['ACK guard removal',s=>{const text=readFileSync('C:/HuginnEIS/'+ack,'utf8');const changed=text.replace('#if HUGINN_LOCAL_RECORDING_ONLY || HUGINN_DEV_DOWNLOAD_ONLY','#if HUGINN_LOCAL_RECORDING_ONLY');assert.notEqual(text,changed);changeFile(s,ack,changed);}],
 ['unexpected dirty content',s=>s.status+='\n?? unexpected.txt'],
 ['unexpected staged content',s=>s.index='Huginn/Firmware/huginn/main/main.c'],
 ['retained owner bytes',s=>s.allowed_dirty_sha256[Object.keys(s.allowed_dirty_sha256)[0]]='0'.repeat(64)],
 ['HEAD',s=>s.HEAD='0'.repeat(40)],['benchmark target',s=>s.tag_target='0'.repeat(40)],['benchmark tag object',s=>s.tag_object='0'.repeat(40)],
 ['candidate image',s=>s.artifact.sha256='0'.repeat(64)],['mode configuration',s=>s.configuration.HUGINN_DEV_DOWNLOAD_ONLY='OFF'],
 ['review receipt',s=>s.authority_files_sha256[Object.keys(s.authority_files_sha256)[0]]='0'.repeat(64)]
])test('disposable candidate snapshot rejects '+name,()=>{const s=structuredClone(base);mutate(s);assert.throws(()=>assertApprovedSnapshot(s,PROFILE));});
test('altered named candidate-reference contents rejected',()=>{const text=readFileSync(new URL('./fixtures/reviewed-download-only-firmware.json',import.meta.url),'utf8');assert.throws(()=>parseReference(PROFILE,text.replace(reviewed.HEAD,'0'.repeat(40))),/APPROVED_FIXTURE_DRIFT/);});
test('unknown reference profile fails closed',()=>assert.throws(()=>assertApprovedSnapshot(base,'UNKNOWN'),/FIRMWARE_REFERENCE_PROFILE/));
