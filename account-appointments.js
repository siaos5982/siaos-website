(() => {
  const section=document.createElement('section');section.className='account-history-section';
  const heading=document.createElement('h2');heading.textContent='Your consultation appointments';
  const content=document.createElement('div');content.className='account-history-grid';content.setAttribute('aria-live','polite');section.append(heading,content);
  document.querySelector('.account-main')?.append(section);
  (async()=>{
    const account=window.SIAOSAccount,session=await account.getSession();
    if(!session?.access_token||session.demo){content.textContent='Verify your phone number to see live appointments.';return;}
    const {data,error}=await account.client.from('appointments').select('id,service,related_service,start_at,status,hold_expires_at').order('start_at',{ascending:false}).limit(100);
    if(error)throw error;
    if(!data.length){content.textContent='No appointments yet.';return;}
    data.forEach(item=>{const card=document.createElement('article');card.className='history-card';const h=document.createElement('h3');h.textContent=item.related_service;const when=document.createElement('p');when.textContent=new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(item.start_at))+' IST';const status=document.createElement('p');status.textContent=item.status==='held'&&Date.parse(item.hold_expires_at)<=Date.now()?'Reservation expired':item.status==='held'?'Reserved temporarily — payment not confirmed':item.status;card.append(h,when,status);content.append(card);});
  })().catch(error=>{content.textContent=error.message||'Appointments could not be loaded.';});
})();
