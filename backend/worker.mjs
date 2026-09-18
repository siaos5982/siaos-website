import {HttpError,requireValue,uuid,consultationInput,checkoutInput,analyticsInput,hmac,equalSignature,canonical} from './core.mjs';
import {syncSheets,REPORTS} from './sheets.mjs';

export function database(env) {
  requireValue(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY,'Backend configuration is incomplete.',503);
  return async (path, options={}) => {
    const response=await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`,{
      ...options,headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:'return=representation',...options.headers},
      body:options.body===undefined?undefined:JSON.stringify(options.body),signal:AbortSignal.timeout(15000)
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok) throw new HttpError(response.status===409?409:502,response.status===409?'This request already exists. Retry using the same checkout.':'Database operation failed. Please retry or contact support.');
    return data;
  };
}
const rpc=(db,name,body)=>db(`rpc/${name}`,{method:'POST',body});
async function readBody(request,max=24000) {
  requireValue(Number(request.headers.get('content-length')||0)<=max,'Request too large.',413);
  const reader=request.body?.getReader(); if(!reader) throw new HttpError(400,'Request body required.');
  const chunks=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();throw new HttpError(413,'Request too large.');}chunks.push(value);}
  const joined=new Uint8Array(total);let at=0;for(const c of chunks){joined.set(c,at);at+=c.length;}
  return new TextDecoder().decode(joined);
}
async function jsonBody(request){try{return JSON.parse(await readBody(request));}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'Invalid JSON.');}}
async function authenticate(request,env,admin=false){
  const token=request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  requireValue(token,'Sign in to continue.',401);
  const response=await fetch(`${env.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
  requireValue(response.ok,'Your session expired. Sign in again.',401);
  const user=await response.json();requireValue(uuid(user.id),'Invalid session.',401);
  if(admin){
    requireValue((env.ADMIN_USER_IDS||'').split(',').map(s=>s.trim()).includes(user.id),'Administrator access is required.',403);
    // Only decode claims AFTER Supabase has validated this same JWT.
    let claims;try{const part=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');claims=JSON.parse(atob(part));}catch{throw new HttpError(401,'Invalid session.');}
    requireValue(claims.aal==='aal2','Verify your authenticator code before opening the dashboard.',403);
  }
  return user;
}
async function limited(db,key,limit,seconds=60){requireValue(await rpc(db,'api_rate_limit',{p_key:key,p_limit:limit,p_seconds:seconds}),'Too many requests. Please try later.',429);}
async function gateway(env,path,options={}){
  requireValue(env.RAZORPAY_KEY_ID&&env.RAZORPAY_KEY_SECRET,'Payment gateway is not configured.',503);
  const response=await fetch(`https://api.razorpay.com/v1/${path}`,{...options,headers:{Authorization:`Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`,'Content-Type':'application/json'},body:options.body?JSON.stringify(options.body):undefined,signal:AbortSignal.timeout(12000)});
  requireValue(response.ok,'Payment provider could not process this request.',502);return response.json();
}
const eq=v=>encodeURIComponent(String(v));
async function transaction(db,order){const rows=await db(`payment_transactions?gateway_order_id=eq.${eq(order)}&limit=1`);requireValue(rows?.[0],'Payment order not found.',404);return rows[0];}
async function confirmPayment(db,env,order,paymentId){
  const payment=await gateway(env,`payments/${eq(paymentId)}`);
  requireValue(payment.order_id===order,'Payment order mismatch.');
  if(payment.status!=='captured')return {status:'pending',message:'Awaiting payment capture. Check My Account shortly.'};
  return rpc(db,'capture_payment',{p_order:order,p_payment:payment.id,p_amount:payment.amount,p_currency:payment.currency,p_method:payment.method||''});
}
async function createCheckout(body,user,db,env){
  requireValue(env.PAYMENTS_ENABLED==='true','Online payments are not enabled yet.',503);
  const input=checkoutInput(body);
  const old=await db(`checkout_intents?id=eq.${input.requestId}&limit=1`);
  if(old.length){
    requireValue(old[0].user_id===user.id && canonical(old[0].request)===canonical(input), 'Checkout already exists with different details.',409);
    requireValue(old[0].state==='ready','This checkout is awaiting reconciliation. Do not pay again; contact support with the request ID.',409);
    const [saved]=await db(`payment_transactions?id=eq.${old[0].transaction_id}`);
    return {key:env.RAZORPAY_KEY_ID,orderId:saved.gateway_order_id,amount:saved.amount,currency:saved.currency,name:saved.item_name,status:saved.status};
  }
  const [price]=await db(`catalog_prices?kind=eq.${input.kind}&slug=eq.${eq(input.slug)}&variant=eq.${eq(input.variant)}&active=is.true&limit=1`);
  requireValue(price&&Number.isSafeInteger(Number(price.unit_amount)),'This item or consultation does not have an approved online price yet.',409);
  if(input.kind==='consultation'){
    const [c]=await db(`consultation_requests?id=eq.${input.consultationId}&user_id=eq.${user.id}&limit=1`);
    requireValue(c&&c.service===input.slug&&c.related_service===input.variant,'Consultation not found.',404);
    const [a]=await db(`appointments?id=eq.${c.appointment_id}`);
    requireValue(a?.status==='held'&&Date.parse(a.hold_expires_at)>Date.now()+30000,'Your reservation expired. Choose another time.',409);
    const paid=await db(`payment_transactions?kind=eq.consultation&metadata->>consultationId=eq.${c.id}&status=in.(created,authorized,paid)&limit=1`);
    requireValue(!paid.length,'A payment attempt already exists for this consultation. Use the existing checkout or contact support.',409);
  }
  const amount=Number(price.unit_amount)*input.quantity+Number(price.shipping_amount);
  requireValue(Number.isSafeInteger(amount)&&amount>0&&amount<=100000000,'Invalid order amount.');
  await db('checkout_intents',{method:'POST',body:{id:input.requestId,user_id:user.id,request:input}});
  const receipt=`SIAOS-${input.requestId.replace(/-/g,'')}`;
  // After any network ambiguity keep the intent locked for manual reconciliation.
  // Never issue another provider order for the same request ID.
  const order=await gateway(env,'orders',{method:'POST',body:{amount,currency:'INR',receipt,notes:{checkout_request:input.requestId}}});
  requireValue(order.id&&order.amount===amount&&order.currency==='INR','Unexpected payment provider response.',502);
  const [saved]=await db('payment_transactions',{method:'POST',body:{user_id:user.id,gateway:'razorpay',gateway_order_id:order.id,receipt,kind:input.kind,item_slug:input.slug,item_name:price.name,quantity:input.quantity,amount,currency:'INR',metadata:{variant:input.variant,address:input.address||{},consultationId:input.consultationId||null,shippingAmount:Number(price.shipping_amount),requestId:input.requestId}}});
  await db(`checkout_intents?id=eq.${input.requestId}`,{method:'PATCH',body:{state:'ready',transaction_id:saved.id}});
  return {key:env.RAZORPAY_KEY_ID,orderId:order.id,amount,currency:'INR',name:price.name,status:'created'};
}
async function webhook(request,env,db){
  requireValue(env.RAZORPAY_WEBHOOK_SECRET,'Webhook not configured.',503);
  const raw=await readBody(request,128000);
  requireValue(equalSignature(await hmac(env.RAZORPAY_WEBHOOK_SECRET,raw),request.headers.get('x-razorpay-signature')),'Invalid webhook signature.',401);
  let event;try{event=JSON.parse(raw);}catch{throw new HttpError(400,'Invalid webhook JSON.');}
  const eventKey=request.headers.get('x-razorpay-event-id')||await hmac(env.RAZORPAY_WEBHOOK_SECRET,raw);
  const [existing]=await db(`payment_webhook_events?event_key=eq.${eq(eventKey)}&limit=1`);
  if(existing?.processed_at)return {received:true};
  if(!existing) await db('payment_webhook_events?on_conflict=event_key',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:{event_key:eventKey,event_type:String(event.event).slice(0,80)}});
  const p=event.payload?.payment?.entity;
  if(['payment.captured','order.paid'].includes(event.event)){
    requireValue(p?.id&&p?.order_id,'Missing payment payload.');
    await confirmPayment(db,env,p.order_id,p.id);
  }else if(event.event==='refund.processed'){
    const r=event.payload?.refund?.entity;requireValue(r?.payment_id,'Missing refund payload.');
    const current=await gateway(env,`payments/${eq(r.payment_id)}`);
    if(current.amount_refunded===current.amount)await rpc(db,'record_full_refund',{p_payment:current.id,p_amount:current.amount});
    else await db(`payment_transactions?gateway_payment_id=eq.${eq(current.id)}`,{method:'PATCH',body:{raw_status:'partial_refund_requires_review',updated_at:new Date().toISOString()}});
  }else if(event.event==='payment.failed'&&p?.order_id){
    await db(`payment_transactions?gateway_order_id=eq.${eq(p.order_id)}&status=in.(created,authorized)`,{method:'PATCH',body:{raw_status:'payment_attempt_failed',updated_at:new Date().toISOString()}});
  }
  await db(`payment_webhook_events?event_key=eq.${eq(eventKey)}`,{method:'PATCH',body:{processed_at:new Date().toISOString()}});
  return {received:true};
}
export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin');const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim());
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    if(origin&&allowed.includes(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});
    try{
      const url=new URL(request.url);const path=url.pathname;
      if(path!=='/api/webhooks/razorpay')requireValue(!origin||allowed.includes(origin),'Origin not allowed.',403);
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
      if(request.method==='GET'&&path==='/api/health')return new Response(JSON.stringify({status:'ok',payments:env.PAYMENTS_ENABLED==='true',analytics:env.ANALYTICS_ENABLED==='true'}),{headers});
      const db=database(env);let result;
      if(request.method==='POST'&&path==='/api/webhooks/razorpay')result=await webhook(request,env,db);
      else if(request.method==='POST'&&path==='/api/analytics'){
        requireValue(env.ANALYTICS_ENABLED==='true','Analytics disabled.',503);
        requireValue(origin&&allowed.includes(origin),'Analytics requires an allowed origin.',403);
        const event=analyticsInput(await jsonBody(request));
        const ipKey=await hmac(env.SUPABASE_SERVICE_ROLE_KEY,request.headers.get('CF-Connecting-IP')||'unknown');
        await limited(db,`analytics:${ipKey}`,120);
        await db('analytics_events',{method:'POST',body:event});result={accepted:true};
      }else{
        const admin=path.startsWith('/api/admin/');const user=await authenticate(request,env,admin);
        await limited(db,`${admin?'admin':'user'}:${user.id}`,admin?60:30);
        if(request.method==='POST'&&path==='/api/consultations'){
          const b=consultationInput(await jsonBody(request));
          const c=await rpc(db,'save_consultation',{p_user_id:user.id,p_appointment_id:b.appointmentId,p_service:b.service,p_service_name:b.serviceName,p_related_service:b.relatedService,p_details:b.details});result={id:c.id,status:c.status};
        }else if(request.method==='POST'&&path==='/api/payments/create'){
          await limited(db,`checkout:${user.id}`,5,300);result=await createCheckout(await jsonBody(request),user,db,env);
        }else if(request.method==='POST'&&path==='/api/payments/verify'){
          const b=await jsonBody(request);requireValue(/^order_[A-Za-z0-9]+$/.test(b.orderId)&&/^pay_[A-Za-z0-9]+$/.test(b.paymentId),'Invalid payment identifiers.');
          const t=await transaction(db,b.orderId);requireValue(t.user_id===user.id,'Order not found.',404);
          requireValue(equalSignature(await hmac(env.RAZORPAY_KEY_SECRET,`${t.gateway_order_id}|${b.paymentId}`),b.signature),'Invalid payment signature.',400);
          result=await confirmPayment(db,env,t.gateway_order_id,b.paymentId);
        }else if(request.method==='GET'&&path==='/api/admin/summary'){
          result=await rpc(db,'admin_dashboard_summary',{requested_days:30});
        }else if(request.method==='GET'&&path==='/api/admin/records'){
          const name=url.searchParams.get('type');requireValue(Object.hasOwn(REPORTS,name),'Invalid report.');
          const offset=Number(url.searchParams.get('offset')||0);requireValue(Number.isInteger(offset)&&offset>=0&&offset<=1000000,'Invalid page.');
          const spec=REPORTS[name];let filter='';
          if(name==='calendar'&&url.searchParams.has('date')){
            const date=url.searchParams.get('date');requireValue(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date)),'Invalid date.');
            const start=new Date(`${date}T00:00:00+05:30`);const end=new Date(+start+86400000);
            filter=`&start_at=gte.${eq(start.toISOString())}&start_at=lt.${eq(end.toISOString())}`;
          }
          const rows=await db(`${spec.table}?select=${spec.select}&order=${spec.order}&limit=100&offset=${offset}${filter}`);
          await db('admin_audit_log',{method:'POST',body:{user_id:user.id,action:'view_records',target:name}});
          result={rows,offset,hasMore:rows.length===100};
        }else if(request.method==='POST'&&path==='/api/admin/sheets-sync'){
          await db('admin_audit_log',{method:'POST',body:{user_id:user.id,action:'sheets_sync_requested'}});result=await syncSheets(env,db);
        }else throw new HttpError(404,'Endpoint not found.');
      }
      return new Response(JSON.stringify(result),{headers});
    }catch(error){return new Response(JSON.stringify({error:error instanceof HttpError?error.message:'The service could not complete this request. Please retry or contact support.'}),{status:error instanceof HttpError?error.status:500,headers});}
  },
  async scheduled(_event,env,ctx){ctx.waitUntil(syncSheets(env,database(env)));}
};
