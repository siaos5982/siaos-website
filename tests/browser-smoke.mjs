// Optional local UI smoke tests. Uses Playwright from CODEX_PRIMARY_RUNTIME_NODE_MODULES.
// All external requests are mocked; these tests do not contact live services.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));
const root=process.cwd();
const server=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}const body=await readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(body);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
  const context=await browser.newContext();
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/auth-config.js')return route.fulfill({contentType:'application/javascript',body:'window.SIAOS_AUTH_CONFIG={supabaseUrl:"https://db.test",supabasePublishableKey:"test",backendUrl:"https://api.test",promptDelayMs:1000000};'});
    if(url.hostname==='cdn.jsdelivr.net')return route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'test',user:{id:'22222222-2222-4222-8222-222222222222',phone:'+919999999999'}}}}),onAuthStateChange:()=>{},signOut:async()=>({}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'}})}}})};`});
    if(url.hostname==='api.test'){
      const data=url.pathname.endsWith('/summary')?{totals:{page_views:20,visitors:5},business:{consultations:3,paid_orders:2,revenue_paise:110000}}:url.pathname.endsWith('/records')?{rows:[{id:'test',details:{fullName:'<img src=x onerror=alert(1)>',dateOfBirth:'1990-01-01'},status:'new'}],hasMore:false}:{};
      return route.fulfill({contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization,Content-Type'}});
    }
    if(url.origin!==origin)return route.fulfill({status:200,body:''});
    return route.continue();
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/admin.html');await page.waitForSelector('#adminWorkspace:not([hidden])');
  assert.equal(await page.locator('.admin-metrics article').count(),6);
  await page.locator('#recordsTable details').first().click();assert.ok((await page.locator('#recordsTable').textContent()).includes('<img src=x onerror=alert(1)>'));
  assert.equal(await page.locator('#recordsTable img').count(),0);
  await page.locator('#adminCalendar button').first().click();await page.waitForFunction(()=>document.getElementById('recordsHeading').textContent.startsWith('Appointments'));
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile document should not overflow');
  await page.screenshot({path:'/tmp/siaos-admin-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS admin summary, records, safe text rendering, calendar selection and mobile layout (mocked services).');
  await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
