import {requireValue,consultationFields,HttpError} from './core.mjs';

export const REPORTS={
  clients:{table:'profiles',select:'user_id,full_name,email,phone,country_code,marketing_opt_in,created_at,updated_at',order:'created_at.asc,user_id.asc'},
  consultations:{table:'consultation_requests',select:'id,user_id,appointment_id,service,service_name,related_service,details,status,consent_at,submitted_at,updated_at',order:'submitted_at.asc,id.asc'},
  calendar:{table:'appointments',select:'id,user_id,service,related_service,consultation_mode,start_at,end_at,status,hold_expires_at,payment_reference,direct_payment_amount,direct_payment_method,direct_payment_reference,confirmed_at,direct_refund_amount,direct_refund_percent,direct_refund_status,direct_refund_reference,consultation_requests(id,details,status)',order:'start_at.asc,id.asc'},
  orders:{table:'product_orders',select:'id,user_id,order_number,payment_reference,payment_status,status,currency,total,items,delivery_address,tracking_reference,ordered_at,updated_at',order:'ordered_at.asc,id.asc'},
  payments:{table:'payment_transactions',select:'id,user_id,gateway_order_id,gateway_payment_id,receipt,kind,item_slug,item_name,quantity,amount,refunded_amount,refund_status,currency,status,raw_status,method,paid_at,created_at',order:'created_at.asc,id.asc'},
  refunds:{table:'refund_requests',select:'id,transaction_id,user_id,appointment_id,source,reason,policy_percent,eligible_amount,gateway_refund_id,status,attempts,last_error,requested_at,processed_at,updated_at',order:'requested_at.asc,id.asc'},
  catalog:{table:'catalog_prices',select:'id,kind,slug,variant,name,unit_amount,shipping_amount,active',order:'kind.asc,slug.asc,variant.asc'},
  readings:{table:'readings',select:'id,user_id,reading_type,title,created_at',order:'created_at.asc,id.asc'},
  visitors:{table:'analytics_events',select:'id,event_name,anonymous_id,session_id,path,referrer,target,metadata,occurred_at',order:'id.asc'},
  reports:{table:'report_purchases',select:'id,user_id,report_type,title,status,purchased_at,access_expires_at',order:'purchased_at.asc,id.asc'}
};
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const text64=text=>b64url(new TextEncoder().encode(text));
async function googleToken(env){
  const credentials=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON||'{}');
  requireValue(credentials.client_email&&credentials.private_key,'Google Sheets service account is not configured.',503);
  const now=Math.floor(Date.now()/1000);
  const header=text64(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const payload=text64(JSON.stringify({iss:credentials.client_email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const pem=credentials.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
  const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=b64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(`${header}.${payload}`))));
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${header}.${payload}.${signature}`}),signal:AbortSignal.timeout(15000)});
  requireValue(response.ok,'Google authorization failed.',502);const data=await response.json();requireValue(data.access_token,'Google authorization failed.',502);return data.access_token;
}
// JSON is exported only from bounded, approved business fields. No raw session/auth objects.
export function sheetRows(name,rows){
  const fields=REPORTS[name].select.split(',').filter(k=>!k.includes('('));
  let clean=rows;
  if(name==='consultations')clean=rows.map(r=>{const {details,...base}=r;return {...base,...Object.fromEntries([...consultationFields].map(k=>[k,details?.[k]||'']))};});
  if(name==='calendar')clean=rows.map(r=>{const {consultation_requests,...base}=r;const c=consultation_requests?.[0];return {...base,clientName:c?.details?.fullName||c?.details?.legalName||'',phone:c?.details?.phone||'',consultationId:c?.id||'',startIndia:new Date(r.start_at).toLocaleString('en-GB',{timeZone:'Asia/Kolkata'}),endIndia:new Date(r.end_at).toLocaleString('en-GB',{timeZone:'Asia/Kolkata'})};});
  const headers=[...new Set(clean.flatMap(r=>Object.keys(r)))];
  if(!headers.length)return [name==='calendar'?['id','user_id','service','start_at','end_at','status']:fields];
  return [headers,...clean.map(r=>headers.map(k=>{const v=r[k];return v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v);} ))];
}
export async function syncSheets(env,db){
  requireValue(env.SHEETS_SYNC_ENABLED==='true'&&/^[A-Za-z0-9_-]+$/.test(env.GOOGLE_SHEET_ID||''),'Google Sheets sync is not enabled.',503);
  const locked=await db('rpc/claim_sheets_sync',{method:'POST',body:{}});requireValue(locked,'A Sheets sync is already in progress.',409);
  try{
    const max=Number(env.SHEETS_MAX_ROWS||10000);requireValue(Number.isInteger(max)&&max>0&&max<=10000,'Invalid export limit.',503);
    const token=await googleToken(env);const root=`https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}`;
    const google=async(path,options={})=>{
      const r=await fetch(root+path,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:options.body?JSON.stringify(options.body):undefined,signal:AbortSignal.timeout(20000)});
      requireValue(r.ok,'Google Sheets write failed; sync can be retried.',502);return r.json();
    };
    const snapshot=await google('?fields=sheets.properties');
    const counts={};
    for(const [name,spec] of Object.entries(REPORTS)){
      const rows=[];
      for(let offset=0;offset<=max;offset+=500){
        const batch=await db(`${spec.table}?select=${spec.select}&order=${spec.order}&limit=500&offset=${offset}`);
        rows.push(...batch);requireValue(rows.length<=max,`The ${name} export exceeds its configured limit; increase capacity before syncing.`,409);
        if(batch.length<500)break;
      }
      const values=sheetRows(name,rows);const title=`SIAOS_${name}`;let existing=snapshot.sheets?.find(s=>s.properties.title===title);
      if(!existing){const added=await google(':batchUpdate',{method:'POST',body:{requests:[{addSheet:{properties:{title,gridProperties:{rowCount:Math.max(values.length,1000),columnCount:Math.max(values[0].length,26)}}}}]}});existing=added.replies[0].addSheet;}
      const rowCount=Math.max(existing.properties.gridProperties.rowCount,values.length);
      const columnCount=Math.max(existing.properties.gridProperties.columnCount,values[0].length);
      await google(':batchUpdate',{method:'POST',body:{requests:[{updateSheetProperties:{properties:{sheetId:existing.properties.sheetId,gridProperties:{rowCount,columnCount,frozenRowCount:1}},fields:'gridProperties'}}]}});
      // RAW prevents customer values beginning with '=' from becoming spreadsheet formulas.
      await google(`/values/${encodeURIComponent(title+'!A1')}?valueInputOption=RAW`,{method:'PUT',body:{majorDimension:'ROWS',values}});
      if(rowCount>values.length)await google(`/values/${encodeURIComponent(title+'!A'+(values.length+1)+':ZZ'+rowCount)}:clear`,{method:'POST',body:{}});
      counts[name]=rows.length;
    }
    await db('integration_jobs?name=eq.sheets',{method:'PATCH',body:{locked_until:null,last_success:new Date().toISOString(),last_error:null}});
    // Expired rate-limit keys need not be retained.
    await db(`api_rate_limits?expires_at=lt.${encodeURIComponent(new Date(Date.now()-86400000).toISOString())}`,{method:'DELETE'});
    return {synced:true,counts};
  }catch(error){
    await db('integration_jobs?name=eq.sheets',{method:'PATCH',body:{locked_until:null,last_error:'Sync failed. Check service permissions, Sheet capacity and configuration.'}}).catch(()=>{});
    throw error instanceof HttpError?error:new HttpError(502,'Google Sheets sync failed. No credentials were logged.');
  }
}
