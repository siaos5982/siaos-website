(() => {
  const summaryTarget = document.querySelector('#paymentSummary');
  const checkoutTarget = document.querySelector('#paymentCheckout');
  const backTop = document.querySelector('#paymentBackTop');
  const kicker = document.querySelector('#paymentKicker');
  const title = document.querySelector('#paymentTitle');
  const intro = document.querySelector('#paymentIntro');
  const params = new URLSearchParams(window.location.search);
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));

  const safeSessionJson = key => {
    try {
      return JSON.parse(sessionStorage.getItem(key));
    } catch {
      return null;
    }
  };

  const renderCompatibilityReport = () => {
    const report = safeSessionJson('siaosCompatibility');

    document.title = '₹99 Compatibility Report | SIAOS';
    kicker.textContent = 'Private Report';
    title.textContent = 'Unlock your compatibility report';
    intro.textContent = 'Continue securely to request the complete numerology guidance prepared from both dates of birth.';
    backTop.href = 'index.html#compatibility';
    backTop.textContent = 'Back to Compatibility';

    summaryTarget.innerHTML = report ? `
      <span class="kicker">Your saved preview</span>
      <div class="payment-order-grid">
        <div><strong>${escapeHtml(report.score)}%</strong><span>Compatibility score</span></div>
        <div><strong>${escapeHtml(report.yourMulank)} · ${escapeHtml(report.yourBhagyank)}</strong><span>Your Mulank · Bhagyank</span></div>
        <div><strong>${escapeHtml(report.partnerMulank)} · ${escapeHtml(report.partnerBhagyank)}</strong><span>Partner Mulank · Bhagyank</span></div>
      </div>` : `
      <h2>Your ₹99 compatibility report</h2>
      <p>Your preview was not found in this browser. Calculate both numbers first so the report request includes your result.</p>
      <a class="btn fill" href="index.html#compatibility">Calculate Compatibility</a>`;

    checkoutTarget.innerHTML = `
      <span class="kicker">Report access</span>
      <div class="payment-price"><span>Complete report</span><strong>₹99</strong></div>
      <p>The secure online payment gateway is being connected. Once enabled, this report will be attached to your signed-in account and remain available there for 15 days after payment confirmation.</p>
      <div class="payment-action-row">
        <button class="btn fill" type="button" disabled>Secure Checkout Coming Next</button>
        <a class="btn" href="index.html#compatibility">Return to Preview</a>
      </div>
      <small class="payment-security-note">No card or banking details are collected on this website.</small>`;
  };

  const renderConsultation = () => {
    const booking = safeSessionJson('siaosBooking');
    summaryTarget.innerHTML = booking ? `
      <span class="kicker">Selected consultation</span>
      <h2>${escapeHtml(booking.serviceName)}</h2>
      <p>Your completed details are ready. Payment choices will be connected in the next update.</p>` : `
      <h2>No consultation selected</h2>
      <p>Please choose a service and complete its form first.</p>
      <a class="btn fill" href="booking.html">Choose a Service</a>`;

    checkoutTarget.innerHTML = `
      <span class="kicker">Payment setup</span>
      <h2>Payment options will be added next</h2>
      <p>No payment will be taken on this page yet. Your selected service and completed form are ready for the payment card integration.</p>
      <a class="btn" href="booking.html">Back to Booking</a>`;
  };

  const requireAccount = async () => {
    const session = await window.SIAOSAccount?.getSession();
    if (session) return true;
    document.title = 'Sign In Before Payment | SIAOS';
    kicker.textContent = 'Private checkout';
    title.textContent = 'Sign in before payment';
    intro.textContent = 'Your purchase must be connected to your account so only you can reopen the report during its 15-day access period.';
    summaryTarget.innerHTML = `<h2>Keep this purchase with your account</h2><p>Use your phone-secured SIAOS account before continuing. Your current reading will remain saved in this browser.</p>`;
    const next = `${location.pathname.split('/').pop()}${location.search}`;
    checkoutTarget.innerHTML = `<span class="kicker">Account required</span><h2>Continue securely</h2><p>After signing in, you will return directly to this payment page.</p><div class="payment-action-row"><a class="btn fill" href="login.html?mode=signin&next=${encodeURIComponent(next)}">Sign In</a><a class="btn" href="login.html?mode=signup&next=${encodeURIComponent(next)}">Create Account</a></div>`;
    return false;
  };

  (async () => {
    try {
      if (!await requireAccount()) return;
      await window.SIAOSAccount.captureExistingReadings();
      if (params.get('product') === 'compatibility-report') renderCompatibilityReport();
      else renderConsultation();
    } catch (error) {
      checkoutTarget.innerHTML = `<h2>Checkout could not be opened</h2><p>${escapeHtml(error.message || 'Please try again.')}</p>`;
    }
  })();
})();
