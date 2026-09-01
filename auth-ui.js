(() => {
  const account = window.SIAOSAccount;
  if (!account || document.body.classList.contains('auth-page') || document.body.classList.contains('account-page')) return;
  const next = `${location.pathname.split('/').pop() || 'index.html'}${location.search}${location.hash}`;
  const nav = document.querySelector('.nav');
  let promptTimer;

  function injectAccountLink(session) {
    if (!nav) return;
    let link = nav.querySelector('.account-nav-link');
    if (!link) {
      link = document.createElement('a'); link.className = 'account-nav-link';
      const menu = nav.querySelector('.menu,.hamburger,.dots'); nav.insertBefore(link,menu || null);
    }
    link.href = session ? 'account.html' : `login.html?mode=signin&next=${encodeURIComponent(next)}`;
    link.textContent = session ? 'My Account' : 'Sign In';
  }

  function closePrompt() {
    document.querySelector('.account-prompt')?.remove(); document.body.classList.remove('account-prompt-open');
    sessionStorage.setItem('siaosAccountPromptDismissed','1');
  }

  function showPrompt() {
    if (document.querySelector('.account-prompt') || sessionStorage.getItem('siaosAccountPromptDismissed')) return;
    const shell = document.createElement('div'); shell.className = 'account-prompt'; shell.innerHTML = `<div class="account-prompt-backdrop" data-close-account-prompt></div><section class="account-prompt-card" role="dialog" aria-modal="true" aria-labelledby="accountPromptTitle"><button class="account-prompt-close" type="button" aria-label="Close" data-close-account-prompt>×</button><img src="assets/siaos-official-logo.png" alt="Official SIAOS crest"><span class="kicker">Keep your guidance together</span><h2 id="accountPromptTitle">Save your readings<br><em>in one private place.</em></h2><p>Create a phone-secured account to keep previous Mulank and Tarot readings and reopen purchased reports during their 15-day access period.</p><div class="account-prompt-actions"><a class="btn fill" href="login.html?mode=signup&next=${encodeURIComponent(next)}">Create Account</a><a class="btn" href="login.html?mode=signin&next=${encodeURIComponent(next)}">Sign In</a></div><button class="account-prompt-later" type="button" data-close-account-prompt>Continue without signing in</button></section>`;
    document.body.append(shell); document.body.classList.add('account-prompt-open');
    shell.querySelectorAll('[data-close-account-prompt]').forEach(button => button.addEventListener('click',closePrompt));
    shell.querySelector('.account-prompt-close')?.focus();
  }

  async function start() {
    const session = await account.getSession(); injectAccountLink(session); await account.captureExistingReadings();
    if (!session && !sessionStorage.getItem('siaosAccountPromptDismissed')) {
      const immediate = new URLSearchParams(location.search).get('authPrompt') === '1';
      promptTimer = setTimeout(showPrompt,immediate ? 300 : Number(window.SIAOS_AUTH_CONFIG?.promptDelayMs || 35000));
    }
  }
  account.onAuthChange(session => {clearTimeout(promptTimer);injectAccountLink(session);if(session)document.querySelector('.account-prompt')?.remove();});
  start().catch(() => injectAccountLink(null));
})();
