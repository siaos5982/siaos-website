import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {consultationInput,checkoutInput,analyticsInput,hmac,equalSignature,canonical} from '../backend/core.mjs';
import {sheetRows} from '../backend/sheets.mjs';
import worker from '../backend/worker.mjs';

const id='22222222-2222-4222-8222-222222222222';
const booking={appointmentId:id,service:'tarot',relatedService:'Single Question Reading',details:{fullName:'Test User',dateOfBirth:'1990-01-01',consultationMode:'On-call consultation',disclaimerAccepted:'on'}};
const order={requestId:id,kind:'product',slug:'clear-quartz-bracelet',variant:'M · 7 in',quantity:1,consentAccepted:true,address:{name:'Test',phone:'9999999999',line1:'Test street',city:'Surat',state:'Gujarat',postalCode:'395001',country:'India'}};
test('consultations accept expected submitted fields',()=>assert.equal(consultationInput(booking).serviceName,'Tarot Reading'));
test('consultations reject missing consent',()=>assert.throws(()=>consultationInput({...booking,details:{...booking.details,disclaimerAccepted:''}})));
test('consultations reject arbitrary fields such as tokens',()=>assert.throws(()=>consultationInput({...booking,details:{...booking.details,access_token:'private'}})));
test('consultations reject missing required details',()=>assert.throws(()=>consultationInput({...booking,details:{disclaimerAccepted:'on'}})));
test('invalid appointment IDs cannot reach the DB',()=>assert.throws(()=>consultationInput({...booking,appointmentId:'fake'})));
test('consultations reject impossible calendar dates',()=>assert.throws(()=>consultationInput({...booking,details:{...booking.details,dateOfBirth:'1990-02-31'}})));
test('checkout strips browser amounts and other unexpected values',()=>{const value=checkoutInput({...order,amount:1,paid:true});assert.equal(value.amount,undefined);assert.equal(value.paid,undefined);});
test('checkout requires consent',()=>assert.throws(()=>checkoutInput({...order,consentAccepted:false})));
test('checkout rejects fractional and excessive quantities',()=>{for(const quantity of [0,-1,1.5,11,'1'])assert.throws(()=>checkoutInput({...order,quantity}));});
test('paid report checkout is blocked until fulfilment exists',()=>assert.throws(()=>checkoutInput({...order,kind:'report'})));
test('product checkout requires a real address',()=>assert.throws(()=>checkoutInput({...order,address:{}})));
test('consultation requires saved request ID and single quantity',()=>{assert.throws(()=>checkoutInput({...order,kind:'consultation',quantity:2}));assert.equal(checkoutInput({...order,kind:'consultation',consultationId:id}).consultationId,id);});
test('canonical comparison ignores JSON property order recursively',()=>assert.equal(canonical({b:2,a:{z:1,y:2}}),canonical({a:{y:2,z:1},b:2})));
test('HMAC SHA256 matches a known test vector',async()=>{const s=await hmac('key','The quick brown fox jumps over the lazy dog');assert.equal(s,'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');assert.ok(equalSignature(s,s));assert.equal(equalSignature(s,'x'.repeat(64)),false);assert.equal(equalSignature(s,s.slice(1)),false);});
test('analytics strips query strings and full referrer details',()=>{const e=analyticsInput({consent:true,event_name:'page_view',session_id:id,anonymous_id:id,path:'/index.html',referrer:'https://example.org/path?email=private@example.org',metadata:{email:'private'},device:'mobile'});assert.equal(e.referrer,'example.org');assert.equal(e.metadata.email,undefined);});
test('analytics rejects URL queries and absent consent',()=>{assert.throws(()=>analyticsInput({consent:false}));assert.throws(()=>analyticsInput({consent:true,event_name:'page_view',session_id:id,anonymous_id:id,path:'/login.html?otp=123456'}));});
test('sheet consultation export uses approved fields only',()=>{const rows=sheetRows('consultations',[{id,details:{fullName:'=IMPORTXML("evil")',access_token:'secret'}}]);assert.ok(rows[0].includes('fullName'));assert.ok(!JSON.stringify(rows).includes('secret'));assert.ok(JSON.stringify(rows).includes('IMPORTXML'));});
test('calendar export includes consultation name and IST time',()=>{const rows=sheetRows('calendar',[{start_at:'2026-09-18T04:30:00Z',end_at:'2026-09-18T05:00:00Z',consultation_requests:[{id,details:{fullName:'Test',phone:'123'}}]}]);assert.ok(rows[0].includes('clientName'));assert.ok(rows[1].includes('Test'));assert.ok(rows[1].some(v=>v.includes('10:00:00')));});
test('API rejects disallowed browser origin',async()=>{const r=await worker.fetch(new Request('https://api.test/api/health',{headers:{Origin:'https://evil.test'}}),{ALLOWED_ORIGINS:'https://siaos.in'});assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null);});
test('health does not expose credentials',async()=>{const r=await worker.fetch(new Request('https://api.test/api/health'),{SUPABASE_SERVICE_ROLE_KEY:'secret'});assert.equal(r.status,200);assert.ok(!(await r.text()).includes('secret'));});
test('missing authorization cannot read admin data',async()=>{const r=await worker.fetch(new Request('https://api.test/api/admin/records?type=clients'),{SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'secret'});assert.equal(r.status,401);});
test('invalid webhook signature is rejected before database access',async()=>{const r=await worker.fetch(new Request('https://api.test/api/webhooks/razorpay',{method:'POST',body:'{}',headers:{'x-razorpay-signature':'0'.repeat(64)}}),{SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'secret',RAZORPAY_WEBHOOK_SECRET:'test'});assert.equal(r.status,401);});
test('public hosts reject preview sessions and developer login even when flag is true',async()=>{
  const script=await readFile(new URL('../account-store.js',import.meta.url),'utf8');
  const values=new Map([['siaosDemoAccountV1',JSON.stringify({id:'fake-user'})]]);
  const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const context={window:{SIAOS_AUTH_CONFIG:{developerPreviewEnabled:true}},location:{hostname:'siaos.in'},localStorage:storage,sessionStorage:storage,crypto};
  vm.runInNewContext(script,context);assert.equal(await context.window.SIAOSAccount.getSession(),null);await assert.rejects(()=>context.window.SIAOSAccount.developerLogin());
});
test('admin allowlist and MFA are independently enforced',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({id}),{status:200});
  try{for(const [admin,aal]of [['','aal2'],[id,'aal1']]){
    const token='header.'+Buffer.from(JSON.stringify({aal})).toString('base64url')+'.signature';
    const r=await worker.fetch(new Request('https://api.test/api/admin/summary',{headers:{Authorization:'Bearer '+token}}),{SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'secret',ADMIN_USER_IDS:admin});assert.equal(r.status,403);
  }}finally{globalThis.fetch=original;}
});
test('checkout uses database price, not browser amount, and creates a ledger',async()=>{
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async(url,options={})=>{
    calls.push({url:String(url),options});let data;
    if(String(url).endsWith('/auth/v1/user'))data={id};
    else if(String(url).includes('/rpc/api_rate_limit'))data=true;
    else if(String(url).includes('/checkout_intents?'))data=options.method==='PATCH'?[{}]:[];
    else if(String(url).includes('/catalog_prices?'))data=[{name:'Test item',unit_amount:110000,shipping_amount:0}];
    else if(String(url).endsWith('/checkout_intents'))data=[{}];
    else if(String(url)==='https://api.razorpay.com/v1/orders'){assert.equal(JSON.parse(options.body).amount,110000);data={id:'order_test',amount:110000,currency:'INR'};}
    else if(String(url).endsWith('/payment_transactions'))data=[{id}];
    else throw new Error('Unexpected URL '+url);
    return new Response(JSON.stringify(data),{status:200});
  };
  try{
    const result=await worker.fetch(new Request('https://api.test/api/payments/create',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({...order,amount:1})}),{SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'secret',PAYMENTS_ENABLED:'true',RAZORPAY_KEY_ID:'key',RAZORPAY_KEY_SECRET:'secret'});
    assert.equal(result.status,200);assert.equal((await result.json()).amount,110000);assert.ok(calls.some(c=>c.url.endsWith('/payment_transactions')));
  }finally{globalThis.fetch=original;}
});
test('duplicate completed webhook does not fulfil twice',async()=>{
  const original=globalThis.fetch,body=JSON.stringify({event:'payment.captured'});let requests=0;
  globalThis.fetch=async()=>{requests++;return new Response(JSON.stringify([{processed_at:'2026-09-17T00:00:00Z'}]));};
  try{const result=await worker.fetch(new Request('https://api.test/api/webhooks/razorpay',{method:'POST',body,headers:{'x-razorpay-signature':await hmac('test',body),'x-razorpay-event-id':'event_test'}}),{SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'secret',RAZORPAY_WEBHOOK_SECRET:'test'});assert.equal(result.status,200);assert.equal(requests,1);}finally{globalThis.fetch=original;}
});
