import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {inflateSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {startServer} from '../scripts/pwa-serve.mjs';
const root=new URL('../',import.meta.url);
function image(buffer){
  assert.equal(buffer.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20);assert.equal(buffer[24],8);assert.equal(buffer[25],6);
  const blocks=[];for(let i=8;i<buffer.length;){const size=buffer.readUInt32BE(i);if(buffer.toString('ascii',i+4,i+8)==='IDAT')blocks.push(buffer.subarray(i+8,i+8+size));i+=size+12;}
  const rows=inflateSync(Buffer.concat(blocks));assert.equal(rows.length,height*(1+4*width));
  for(let y=0;y<height;y++)assert.equal(rows[y*(1+4*width)],0,'generated PNG uses unexpected filter');
  return {width,height,rows};
}
test('approved transparent master and application header remain unchanged',async()=>{
  const master=await readFile(new URL('pwa/icons/huginn-logo-original.png',root));
  assert.equal(createHash('sha256').update(master).digest('hex'),'3f576e521a31cb11dfce47dd3097dee3ab3e383fff43c1c7511d4dfa762835db');
  const html=await readFile(new URL('dist/pwa/index.html',root),'utf8');
  assert.match(html,/<link rel="apple-touch-icon" href="\/apple-touch-icon.png">/);
  assert.match(html,/src="\.\/icons\/huginn-logo-original.png"/);
  const css=await readFile(new URL('pwa/style.css',root),'utf8');assert.match(css,/\.brand-logo\{background:#10283b/);
});
test('all install icons are opaque PNGs with approved white artwork on existing navy',async()=>{
  for(const [name,size] of [['apple-touch-icon.png',180],['icon-192.png',192],['icon-512.png',512],['icon-maskable-512.png',512]]){
    const png=image(await readFile(new URL('dist/pwa/icons/'+name,root)));assert.equal(png.width,size);assert.equal(png.height,size);
    let navy=0,white=0;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const i=y*(1+size*4)+1+x*4;assert.equal(png.rows[i+3],255,'transparent install pixel');
      if(png.rows[i]===16&&png.rows[i+1]===40&&png.rows[i+2]===59)navy++;
      if(png.rows[i]===255&&png.rows[i+1]===255&&png.rows[i+2]===255)white++;
    }
    assert.ok(navy>size*size*.25&&white>size*size*.01,'emblem contrast missing');
  }
  assert.deepEqual(await readFile(new URL('dist/pwa/apple-touch-icon.png',root)),await readFile(new URL('dist/pwa/icons/apple-touch-icon.png',root)));
});
test('root Apple and manifest icon URLs serve PNG MIME/signatures and cache list includes root icon',async()=>{
  const server=await startServer({testHttp:true,port:0}),origin='http://127.0.0.1:'+server.address().port;
  try{
    const manifest=await (await fetch(origin+'/manifest.webmanifest')).json();
    for(const size of [192,512])assert.ok(manifest.icons.some(icon=>icon.sizes===size+'x'+size&&icon.type==='image/png'));
    for(const path of ['/apple-touch-icon.png',...manifest.icons.map(icon=>'/'+icon.src)]){
      const response=await fetch(origin+path);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
      image(Buffer.from(await response.arrayBuffer()));
    }
    assert.match(await readFile(new URL('dist/pwa/sw.js',root),'utf8'),/'\.\/apple-touch-icon.png'/);
  }finally{await new Promise(r=>server.close(r));}
});
