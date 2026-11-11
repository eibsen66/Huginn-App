import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='C:/HuginnEIS/Huginn/Firmware/huginn';
const pinned=JSON.parse(await readFile(root+'/build-rev2.3-20261104/owner-build-start.json','utf8')).sources['main/main.c'];
const original=await readFile('build/rev23-preparation/main.c');
if(createHash('sha256').update(original).digest('hex')!==pinned)throw Error('Snapshot is not exact retained source');
const before=Buffer.from('#define HUGINN_BUILD_ID "HuginnEIS Rev. 2.3"');
const after=Buffer.from('#define HUGINN_BUILD_ID "HuginnEIS Rev. 2.4"');
const at=original.indexOf(before);if(at<0||original.indexOf(before,at+1)>=0)throw Error('Revision seam changed');
const next=Buffer.concat([original.subarray(0,at),after,original.subarray(at+before.length)]);
const current=await readFile(root+'/main/main.c','utf8');
if(next.toString().replace(/\r\n|\r/g,'\n')!==current)throw Error('Unrelated current work differs; stop');
await writeFile(root+'/main/main.c',next);
// Keep the earlier new/unbuilt attestation intact; create the final one separately.
await rename('C:/HuginnEIS/Evidence/REV2.4-PREPARATION','C:/HuginnEIS/Evidence/REV2.4-PREPARATION-before-line-ending-preservation');
console.log('Restored exact original mixed line endings; only revision bytes differ. Earlier unbuilt attestation retained.');
