(() => {
  window.SIAOSApi = async (path, options={}) => {
    const base=String(window.SIAOS_AUTH_CONFIG?.backendUrl||'').replace(/\/$/,'');
    if(!base)throw new Error('The secure backend is not configured yet. Please contact SIAOS.');
    const session=await window.SIAOSAccount?.getAdminSession();
    if(!session?.access_token)throw new Error('This protected backend action is not available through the public browser account.');
    const response=await fetch(base+'/api/'+path,{...options,headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token,...options.headers},body:options.body===undefined?undefined:JSON.stringify(options.body)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'The request could not be completed.');
    return data;
  };
})();
