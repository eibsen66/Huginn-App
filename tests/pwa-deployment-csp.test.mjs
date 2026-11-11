import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
const old="default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
const expected=old.replace("connect-src 'self'","connect-src 'self' https://192.168.4.1");
function check(policy){assert.equal(policy,expected);}
test('old deployment policy and broad alternatives fail closed',()=>{
 assert.throws(()=>check(old));
 for(const bad of ['*','https:','http:','http://192.168.4.1','https://192.168.4.2','https://192.168.4.1:444'])assert.throws(()=>check(old.replace("connect-src 'self'","connect-src 'self' "+bad)));
 assert.throws(()=>check(expected+'; connect-src *'));
});
test('actual generated header matches canonical policy and preserves other rules',async()=>{
 const source=await readFile(new URL('pwa/_headers',root),'utf8'),artifact=await readFile(new URL('dist/pwa/_headers',root),'utf8');
 assert.equal(artifact,source);
 assert.equal(hash(Buffer.from(artifact.replace("connect-src 'self' https://192.168.4.1","connect-src 'self'"))),'471bb153a3d0bd3c5394279efa086726117a2df7cd6c4c46317040fd53965ea3');
 const policies=[...artifact.matchAll(/^  Content-Security-Policy: (.*)$/gm)].map(m=>m[1].trim());
 assert.equal(policies.length,1);check(policies[0]);assert.match(artifact,/^\/\*\r?$/m);
 assert.match(artifact,/X-Content-Type-Options: nosniff/);assert.match(artifact,/Referrer-Policy: no-referrer/);assert.match(artifact,/X-Robots-Tag: noindex/);
 assert.equal((artifact.match(/Cache-Control: no-cache/g)||[]).length,2);
 const html=await readFile(new URL('dist/pwa/index.html',root),'utf8');
 assert.doesNotMatch(html,/<meta[^>]+http-equiv=["']Content-Security-Policy/i);
 const manifest=JSON.parse(await readFile(new URL('dist/pwa/build.json',root)));
 assert.equal(manifest.files._headers,hash(Buffer.from(artifact)));
 assert.notEqual(manifest.version,'3ecd97ba3e63139f');
 const sw=await readFile(new URL('dist/pwa/sw.js',root),'utf8');assert.ok(sw.includes(manifest.version));
});
