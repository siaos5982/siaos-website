const services = {
  kundli: 'Kundli Analysis',
  numerology: 'Numerology Analysis',
  vastu: 'Vastu Analysis',
  tarot: 'Tarot Reading',
  face: 'Face Reading',
  paranormal: 'Paranormal Consultation'
};

// Paste the deployed Google Apps Script web-app URL here.
const GOOGLE_SHEETS_WEB_APP_URL = '';

const relatedServices = {
  kundli: ['Complete Birth Chart Analysis','Marriage and Compatibility','Career and Wealth Guidance','Health Indicators','Dasha and Transit Timing','Personalised Remedies'],
  numerology: ['Complete Numerology Analysis','Name Correction','Business Numerology','Phone Number Analysis','Personal Year Guidance','Numerology Compatibility'],
  vastu: ['Residential Property','Commercial Property','Plot or Farm','Industrial Property','Renovation Guidance','Energy Balancing'],
  tarot: ['Single Question Reading','Three Card Reading','Relationship Reading','Career Reading','Decision Reading','Yearly Theme Reading'],
  face: ['Complete Face Reading','Temperament Analysis','Communication Style','Career Tendencies','Relationship Nature','Personal Guidance'],
  paranormal: ['Initial Consultation','Space Energy Review','Negative Energy Cleansing','Personal Aura Cleansing','Protection Guidance','Follow-up Support']
};

const cities = [
  ['Surat','Gujarat','India'],['Ahmedabad','Gujarat','India'],['Vadodara','Gujarat','India'],['Rajkot','Gujarat','India'],['Gandhinagar','Gujarat','India'],['Bhavnagar','Gujarat','India'],['Jamnagar','Gujarat','India'],['Junagadh','Gujarat','India'],['Navsari','Gujarat','India'],['Valsad','Gujarat','India'],['Bharuch','Gujarat','India'],
  ['Mumbai','Maharashtra','India'],['Pune','Maharashtra','India'],['Nashik','Maharashtra','India'],['Nagpur','Maharashtra','India'],['New Delhi','Delhi','India'],['Jaipur','Rajasthan','India'],['Udaipur','Rajasthan','India'],['Indore','Madhya Pradesh','India'],['Bhopal','Madhya Pradesh','India'],['Lucknow','Uttar Pradesh','India'],['Kolkata','West Bengal','India'],['Bengaluru','Karnataka','India'],['Hyderabad','Telangana','India'],['Chennai','Tamil Nadu','India'],['Kochi','Kerala','India'],['Chandigarh','Chandigarh','India'],
  ['Dubai','Dubai','United Arab Emirates'],['London','England','United Kingdom'],['New York','New York','United States'],['Toronto','Ontario','Canada'],['Sydney','New South Wales','Australia'],['Singapore','Singapore','Singapore']
].map(([city,state,country]) => ({city,state,country}));

const cityList = document.querySelector('#cityOptions');
cityList.innerHTML = cities.map(({city,state,country}) => `<option value="${city}">${state}, ${country}</option>`).join('');

const hours = Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0')).map(v=>`<option>${v}</option>`).join('');
const minutes = Array.from({length:60},(_,i)=>String(i).padStart(2,'0')).map(v=>`<option>${v}</option>`).join('');
const today = new Date().toISOString().split('T')[0];
const bookingLimitDate=new Date();bookingLimitDate.setDate(bookingLimitDate.getDate()+31);
const bookingMax=`${bookingLimitDate.getFullYear()}-${String(bookingLimitDate.getMonth()+1).padStart(2,'0')}-${String(bookingLimitDate.getDate()).padStart(2,'0')}`;

function locationFields(prefix, legend) {
  return `<fieldset class="location-fields full"><legend>${legend}</legend>
    <label>City *<input name="${prefix}City" data-city data-prefix="${prefix}" list="cityOptions" autocomplete="off" placeholder="Start typing, for example Su" required></label>
    <label>State *<input name="${prefix}State" data-state-for="${prefix}" readonly required></label>
    <label>Country *<input name="${prefix}Country" data-country-for="${prefix}" readonly required></label>
  </fieldset>`;
}

function consultationMode() {
  return `<fieldset class="choice-field full"><legend>Choose consultation mode *</legend>
    <label class="choice-card"><input type="radio" name="consultationMode" value="One-to-one consultation at our office" required><span><strong>At our office</strong><small>One-to-one at UG-16, Westfield Mall, Surat</small></span></label>
    <label class="choice-card"><input type="radio" name="consultationMode" value="On-call consultation" required><span><strong>On call</strong><small>Consultation from your current location</small></span></label>
  </fieldset>`;
}

function consent() {
  return `<fieldset class="appointment-picker full"><legend>Select appointment *</legend><label>Appointment date<input id="appointmentDate" name="appointmentDate" type="date" min="${today}" max="${bookingMax}" required></label><div><span class="appointment-slot-label">Available timings</span><div id="appointmentSlots" class="appointment-slots"><p>Select a date to view available appointments.</p></div><small id="appointmentStatus" class="appointment-status">Monday–Saturday · Appointments can be booked up to one month ahead.</small></div></fieldset><div class="consent full">
    <label><input type="checkbox" name="disclaimerAccepted" required><span>I confirm that the information I have provided is accurate. I understand that SIAOS does not guarantee that any consultation, guidance or astrological remedy will produce 100% results. SIAOS recommends the astrological remedy considered most suitable for my circumstances, with the intention of providing guidance and possible relief; individual results may vary. These services do not replace medical, legal, financial or other licensed professional advice. I consent to SIAOS using my details only to arrange and provide my requested consultation.</span></label>
  </div>
  <button class="btn fill full payment-next" type="submit" disabled>Proceed to Payment</button>`;
}

const slotLabel=hour=>{const start=hour===12?'12:00 PM':hour>12?`${hour-12}:00 PM`:`${hour}:00 AM`;const endHour=hour===12?'12:30 PM':hour>12?`${hour-12}:30 PM`:`${hour}:30 AM`;return `${start} – ${endHour}`;};
function previewSlots(date){return Array.from({length:9},(_,index)=>{const hour=10+index;return {start_at:`${date}T${String(hour).padStart(2,'0')}:00:00+05:30`,label:slotLabel(hour)}});}
async function initialiseAppointmentPicker(form){
  const dateInput=form.querySelector('#appointmentDate');const slotsTarget=form.querySelector('#appointmentSlots');const statusTarget=form.querySelector('#appointmentStatus');
  dateInput.addEventListener('change',async()=>{
    slotsTarget.innerHTML='<p>Checking availability…</p>';const chosen=new Date(`${dateInput.value}T12:00:00`);
    if(!dateInput.value||chosen.getDay()===0){slotsTarget.innerHTML='<p>Appointments are unavailable on Sundays. Please select Monday–Saturday.</p>';return;}
    let slots=[];let preview=false;
    try{const session=await window.SIAOSAccount?.getSession();if(!window.SIAOSAccount?.client||session?.demo){slots=previewSlots(dateInput.value);preview=true;}else{const {data,error}=await window.SIAOSAccount.client.rpc('available_appointment_slots',{p_date:dateInput.value});if(error)throw error;slots=data||[];}}
    catch(error){slotsTarget.innerHTML=`<p>${error.message||'Availability could not be loaded.'}</p>`;return;}
    slotsTarget.innerHTML=slots.length?slots.map((slot,index)=>`<label class="appointment-slot"><input type="radio" name="appointmentStart" value="${slot.start_at}" ${index===0?'required':''}><span>${slot.label}</span></label>`).join(''):'<p>No appointments remain for this date. Please choose another date.</p>';
    statusTarget.textContent=preview?'Developer preview availability · the selected time will be saved in this browser.':'Live availability · your selection is held for 15 minutes when you continue.';
  });
}

function kundliForm() {
  return `<label>Full name *<input name="fullName" autocomplete="name" required></label>
    <label>Date of birth *<input name="dateOfBirth" type="date" max="${today}" required></label>
    ${locationFields('birth','Place of birth')}
    <fieldset class="time-fields full"><legend>Time of birth *</legend>
      <label>HH<select name="birthHour" required><option value="">HH</option>${hours}</select></label>
      <label>MM<select name="birthMinute" required><option value="">MM</option>${minutes}</select></label>
      <label>AM / PM<select name="birthPeriod" required><option value="">Choose</option><option>AM</option><option>PM</option></select></label>
    </fieldset>
    <label>Phone number *<input name="phone" type="tel" autocomplete="tel" required></label>
    <label>WhatsApp number *<input name="whatsapp" type="tel" required></label>
    ${locationFields('current','Current location')}
    ${consultationMode()}${consent()}`;
}

function numerologyForm() {
  return `<label class="full">Full name as on legal documents / bank records *<input name="legalName" autocomplete="name" required></label>
    <label>Date of birth *<input name="dateOfBirth" type="date" max="${today}" required></label>
    <label>All phone numbers registered in your name *<textarea name="ownedPhoneNumbers" rows="4" placeholder="Enter one phone number per line" required></textarea></label>
    <label class="full">Company name <small class="field-note">Only if the company is owned by you</small><input name="companyName"></label>
    ${consultationMode()}${consent()}`;
}

function vastuForm() {
  return `<label class="full">Property status *<select name="propertyStatus" id="propertyStatus" required><option value="">Choose New or Old Property</option><option>New Property</option><option>Old Property</option></select></label>
    <fieldset id="propertyTypeStage" class="choice-field full staged-field" hidden><legend>Type of property *</legend>
      ${['Residential Property','Commercial Property','Plot / Farm','Industrial Property'].map(v=>`<label class="choice-card"><input type="radio" name="propertyType" value="${v}"><span><strong>${v}</strong></span></label>`).join('')}
    </fieldset>
    <fieldset id="analysisModeStage" class="choice-field full staged-field" hidden><legend>Choose the mode of analysis *</legend>
      <label class="choice-card"><input type="radio" name="analysisMode" value="Based on Google Map"><span><strong>Based on Google Map</strong><small>Remote directional and location review</small></span></label>
      <label class="choice-card"><input type="radio" name="analysisMode" value="In-person visit at property"><span><strong>In-person visit</strong><small>Visit at the property</small></span></label>
    </fieldset>
    <label class="full">Phone number *<input name="phone" type="tel" autocomplete="tel" required></label>
    ${consent()}`;
}

function tarotForm() {
  return `<label>Full name *<input name="fullName" autocomplete="name" required></label>
    <label>Date of birth *<input name="dateOfBirth" type="date" max="${today}" required></label>
    ${consultationMode()}${consent()}`;
}

function faceForm() {
  return `<label>Full name *<input name="fullName" autocomplete="name" required></label>
    <label>Date of birth *<input name="dateOfBirth" type="date" max="${today}" required></label>
    <label class="full">Phone number *<input name="phone" type="tel" autocomplete="tel" required></label>
    ${locationFields('current','Current place')}
    ${consultationMode()}${consent()}`;
}

function paranormalForm() {
  return `<label>Full name *<input name="fullName" autocomplete="name" required></label>
    <label>Phone number *<input name="phone" type="tel" autocomplete="tel" required></label>
    ${locationFields('current','Current location')}
    ${consent()}`;
}

const templates = {kundli:kundliForm,numerology:numerologyForm,vastu:vastuForm,tarot:tarotForm,face:faceForm,paranormal:paranormalForm};
const mainService = document.querySelector('#mainService');
const subServiceWrap = document.querySelector('#subServiceWrap');
const subService = document.querySelector('#subService');
const formSection = document.querySelector('#formSection');
const dynamicForm = document.querySelector('#dynamicForm');
const bookingContent = document.querySelector('#bookingContent');
const bookingAccessGate = document.querySelector('#bookingAccessGate');

async function requireBookingAccount() {
  const session = await window.SIAOSAccount?.getSession();
  if (session) { bookingContent.hidden = false; return true; }
  const next = `${location.pathname.split('/').pop() || 'booking.html'}${location.search}${location.hash}`;
  bookingAccessGate.innerHTML = `<div class="account-prompt-backdrop"></div><section class="account-prompt-card" role="dialog" aria-modal="true" aria-labelledby="bookingAccessTitle"><img src="assets/siaos-official-logo.png" alt="Official SIAOS crest"><span class="kicker">Account required</span><h2 id="bookingAccessTitle">Sign in before<br><em>booking a consultation.</em></h2><p>Your booking details and purchased reports are kept private inside your SIAOS account.</p><div class="account-prompt-actions"><a class="btn fill" href="login.html?mode=signup&next=${encodeURIComponent(next)}">Create Account</a><a class="btn" href="login.html?mode=signin&next=${encodeURIComponent(next)}">Sign In</a></div></section>`;
  bookingAccessGate.hidden = false;
  document.body.classList.add('account-prompt-open');
  bookingAccessGate.querySelector('.btn.fill')?.focus();
  return false;
}

function fillLocation(input) {
  const match = cities.find(item => item.city.toLowerCase() === input.value.trim().toLowerCase());
  const prefix = input.dataset.prefix;
  const state = document.querySelector(`[data-state-for="${prefix}"]`);
  const country = document.querySelector(`[data-country-for="${prefix}"]`);
  state.value = match ? match.state : '';
  country.value = match ? match.country : '';
}

function renderForm(service) {
  const selectedRelatedService = subService.value;
  document.querySelector('#selectedServiceTitle').textContent = `${services[service]} — ${selectedRelatedService}`;
  dynamicForm.innerHTML = `<form id="serviceForm" class="form booking-form" data-service="${service}"><input type="hidden" name="relatedService" value="${selectedRelatedService}">${templates[service]()}</form>`;
  formSection.hidden = false;
  const form = document.querySelector('#serviceForm');
  const consentBox = form.querySelector('[name="disclaimerAccepted"]');
  const proceed = form.querySelector('.payment-next');
  initialiseAppointmentPicker(form);
  consentBox.addEventListener('change', () => proceed.disabled = !consentBox.checked);
  form.querySelectorAll('[data-city]').forEach(input => {
    input.addEventListener('input', () => fillLocation(input));
    input.addEventListener('change', () => fillLocation(input));
  });

  if (service === 'vastu') {
    const status = form.querySelector('#propertyStatus');
    const typeStage = form.querySelector('#propertyTypeStage');
    const modeStage = form.querySelector('#analysisModeStage');
    status.addEventListener('change', () => {
      typeStage.hidden = !status.value;
      typeStage.querySelectorAll('input').forEach(input => input.required = Boolean(status.value));
      if (!status.value) modeStage.hidden = true;
    });
    typeStage.addEventListener('change', () => {
      modeStage.hidden = false;
      modeStage.querySelectorAll('input').forEach(input => input.required = true);
    });
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity() || !consentBox.checked) return;
    const details = Object.fromEntries(new FormData(form).entries());
    const session=await window.SIAOSAccount?.getSession();
    let appointmentId=`preview-${Date.now()}`;
    if(window.SIAOSAccount?.client&&!session?.demo){const {data,error}=await window.SIAOSAccount.client.rpc('hold_appointment_slot',{p_service:service,p_related_service:selectedRelatedService,p_consultation_mode:details.consultationMode||'On-call consultation',p_start_at:details.appointmentStart});if(error){alert(error.message||'This appointment is no longer available. Please select another time.');return;}appointmentId=data;}
    const booking = {service,serviceName:services[service],relatedService:selectedRelatedService,appointmentId,appointmentStart:details.appointmentStart,details,createdAt:new Date().toISOString()};
    sessionStorage.setItem('siaosBooking', JSON.stringify(booking));

    const backendUrl = String(window.SIAOS_AUTH_CONFIG?.backendUrl || '').replace(/\/$/,'');
    if (!backendUrl && !GOOGLE_SHEETS_WEB_APP_URL && !window.SIAOSAccount?.client && !session?.demo) {
      alert('The secure booking service is not configured yet.');
      return;
    }

    proceed.disabled = true;
    const originalLabel = proceed.textContent;
    proceed.textContent = 'Saving your details…';

    try {
      if (backendUrl) {
        const response = await fetch(`${backendUrl}/api/consultations`, {
          method: 'POST',
          headers: {'Content-Type':'application/json','Authorization':`Bearer ${session?.access_token || ''}`},
          body: JSON.stringify(booking)
        });
        if (!response.ok) throw new Error((await response.json().catch(()=>({}))).error || 'The booking could not be saved.');
      } else if (GOOGLE_SHEETS_WEB_APP_URL) {
        await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
          method: 'POST', mode: 'no-cors',
          headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify(booking)
        });
      }
      location.href = 'payment.html';
    } catch (error) {
      console.error('Google Sheets submission failed:', error);
      alert('We could not save your details. Please check your connection and try again.');
      proceed.disabled = false;
      proceed.textContent = originalLabel;
    }
  });

  formSection.scrollIntoView({behavior:'smooth',block:'start'});
}

const bookingParams = new URLSearchParams(location.search);
const requestedService = bookingParams.get('service');
const requestedSubService = bookingParams.get('subservice');
function showRelatedServices(service) {
  formSection.hidden = true;
  dynamicForm.innerHTML = '';
  subService.innerHTML = `<option value="">Choose the guidance you need</option>${relatedServices[service].map(item=>`<option value="${item}">${item}</option>`).join('')}`;
  subServiceWrap.hidden = false;
  history.replaceState(null,'',`booking.html?service=${service}`);
}

mainService.addEventListener('change', () => {
  if (!mainService.value) {
    subServiceWrap.hidden = true;
    formSection.hidden = true;
    dynamicForm.innerHTML = '';
    history.replaceState(null,'','booking.html');
    return;
  }
  showRelatedServices(mainService.value);
});

subService.addEventListener('change', () => {
  formSection.hidden = true;
  dynamicForm.innerHTML = '';
  if (subService.value) renderForm(mainService.value);
});

if (services[requestedService]) {
  mainService.value = requestedService;
  showRelatedServices(requestedService);
  if (requestedSubService && relatedServices[requestedService].includes(requestedSubService)) {
    subService.value = requestedSubService;
    renderForm(requestedService);
  }
}

requireBookingAccount().catch(() => {
  bookingAccessGate.hidden = false;
  bookingAccessGate.innerHTML = `<div class="account-prompt-backdrop"></div><section class="account-prompt-card"><span class="kicker">Account required</span><h2>Sign in to book</h2><p>Please open your SIAOS account before booking a consultation.</p><div class="account-prompt-actions"><a class="btn fill" href="login.html?mode=signup&next=booking.html">Create Account</a><a class="btn" href="login.html?mode=signin&next=booking.html">Sign In</a></div></section>`;
});
