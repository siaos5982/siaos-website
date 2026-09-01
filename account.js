(() => {
  const account = window.SIAOSAccount;
  const readingTarget = document.querySelector('#readingHistory');
  const reportTarget = document.querySelector('#reportHistory');
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g,character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
  const formatDate = value => new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));
  const daysRemaining = value => Math.max(0,Math.ceil((new Date(value)-new Date())/86400000));
  const readingSummary = item => {
    if (item.readingType === 'compatibility') return `${item.summary?.score ?? '—'}% compatibility · Mulank ${item.summary?.yourMulank ?? '—'} & ${item.summary?.partnerMulank ?? '—'}`;
    if (item.readingType === 'tarot') return `${item.summary?.card || 'Tarot card'} · ${item.summary?.question || 'Personal question'}`;
    return Object.values(item.summary || {}).join(' · ') || 'Saved SIAOS guidance';
  };
  const renderReadings = readings => {
    document.querySelector('#readingCount').textContent = readings.length;
    readingTarget.innerHTML = readings.length ? readings.map(item => `<article class="history-card"><span class="history-type">${escapeHtml(item.readingType)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(readingSummary(item))}</p><time>${escapeHtml(formatDate(item.createdAt))}</time><a href="saved-reading.html?id=${encodeURIComponent(item.id)}">Open Reading →</a></article>`).join('') : `<div class="account-empty"><h3>No saved readings yet</h3><p>Your future Mulank compatibility and Tarot readings will appear here after you complete them while signed in.</p><a class="btn fill" href="index.html#compatibility">Try the Mulank Calculator</a></div>`;
  };
  const renderReports = reports => {
    const active = reports.filter(report => report.status === 'paid' && new Date(report.accessExpiresAt) > new Date());
    document.querySelector('#activeReportCount').textContent = active.length;
    reportTarget.innerHTML = reports.length ? reports.map(report => {
      const open = report.status === 'paid' && new Date(report.accessExpiresAt) > new Date();
      return `<article class="history-card report-history-card ${open ? 'active' : 'expired'}"><span class="history-type">${escapeHtml(report.reportType || 'Purchased report')}</span><h3>${escapeHtml(report.title)}</h3><p>${open ? `${daysRemaining(report.accessExpiresAt)} day${daysRemaining(report.accessExpiresAt)===1?'':'s'} of access remaining` : 'The 15-day access period has ended'}</p><time>Purchased ${escapeHtml(formatDate(report.purchasedAt))}</time>${open ? `<a class="report-open" href="saved-report.html?id=${encodeURIComponent(report.id)}">Open Report →</a>` : '<span class="report-expired">Expired</span>'}</article>`;
    }).join('') : `<div class="account-empty"><h3>No purchased reports yet</h3><p>Reports confirmed through the secure payment system will appear here with their exact 15-day access period.</p></div>`;
  };
  async function loadAccount() {
    try {
      const session = await account.getSession();
      if (!session) { location.replace(`login.html?mode=signin&next=${encodeURIComponent('account.html')}`); return; }
      await account.captureExistingReadings();
      const [profile,readings,reports] = await Promise.all([account.getProfile(),account.getReadings(),account.getReports()]);
      document.querySelector('#accountName').textContent = profile?.fullName || profile?.full_name || session.user.user_metadata?.full_name || 'SIAOS Member';
      renderReadings(readings); renderReports(reports);
    } catch (error) {
      readingTarget.innerHTML = `<p class="account-error">${escapeHtml(error.message || 'Your account could not be loaded.')}</p>`;
      reportTarget.innerHTML = '';
    }
  }
  document.querySelector('#accountSignOut').addEventListener('click',async () => {await account.signOut();location.replace('index.html');});
  loadAccount();
})();
