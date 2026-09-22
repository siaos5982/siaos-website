import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {consultationInput,checkoutInput,consultationConfirmationInput,catalogInput,operatorRefundInput,compatibilityPaidReport,analyticsInput,hmac,equalSignature,canonical} from '../backend/core.mjs';
import {sheetRows,SHEET_TITLES,overviewRows} from '../backend/sheets.mjs';
import worker from '../backend/worker.mjs';

const id='22222222-2222-4222-8222-222222222222';
const booking={appointmentId:id,service:'tarot',relatedService:'Single Question Reading',details:{fullName:'Test User',dateOfBirth:'1990-01-01',phone:'9999999999',whatsapp:'9999999999',consultationMode:'On-call consultation',disclaimerAccepted:'on'}};
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
test('paid report checkout accepts only the fixed report and four reduced numbers',()=>{const value=checkoutInput({...order,kind:'report',slug:'compatibility-report',variant:'15-day-access',quantity:1,reportNumbers:{yourMulank:1,yourBhagyank:2,partnerMulank:3,partnerBhagyank:4}});assert.equal(value.reportNumbers.partnerBhagyank,4);assert.throws(()=>checkoutInput({...order,kind:'report',slug:'compatibility-report',variant:'15-day-access',reportNumbers:{yourMulank:10}}));});
test('paid compatibility report is generated server-side from reduced numbers',()=>{const value=compatibilityPaidReport({yourMulank:1,yourBhagyank:2,partnerMulank:3,partnerBhagyank:4});assert.equal(value.sections.length,8);assert.match(value.introduction,/% compatibility pattern/);assert.equal(value.numbers.partnerMulank,3);});
test('product checkout requires a real address',()=>assert.throws(()=>checkoutInput({...order,address:{}})));
test('consultations cannot enter Razorpay checkout',()=>assert.throws(()=>checkoutInput({...order,kind:'consultation',consultationId:id})));
test('WhatsApp consultation confirmation requires an integer direct payment and references',()=>{const value=consultationConfirmationInput({appointmentId:id,amount:110000,method:' UPI ',reference:' UTR-123 '});assert.equal(value.amount,110000);assert.equal(value.method,'UPI');assert.throws(()=>consultationConfirmationInput({appointmentId:id,amount:0,method:'UPI',reference:'UTR-123'}));});
test('catalogue allows only product prices with integer paise and exact variants',()=>{assert.equal(catalogInput({kind:'product',slug:'clear-quartz-bracelet',variant:'M',name:'Clear Quartz Bracelet',unitAmount:110000,shippingAmount:0,active:true}).unit_amount,110000);assert.throws(()=>catalogInput({kind:'consultation',slug:'tarot',variant:'Single Question Reading',name:'Tarot',unitAmount:110000,shippingAmount:0,active:true}));assert.throws(()=>catalogInput({kind:'product',slug:'test',variant:'',name:'Test',unitAmount:1.5,shippingAmount:0,active:true}));});
test('operator refunds require a transaction, integer paise and a clear reason',()=>{assert.equal(operatorRefundInput({transactionId:id,amount:5000,reason:'Duplicate payment'}).amount,5000);assert.throws(()=>operatorRefundInput({transactionId:id,amount:1.5,reason:'Duplicate payment'}));assert.throws(()=>operatorRefundInput({transactionId:id,amount:5000,reason:'bad'}));});
test('canonical comparison ignores JSON property order recursively',()=>assert.equal(canonical({b:2,a:{z:1,y:2}}),canonical({a:{y:2,z:1},b:2})));
test('HMAC SHA256 matches a known test vector',async()=>{const s=await hmac('key','The quick brown fox jumps over the lazy dog');assert.equal(s,'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');assert.ok(equalSignature(s,s));assert.equal(equalSignature(s,'x'.repeat(64)),false);assert.equal(equalSignature(s,s.slice(1)),false);});
test('analytics strips query strings and full referrer details',()=>{const e=analyticsInput({consent:true,event_name:'page_view',session_id:id,anonymous_id:id,path:'/index.html',referrer:'https://example.org/path?email=private@example.org',metadata:{email:'private'},device:'mobile'});assert.equal(e.referrer,'example.org');assert.equal(e.metadata.email,undefined);});
test('analytics rejects URL queries and absent consent',()=>{assert.throws(()=>analyticsInput({consent:false}));assert.throws(()=>analyticsInput({consent:true,event_name:'page_view',session_id:id,anonymous_id:id,path:'/login.html?otp=123456'}));});
test('sheet consultation export uses approved fields only',()=>{const rows=sheetRows('consultations',[{id,details:{fullName:'=IMPORTXML("evil")',access_token:'secret'}}]);assert.ok(rows[0].includes('fullName'));assert.ok(!JSON.stringify(rows).includes('secret'));assert.ok(JSON.stringify(rows).includes('IMPORTXML'));});
test('calendar export includes consultation name and IST time',()=>{const rows=sheetRows('calendar',[{start_at:'2026-09-18T04:30:00Z',end_at:'2026-09-18T05:00:00Z',consultation_requests:[{id,details:{fullName:'Test',phone:'123'}}]}]);assert.ok(rows[0].includes('clientName'));assert.ok(rows[1].includes('Test'));assert.ok(rows[1].some(v=>v.includes('10:00:00')));});
test('Sheets sync targets the prepared workbook tabs and builds dashboard counts',()=>{assert.equal(SHEET_TITLES.clients,'Clients');assert.equal(SHEET_TITLES.refunds,'Refunds');assert.equal(SHEET_TITLES.catalog,'Catalog');const rows=overviewRows({clients:2,payments:3},'2026-09-20T00:00:00.000Z');assert.deepEqual(rows[4],['Clients',2,'Submitted profile and contact records']);assert.deepEqual(rows.at(-1),['Last refresh','2026-09-20T00:00:00.000Z','Automatic backend snapshot']);});
test('API rejects disallowed browser origin',async()=>{const r=await worker.fetch(new Request('https://api.test/api/health',{headers:{Origin:'https://evil.test'}}),{ALLOWED_ORIGINS:'https://siaos.in'});assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null);});
test('health does not expose credentials',async()=>{const r=await worker.fetch(new Request('https://api.test/api/health'),{SUPABASE_SERVICE_ROLE_KEY:'secret'});assert.equal(r.status,200);assert.ok(!(await r.text()).includes('secret'));});
test('missing authorization cannot read admin data',async()=>{const r=await worker.fetch(new Request('https://api.test/api/admin/records?type=clients'),{SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'secret'});assert.equal(r.status,401);});
test('invalid webhook signature is rejected before database access',async()=>{const r=await worker.fetch(new Request('https://api.test/api/webhooks/razorpay',{method:'POST',body:'{}',headers:{'x-razorpay-signature':'0'.repeat(64)}}),{SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'secret',RAZORPAY_WEBHOOK_SECRET:'test'});assert.equal(r.status,401);});
test('public account code contains no OTP bypass or developer login',async()=>{
  const script=await readFile(new URL('../account-store.js',import.meta.url),'utf8');
  assert.doesNotMatch(script,/developerLogin|demoAccount|123456|siaosDemoAccount/i);
});
test('public account opens immediately without OTP authentication',async()=>{
  const [html,login,store]=await Promise.all(['login.html','login.js','account-store.js'].map(file=>readFile(new URL('../'+file,import.meta.url),'utf8')));
  assert.match(html,/Email address/);
  assert.match(html,/Mobile number/);
  assert.match(login,/createAccount/);
  assert.match(store,/localAccount/);
  for(const content of [html,login,store])assert.doesNotMatch(content,/signInWithOtp|verifyOtp|Send OTP|Enter the 6-digit code/);
});
test('consultation booking saves first and hands the full request to WhatsApp',async()=>{
  const script=await readFile(new URL('../booking.js',import.meta.url),'utf8');
  assert.match(script,/SIAOSApi\('consultations'/);
  assert.match(script,/https:\/\/wa\.me\/919173569555\?text=/);
  assert.match(script,/Booking reference:/);
  assert.match(script,/Name:/);
  assert.match(script,/Service:/);
  assert.match(script,/Consultation:/);
  assert.match(script,/Appointment date:/);
  assert.match(script,/Appointment time:/);
  assert.match(script,/Appointment mode:/);
  assert.match(script,/Submitted details:/);
  assert.match(script,/Phone number/);
  assert.match(script,/WhatsApp number/);
  assert.doesNotMatch(script,/location\.(?:href|assign)\s*\(?'payment\.html/);
});
test('consultation cancellation is managed on WhatsApp without a percentage API',async()=>{
  const [appointments,worker]=await Promise.all([readFile(new URL('../account-appointments.js',import.meta.url),'utf8'),readFile(new URL('../backend/worker.mjs',import.meta.url),'utf8')]);
  assert.match(appointments,/Manage on WhatsApp/);
  assert.doesNotMatch(appointments,/consultations\/(?:cancel|refunds)|policy_percent|direct_refund_percent/);
  assert.doesNotMatch(worker,/api\/consultations\/(?:cancel|refunds)|request_consultation_cancellation|record_direct_consultation_refund/);
});
test('admin allowlist and MFA are independently enforced',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({id}),{status:200});
  try{for(const [admin,aal]of [['','aal2'],[id,'aal1']]){
    const token='header.'+Buffer.from(JSON.stringify({aal})).toString('base64url')+'.signature';
    const r=await worker.fetch(new Request('https://api.test/api/admin/summary',{headers:{Authorization:'Bearer '+token}}),{SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'secret',ADMIN_USER_IDS:admin});assert.equal(r.status,403);
  }}finally{globalThis.fetch=original;}
});
test('MFA-protected admin can confirm a WhatsApp consultation payment',async()=>{
  const original=globalThis.fetch,calls=[];const token='header.'+Buffer.from(JSON.stringify({aal:'aal2'})).toString('base64url')+'.signature';
  globalThis.fetch=async(url,options={})=>{calls.push({url:String(url),options});let data;
    if(String(url).endsWith('/auth/v1/user'))data={id};
    else if(String(url).includes('/rpc/api_rate_limit'))data=true;
    else if(String(url).includes('/rpc/confirm_whatsapp_consultation')){const body=JSON.parse(options.body);assert.equal(body.p_amount,110000);assert.equal(body.p_reference,'UTR-123');data={appointmentId:id,status:'confirmed',amount:110000};}
    else throw new Error('Unexpected URL '+url);
    return new Response(JSON.stringify(data),{status:200});};
  try{const response=await worker.fetch(new Request(`https://api.test/api/admin/consultations/${id}/confirm`,{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({amount:110000,method:'UPI',reference:'UTR-123'})}),{SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'secret',ADMIN_USER_IDS:id});assert.equal(response.status,200);assert.equal((await response.json()).status,'confirmed');assert.ok(calls.some(call=>call.url.includes('confirm_whatsapp_consultation')));}finally{globalThis.fetch=original;}
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
test('report checkout stores a server-generated protected document payload',async()=>{
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async(url,options={})=>{
    calls.push({url:String(url),options});let data;
    if(String(url).endsWith('/auth/v1/user'))data={id};
    else if(String(url).includes('/rpc/api_rate_limit'))data=true;
    else if(String(url).includes('/checkout_intents?'))data=options.method==='PATCH'?[{}]:[];
    else if(String(url).includes('/catalog_prices?'))data=[{name:'Complete report',unit_amount:9900,shipping_amount:0}];
    else if(String(url).endsWith('/checkout_intents'))data=[{}];
    else if(String(url)==='https://api.razorpay.com/v1/orders')data={id:'order_report',amount:9900,currency:'INR'};
    else if(String(url).endsWith('/payment_transactions'))data=[{id}];
    else throw new Error('Unexpected URL '+url);
    return new Response(JSON.stringify(data),{status:200});
  };
  try{
    const reportOrder={requestId:id,kind:'report',slug:'compatibility-report',variant:'15-day-access',quantity:1,consentAccepted:true,reportNumbers:{yourMulank:1,yourBhagyank:2,partnerMulank:3,partnerBhagyank:4},reportPayload:{title:'forged'}};
    const response=await worker.fetch(new Request('https://api.test/api/payments/create',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify(reportOrder)}),{SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'secret',PAYMENTS_ENABLED:'true',RAZORPAY_KEY_ID:'key',RAZORPAY_KEY_SECRET:'secret'});
    assert.equal(response.status,200);const ledger=calls.find(call=>call.url.endsWith('/payment_transactions'));const payload=JSON.parse(ledger.options.body).metadata.reportPayload;assert.notEqual(payload.title,'forged');assert.equal(payload.sections.length,8);
  }finally{globalThis.fetch=original;}
});
test('duplicate completed webhook does not fulfil twice',async()=>{
  const original=globalThis.fetch,body=JSON.stringify({event:'payment.captured'});let requests=0;
  globalThis.fetch=async()=>{requests++;return new Response(JSON.stringify([{processed_at:'2026-09-17T00:00:00Z'}]));};
  try{const result=await worker.fetch(new Request('https://api.test/api/webhooks/razorpay',{method:'POST',body,headers:{'x-razorpay-signature':await hmac('test',body),'x-razorpay-event-id':'event_test'}}),{SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'secret',RAZORPAY_WEBHOOK_SECRET:'test'});assert.equal(result.status,200);assert.equal(requests,1);}finally{globalThis.fetch=original;}
});
test('processed refund webhook records the provider cumulative amount',async()=>{
  const original=globalThis.fetch,refundId='rfnd_test',paymentId='pay_test',requestId=id;
  const body=JSON.stringify({event:'refund.processed',payload:{refund:{entity:{id:refundId,payment_id:paymentId,amount:55000,notes:{refund_request_id:requestId}}}}});
  const calls=[];
  globalThis.fetch=async(url,options={})=>{
    calls.push({url:String(url),options});let data=[];
    if(String(url).includes('/payment_webhook_events?'))data=[];
    else if(String(url).endsWith('/payment_webhook_events'))data=[];
    else if(String(url)===`https://api.razorpay.com/v1/payments/${paymentId}`)data={amount_refunded:55000};
    else if(String(url).includes('/rpc/record_payment_refund'))data={status:'partial'};
    else if(String(url).includes('/payment_webhook_events?event_key='))data=[];
    else throw new Error('Unexpected URL '+url);
    return new Response(JSON.stringify(data),{status:200});
  };
  try{
    const response=await worker.fetch(new Request('https://api.test/api/webhooks/razorpay',{method:'POST',body,headers:{'x-razorpay-signature':await hmac('test',body),'x-razorpay-event-id':'event_refund'}}),{SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'secret',RAZORPAY_WEBHOOK_SECRET:'test',RAZORPAY_KEY_ID:'key',RAZORPAY_KEY_SECRET:'secret'});
    assert.equal(response.status,200);const rpcCall=calls.find(call=>call.url.includes('/rpc/record_payment_refund'));assert.ok(rpcCall);assert.equal(JSON.parse(rpcCall.options.body).p_total_refunded,55000);
  }finally{globalThis.fetch=original;}
});
