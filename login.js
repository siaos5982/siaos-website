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

  const params = new URLSearchParams(location.search);

  const nextUrl = params.get('next');
  const testMode = params.get('test') === '1';

  let mode =
    params.get('mode') === 'signin'
      ? 'signin'
      : 'signup';

  let pendingProfile = {};

  const safeNext = () =>
    nextUrl &&
    !nextUrl.includes('://') &&
    !nextUrl.startsWith('//')
      ? nextUrl
      : 'account.html';

  const setStatus = (message, tone = '') => {
    if (!status) return;

    status.textContent = message;
    status.className = `auth-status ${tone}`.trim();
  };

  const setMode = value => {
    mode = value;

    tabs.forEach(tab => {
      const active = tab.dataset.authMode === mode;

      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });

    const signup = mode === 'signup';

    if (signupFields) signupFields.hidden = !signup;
    if (marketingConsent) marketingConsent.hidden = !signup;
    if (termsConsent) termsConsent.hidden = !signup;

    const fullName = document.querySelector('#authFullName');

    if (fullName) {
      fullName.required = signup;
    }

    if (termsInput) {
      termsInput.required = signup;
    }

    const kicker = document.querySelector('#authKicker');
    const title = document.querySelector('#authTitle');
    const intro = document.querySelector('#authIntro');

    if (kicker) {
      kicker.textContent =
        signup
          ? 'New member'
          : 'Welcome back';
    }

    if (title) {
      title.textContent =
        signup
          ? 'Create your account'
          : 'Sign in to your account';
    }

    if (intro) {
      intro.textContent =
        signup
          ? 'Enter your details and we’ll send a secure one-time code to your phone.'
          : 'Enter your registered mobile number to receive a secure one-time code.';
    }

    setStatus('');
  };



  /* =========================================
     TEST LOGIN MODE
     login.html?test=1
     ========================================= */

  const testLoginSection =
    document.querySelector('#testLoginSection');

  const normalAuthSection =
    document.querySelector('#normalAuthSection');

  const testLoginForm =
    document.querySelector('#testLoginForm');

  const testLoginStatus =
    document.querySelector('#testLoginStatus');


  const setTestStatus = (message, tone = '') => {
    if (!testLoginStatus) return;

    testLoginStatus.textContent = message;
    testLoginStatus.className =
      `auth-status ${tone}`.trim();
  };


  if (testMode) {

    if (testLoginSection) {
      testLoginSection.hidden = false;
    }

    if (normalAuthSection) {
      normalAuthSection.hidden = true;
    }

  } else {

    if (testLoginSection) {
      testLoginSection.hidden = true;
    }

    if (normalAuthSection) {
      normalAuthSection.hidden = false;
    }

  }


  if (testLoginForm) {

    testLoginForm.addEventListener(
      'submit',
      event => {

        event.preventDefault();

        const user =
          document
            .querySelector('#testUser')
            ?.value
            .trim();

        const password =
          document
            .querySelector('#testPassword')
            ?.value;


        if (
          user === 'test@siaos.in' &&
          password === 'SIAOS1234'
        ) {

          localStorage.setItem(
            'siaos_test_login',
            'true'
          );

          localStorage.setItem(
            'siaos_test_user',
            JSON.stringify({
              name: 'SIAOS Test User',
              email: 'test@siaos.in',
              testAccount: true
            })
          );

          setTestStatus(
            'Test login successful. Opening your account…',
            'success'
          );

          setTimeout(() => {
            location.replace(safeNext());
          }, 400);

        } else {

          setTestStatus(
            'Invalid test ID or password.',
            'error'
          );

        }

      }
    );

  }



  /* =========================================
     NORMAL OTP LOGIN
     ========================================= */

  tabs.forEach(tab => {
    tab.addEventListener(
      'click',
      () => setMode(tab.dataset.authMode)
    );
  });


  if (!testMode && account?.getSession) {

    account
      .getSession()
      .then(session => {

        if (session) {
          location.replace(safeNext());
        }

      });

  }


  if (phoneForm) {

    phoneForm.addEventListener(
      'submit',
      async event => {

        event.preventDefault();

        if (!phoneForm.reportValidity()) {
          return;
        }

        const button =
          phoneForm.querySelector(
            'button[type="submit"]'
          );

        if (button) {
          button.disabled = true;
        }

        setStatus(
          'Sending your secure code…'
        );


        pendingProfile = {

          mode,

          fullName:
            document
              .querySelector('#authFullName')
              ?.value
              .trim() || '',

          email:
            document
              .querySelector('#authEmail')
              ?.value
              .trim() || '',

          marketingOptIn:
            document
              .querySelector('#authMarketing')
              ?.checked || false

        };


        try {

          if (!account?.sendOtp) {
            throw new Error(
              'OTP service is not configured yet.'
            );
          }


          const result =
            await account.sendOtp({

              mode,

              countryCode:
                document
                  .querySelector('#authCountryCode')
                  ?.value,

              phone:
                document
                  .querySelector('#authPhone')
                  ?.value

            });


          const otpPhone =
            document.querySelector('#otpPhone');

          if (otpPhone) {
            otpPhone.textContent =
              result.phone;
          }


          const demoOtpHint =
            document.querySelector(
              '#demoOtpHint'
            );

          if (demoOtpHint) {
            demoOtpHint.hidden =
              !result.demoCode;
          }


          if (phoneStep) {
            phoneStep.hidden = true;
          }

          if (otpStep) {
            otpStep.hidden = false;
          }


          setStatus(
            'Code sent. It expires shortly.',
            'success'
          );


          document
            .querySelector('#authOtp')
            ?.focus();


        } catch (error) {

          setStatus(
            error.message ||
            'The OTP could not be sent.',
            'error'
          );

        } finally {

          if (button) {
            button.disabled = false;
          }

        }

      }
    );

  }



  /* =========================================
     VERIFY OTP
     ========================================= */

  if (otpForm) {

    otpForm.addEventListener(
      'submit',
      async event => {

        event.preventDefault();

        if (!otpForm.reportValidity()) {
          return;
        }

        const button =
          otpForm.querySelector(
            'button[type="submit"]'
          );

        if (button) {
          button.disabled = true;
        }


        setStatus(
          'Verifying your code…'
        );


        try {

          if (!account?.verifyOtp) {
            throw new Error(
              'OTP verification is not configured yet.'
            );
          }


          await account.verifyOtp({

            token:
              document
                .querySelector('#authOtp')
                ?.value,

            profile:
              pendingProfile

          });


          setStatus(
            'Verified. Opening your account…',
            'success'
          );


          location.replace(
            safeNext()
          );


        } catch (error) {

          setStatus(
            error.message ||
            'The code could not be verified.',
            'error'
          );

          if (button) {
            button.disabled = false;
          }

        }

      }
    );

  }



  /* =========================================
     CHANGE PHONE NUMBER
     ========================================= */

  const changePhone =
    document.querySelector('#changePhone');

  if (changePhone) {

    changePhone.addEventListener(
      'click',
      () => {

        if (otpStep) {
          otpStep.hidden = true;
        }

        if (phoneStep) {
          phoneStep.hidden = false;
        }

        const otpInput =
          document.querySelector('#authOtp');

        if (otpInput) {
          otpInput.value = '';
        }

        setStatus('');

      }
    );

  }


  setMode(mode);

})();
