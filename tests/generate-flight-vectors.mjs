import {writeFile} from 'node:fs/promises';
import {fixture,referenceEncoding} from './flight-fixtures.mjs';
const cases=[['complete','complete',{}],['incomplete','incomplete',{}],['torn','torn',{}],['corrupt','corrupt',{}],
 ['unknown_utc','provisional',{start:0n}],['hfl_v1','complete',{version:1}],
 ['large_uint64','complete',{runtime:9007199254740993n}],['signed_utc','incomplete',{start:-123n}]];
const vectors=cases.map(([name,kind,options])=>{const {raw,metadata}=fixture(kind,options);return {name,metadata,
  hfl_hex:raw.toString('hex'),encoded_hex:referenceEncoding(metadata).toString('hex'),
  physical_sha256:metadata.physical_sha256,metadata_sha256:metadata.metadata_sha256};});
await writeFile(new URL('./fixtures/flight-v1-vectors.json',import.meta.url),JSON.stringify({schema:'huginn.flight-courier.test-vectors',schema_version:1,
 provenance:'Synthetic HFL; independent Buffer concatenation reference encoder and node:crypto SHA-256. No production module imports.',vectors},null,2)+'\n');
