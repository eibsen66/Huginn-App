import test from 'node:test';import assert from 'node:assert/strict';
import {approved,collectFirmware,assertApprovedSnapshot} from './firmware-reference.mjs';
test('historical UTC authority remains intact and intentionally rejects the newer candidate',()=>{assertApprovedSnapshot({...approved,tag_target:approved.HEAD,index:''});assert.throws(()=>assertApprovedSnapshot(collectFirmware()),/FIRMWARE_DIRTY_INVENTORY/);});
const base={...approved,tag_target:approved.HEAD,index:''};
for(const [name,mutate] of [
 ['protected source bytes',s=>s.source_sha256[Object.keys(s.source_sha256).find(k=>k.endsWith('/main.c'))]='0'.repeat(64)],
 ['staged index',s=>s.index='Huginn/Firmware/huginn/main/main.c'],
 ['additional dirty path',s=>s.status+='\n?? unexpected.txt'],
 ['retained historical bytes',s=>s.allowed_dirty_sha256[Object.keys(s.allowed_dirty_sha256)[0]]='0'.repeat(64)],
 ['HEAD',s=>s.HEAD='0'.repeat(40)],['tag target',s=>s.tag_target='0'.repeat(40)]
])test('disposable cloned snapshot rejects '+name,()=>{const copy=structuredClone(base);mutate(copy);assert.throws(()=>assertApprovedSnapshot(copy));});
