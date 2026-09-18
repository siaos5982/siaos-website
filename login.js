(() => {
  const account = window.SIAOSAccount;
  const phoneStep = document.querySelector('#phoneStep');
  const otpStep = document.querySelector('#otpStep');
  const phoneForm = document.querySelector('#phoneAuthForm');
  const otpForm = document.querySelector('#otpForm');
  const signupFields = document.querySelector('#signupFields');
  const marketingConsent = document.querySelector('#marketingConsent');
  const termsConsent = document.querySelector('#termsConsent');
  const termsInput = document.querySelector('#authTerms');
  const status = document.querySelector('#authStatus');
  const tabs = [...document.querySelectorAll('[data-auth-mode]')];
  const nextUrl = new URLSearchParams(location.search).get('next');
  let mode = new URLSearchParams(location.search).get('mode') === 'signin' ? 'signin' : 'signup';
  let pendingProfile = {};
  let resendAt=0,captchaToken='',captchaWidget;
  const resendButton=document.querySelector('#resendOtp');
  const captchaKey=window.SIAOS_AUTH_CONFIG?.turnstileSiteKey;
  if(captchaKey){
    const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.onload=()=>{captchaWidget=window.turnstile.render('#otpCaptcha',{sitekey:captchaKey,callback:token=>{captchaToken=token;},'expired-callback':()=>{captchaToken='';}});};
    script.onerror=()=>{status.textContent='Security verification could not load. Please refresh.';};document.head.append(script);
  }
  async function requestCode(){
    if(Date.now()<resendAt)throw new Error('Please wait before requesting another code.');
    if(captchaKey&&!captchaToken)throw new Error('Complete the security verification first.');
    const result=await account.sendOtp({mode,countryCode:document.querySelector('#authCountryCode').value,phone:document.querySelector('#authPhone').value,captchaToken});
    resendAt=Date.now()+60000;captchaToken='';if(captchaWidget!==undefined)window.turnstile.reset(captchaWidget);return result;
  }
  setInterval(()=>{const seconds=Math.max(0,Math.ceil((resendAt-Date.now())/1000));resendButton.disabled=seconds>0;resendButton.textContent=seconds?'Resend in '+seconds+'s':'Resend OTP';},1000);
  resendButton.addEventListener('click',async()=>{
    if(captchaKey){otpStep.hidden=true;phoneStep.hidden=false;setStatus('Complete security verification and select Send OTP again.');return;}
    resendButton.disabled=true;try{await requestCode();setStatus('A new code has been sent.','success');}catch(error){setStatus(error.message,'error');}
  });

  const safeNext = () => {
    try {
      const target = new URL(nextUrl || 'account.html', location.href);
      return target.origin === location.origin && /\.html$/.test(target.pathname) ? target.pathname + target.search + target.hash : 'account.html';
    } catch { return 'account.html'; }
  };
  const setStatus = (message,tone='') => { status.textContent = message; status.className = `auth-status ${tone}`.trim(); };
  const setMode = value => {
    mode = value;
    tabs.forEach(tab => { const active=tab.dataset.authMode===mode; tab.classList.toggle('active',active); tab.setAttribute('aria-selected',String(active)); });
    const signup = mode === 'signup';
    signupFields.hidden = !signup; marketingConsent.hidden = !signup; termsConsent.hidden = !signup;
    document.querySelector('#authFullName').required = signup;
    termsInput.required = signup;
    document.querySelector('#authKicker').textContent = signup ? 'New member' : 'Welcome back';
    document.querySelector('#authTitle').textContent = signup ? 'Create your account' : 'Sign in to your account';
    document.querySelector('#authIntro').textContent = signup ? 'Enter your details and we’ll send a secure one-time code to your phone.' : 'Enter your registered mobile number to receive a secure one-time code.';
    setStatus('');
  };
  tabs.forEach(tab => tab.addEventListener('click',() => setMode(tab.dataset.authMode)));

  const developerAccess=document.querySelector('#developerAccess');
  developerAccess.hidden=!(account?.isLocalPreview && window.SIAOS_AUTH_CONFIG?.developerPreviewEnabled);
  document.querySelector('#developerLogin').addEventListener('click',async()=>{const button=document.querySelector('#developerLogin');button.disabled=true;setStatus('Opening the developer preview…');try{await account.developerLogin();setStatus('Developer preview ready.','success');location.replace(safeNext());}catch(error){setStatus(error.message||'Developer preview could not be opened.','error');button.disabled=false;}});

  account?.getSession().then(session => { if (session) location.replace(safeNext()); });

  phoneForm.addEventListener('submit',async event => {
    event.preventDefault(); if (!phoneForm.reportValidity()) return;
    const button = phoneForm.querySelector('button[type="submit"]'); button.disabled = true; setStatus('Sending your secure code…');
    pendingProfile = {mode,fullName:document.querySelector('#authFullName').value.trim(),email:document.querySelector('#authEmail').value.trim(),marketingOptIn:document.querySelector('#authMarketing').checked};
    try {
      const result = await requestCode();
      document.querySelector('#otpPhone').textContent = result.phone;
      document.querySelector('#demoOtpHint').hidden = !result.demoCode;
      phoneStep.hidden = true; otpStep.hidden = false; setStatus('Code sent. It expires shortly.','success'); document.querySelector('#authOtp').focus();
    } catch (error) { setStatus(error.message || 'The OTP could not be sent.','error'); }
    finally { button.disabled = false; }
  });

  otpForm.addEventListener('submit',async event => {
    event.preventDefault(); if (!otpForm.reportValidity()) return;
    const button=otpForm.querySelector('button[type="submit"]'); button.disabled=true; setStatus('Verifying your code…');
    try { await account.verifyOtp({token:document.querySelector('#authOtp').value,profile:pendingProfile}); setStatus('Verified. Opening your account…','success'); location.replace(safeNext()); }
    catch(error){setStatus(error.message || 'The code could not be verified.','error');button.disabled=false;}
  });
  document.querySelector('#changePhone').addEventListener('click',() => {otpStep.hidden=true;phoneStep.hidden=false;document.querySelector('#authOtp').value='';setStatus('');});
  setMode(mode);
})();
