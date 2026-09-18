(() => {
  if(window.SIAOSAnalytics)return;
  const base=String(window.SIAOS_AUTH_CONFIG?.backendUrl||'').replace(/\/$/,'');
  if(!base)return;
  const key='siaosAnalyticsConsentV1';let accepted=false,anonymousId='',sessionId='';
  const read=()=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
  const saved=read();accepted=saved?.accepted===true && saved.expires>Date.now();
  const panel=document.createElement('aside');panel.setAttribute('aria-label','Optional visitor analytics');
  panel.style.cssText='position:fixed;bottom:14px;left:14px;right:14px;max-width:620px;padding:18px;background:#fffaf0;border:1px solid #b7a373;box-shadow:0 5px 24px #0002;z-index:10000;color:#29251d;font:14px/1.5 sans-serif';
  panel.innerHTML='<p>Allow optional analytics? SIAOS can record anonymous page visits, button interactions, device category and referring website in its restricted dashboard and Google Sheets. We do not record form contents, precise location or payment credentials. You can decline without affecting purchases.</p><button type="button" data-choice="yes">Allow analytics</button> <button type="button" data-choice="no">Decline</button>';
  const settings=document.createElement('button');settings.textContent='Analytics preferences';settings.type='button';settings.style.cssText='position:fixed;bottom:0;left:0;z-index:9999;font-size:11px;padding:4px 8px';settings.onclick=()=>{panel.hidden=false;};
  document.body.append(panel,settings);panel.hidden=Boolean(saved&&saved.expires>Date.now());
  function identifiers(){
    if(!accepted)return;
    anonymousId=localStorage.getItem('siaosAnalyticsId')||crypto.randomUUID();localStorage.setItem('siaosAnalyticsId',anonymousId);
    sessionId=sessionStorage.getItem('siaosAnalyticsSession')||crypto.randomUUID();sessionStorage.setItem('siaosAnalyticsSession',sessionId);
  }
  async function track(event_name,target='',depth){
    if(!accepted||document.visibilityState==='hidden')return;
    try{await fetch(base+'/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:true,event_name,target,depth,path:location.pathname,referrer:document.referrer,anonymous_id:anonymousId,session_id:sessionId,device:innerWidth<768?'mobile':innerWidth<1024?'tablet':'desktop'}),keepalive:true});}catch{}
  }
  panel.querySelectorAll('button').forEach(button=>button.onclick=()=>{
    accepted=button.dataset.choice==='yes';localStorage.setItem(key,JSON.stringify({accepted,expires:Date.now()+180*86400000}));panel.hidden=true;
    if(accepted){identifiers();track('page_view');}else{localStorage.removeItem('siaosAnalyticsId');sessionStorage.removeItem('siaosAnalyticsSession');anonymousId='';sessionId='';}
  });
  identifiers();track('page_view');
  const knownTargets=new Set(['productBuyButton','blogLoadMore','mainService','subService','compatibilityForm']);
  document.addEventListener('click',event=>{const target=event.target.closest('button,a');if(target&&knownTargets.has(target.id))track('click',target.id);});
  const forms=new Set();document.addEventListener('focusin',event=>{const form=event.target.closest('form');if(form&&['compatibilityForm','serviceForm'].includes(form.id)&&!forms.has(form.id)){forms.add(form.id);track('form_start',form.id);}});
  const depths=new Set();addEventListener('scroll',()=>{if(!accepted)return;const height=document.documentElement.scrollHeight-innerHeight;if(height<=0)return;const depth=Math.min(100,Math.floor(scrollY/height*4)*25);if(depth>=25&&!depths.has(depth)){depths.add(depth);track('scroll_depth','',depth);}},{passive:true});
  window.SIAOSAnalytics={track};
})();
