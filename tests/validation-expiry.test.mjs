import test from 'node:test';import assert from 'node:assert/strict';
import {createDraftValidation} from '../pwa/settings-v2.mjs';
test('expired validation disables Save and never refreshes or writes automatically',async()=>{
 let previews=0;const session={hasChanges:true,state:'pending',changes:[{}],async preview(){previews++;this.state='previewed';},invalidate(){this.state='pending';}};
 const states=[],c=createDraftValidation({getSession:()=>session,isAvailable:()=>true,onState:s=>states.push(s),delay:1,validFor:30});
 try{c.changed();await new Promise(r=>setTimeout(r,100));assert.equal(c.state,'expired');assert.equal(previews,1);assert.equal(session.state,'pending');assert.deepEqual(states,['waiting','checking','ready','expired']);}finally{c.cancel();}
});
test('response arriving after its validation window cannot enable Save',async()=>{
 let release;const session={hasChanges:true,state:'pending',changes:[{}],async preview(){await new Promise(r=>release=r);this.state='previewed';},invalidate(){this.state='pending';}};
 const c=createDraftValidation({getSession:()=>session,isAvailable:()=>true,delay:1,validFor:15});
 try{c.changed();await new Promise(r=>setTimeout(r,50));release();await new Promise(r=>setTimeout(r,5));assert.equal(c.state,'expired');assert.equal(session.state,'pending');}finally{c.cancel();}
});
