import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {fixture} from './flight-fixtures.mjs';
test('unchanged Muninn codec/archive preserve COMPLETE, INCOMPLETE, torn and >1 MiB original bytes in temporary databases',()=>{
 const vectors=['complete','incomplete','torn'].map(kind=>({kind,bytes:fixture(kind).raw.toString('base64')}));vectors.push({kind:'large',bytes:fixture('complete',{samples:12000,runtime:1700000000n}).raw.toString('base64')});assert(Buffer.from(vectors[3].bytes,'base64').length>1048576);
 const script=`import sys,json,base64,tempfile
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,'/mnt/c/Muninn')
from muninn_app.hfl_codec import decode_hfl
from muninn_app.flight_database import FlightDatabase
from muninn_app.flg_size_policy import MAX_PHYSICAL_BYTES
assert MAX_PHYSICAL_BYTES==8*1024*1024
result=[]
with tempfile.TemporaryDirectory(prefix='huginn-muninn-fixture-') as directory:
 for i,v in enumerate(json.load(sys.stdin)):
  raw=base64.b64decode(v['bytes']);e=decode_hfl(raw)
  expected='COMPLETE' if v['kind'] in ('complete','large') else 'INCOMPLETE'
  assert e.parsed_classification==expected
  assert e.evidence_acceptance=='ACCEPTED'
  path=Path(directory)/f'{i}.db'
  with FlightDatabase(path,create=True) as db:
   entry=db.archive(raw,f'F00000{i}.FLG');assert db.load(entry.id).evidence.original_bytes==raw;db.verify()
  with FlightDatabase(path,readonly=True) as db:
   assert db.load(db.list_entries()[0].id).evidence.original_bytes==raw
  result.append({'kind':v['kind'],'classification':e.parsed_classification,'bytes':len(raw)})
print(json.dumps(result))`;
 const rows=JSON.parse(execFileSync('wsl',['-d','Ubuntu','--exec','python3','-B','-c',script],{input:JSON.stringify(vectors),encoding:'utf8',windowsHide:true}));
 assert.equal(rows.length,4);assert.deepEqual(rows.map(r=>r.classification),['COMPLETE','INCOMPLETE','INCOMPLETE','COMPLETE']);
});
