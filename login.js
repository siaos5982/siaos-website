(() => {
  const account = window.SIAOSAccount;
  const form = document.querySelector('#accountAccessForm');
  const signupFields = document.querySelector('#signupFields');
  const marketingConsent = document.querySelector('#marketingConsent');
  const termsConsent = document.querySelector('#termsConsent');
  const termsInput = document.querySelector('#authTerms');
  const status = document.querySelector('#authStatus');
  const tabs = [...document.querySelectorAll('[data-auth-mode]')];
  const nextUrl = new URLSearchParams(location.search).get('next');
  let mode = new URLSearchParams(location.search).get('mode') === 'signin' ? 'signin' : 'signup';

  const safeNext = () => {
    try {
      const target = new URL(nextUrl || 'account.html', location.href);
      return target.origin === location.origin && /\.html$/.test(target.pathname) ? target.pathname + target.search + target.hash : 'account.html';
    } catch { return 'account.html'; }
  };

  const setStatus = (message,tone='') => {
    status.textContent = message;
    status.className = `auth-status ${tone}`.trim();
  };

  const setMode = value => {
    mode = value;
    tabs.forEach(tab => {
      const active=tab.dataset.authMode===mode;
      tab.classList.toggle('active',active);
      tab.setAttribute('aria-selected',String(active));
    });
    const signup = mode === 'signup';
    signupFields.hidden = !signup;
    marketingConsent.hidden = !signup;
    termsConsent.hidden = !signup;
    document.querySelector('#authFullName').required = signup;
    termsInput.required = signup;
    document.querySelector('#authKicker').textContent = signup ? 'New member' : 'Welcome back';
    document.querySelector('#authTitle').textContent = signup ? 'Create your account' : 'Open your account';
    document.querySelector('#authIntro').textContent = signup ? 'Enter your details to open your SIAOS account immediately.' : 'Enter your email and mobile number to continue immediately.';
    form.querySelector('.auth-submit').textContent = signup ? 'Create Account' : 'Continue to Account';
    setStatus('');
  };

  tabs.forEach(tab => tab.addEventListener('click',() => setMode(tab.dataset.authMode)));
  account?.getSession().then(session => { if (session) location.replace(safeNext()); });

  form.addEventListener('submit',async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    setStatus(mode === 'signup' ? 'Creating your account…' : 'Opening your account…');
    try {
      await account.createAccount({
        mode,
        fullName:document.querySelector('#authFullName').value.trim(),
        email:document.querySelector('#authEmail').value.trim(),
        countryCode:document.querySelector('#authCountryCode').value,
        phone:document.querySelector('#authPhone').value,
        marketingOptIn:document.querySelector('#authMarketing').checked
      });
      setStatus('Account ready. Opening your dashboard…','success');
      location.replace(safeNext());
    } catch (error) {
      setStatus(error.message || 'Your account could not be opened.','error');
      button.disabled = false;
    }
  });

  setMode(mode);
})();
