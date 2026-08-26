const nav = document.querySelector('.nav');
document.querySelector('.menu')?.addEventListener('click',() => nav?.classList.toggle('open'));
document.querySelector('.dots>button')?.addEventListener('click',event => {
  event.stopPropagation();
  document.querySelector('.dots')?.classList.toggle('open');
});
document.addEventListener('click',() => document.querySelector('.dots')?.classList.remove('open'));

const zodiacProfiles = {
  Aries:{gift:'decisive action',lesson:'patience before commitment',practice:'begin important mornings with three quiet breaths before acting'},
  Taurus:{gift:'steady effort',lesson:'flexibility when plans change',practice:'restore order in one small part of your surroundings'},
  Gemini:{gift:'clear communication',lesson:'focus instead of scattered attention',practice:'write down the one conversation that matters most'},
  Cancer:{gift:'emotional intelligence',lesson:'healthy boundaries with loved ones',practice:'protect a regular period of rest and reflection'},
  Leo:{gift:'warm leadership',lesson:'listening without defending pride',practice:'offer water to the rising Sun with a simple intention'},
  Virgo:{gift:'discernment and organisation',lesson:'progress without perfectionism',practice:'complete one unfinished task before adding another'},
  Libra:{gift:'balance and diplomacy',lesson:'clear decisions without people-pleasing',practice:'bring beauty and calm to the place where you work'},
  Scorpio:{gift:'depth and resilience',lesson:'trust without over-control',practice:'release pressure through movement, prayer or journaling'},
  Sagittarius:{gift:'vision and optimism',lesson:'careful attention to practical details',practice:'learn, teach or share one useful idea generously'},
  Capricorn:{gift:'discipline and responsibility',lesson:'rest without guilt',practice:'review one long-term commitment with complete honesty'},
  Aquarius:{gift:'original thinking',lesson:'presence within partnership',practice:'help someone quietly without seeking recognition'},
  Pisces:{gift:'intuition and compassion',lesson:'realistic limits around emotional energy',practice:'begin the day with water, stillness and a short mantra'}
};

const monthlyFocus = [
  'turning a delayed decision into a practical next step',
  'strengthening financial order and daily stability',
  'speaking clearly where assumptions have created distance',
  'giving home, family and emotional wellbeing proper attention',
  'allowing visible work and confident self-expression to grow',
  'organising routines, documents and unfinished responsibilities',
  'choosing balanced partnerships over one-sided compromise',
  'reviewing shared commitments, trust and deeper priorities',
  'expanding through study, travel, teaching or spiritual learning',
  'building patiently toward one meaningful long-term result',
  'refreshing friendships, networks and future plans',
  'slowing down enough to hear intuition without losing practicality'
];
const workGuidance = [
  'Career matters respond best to preparation before visibility.',
  'A useful opportunity may arrive through an existing contact.',
  'Written details deserve a second review before you commit.',
  'Consistent small actions will outperform a dramatic change.',
  'Take leadership where your responsibility is already clear.',
  'A quiet improvement behind the scenes can create later progress.',
  'Collaboration is favourable when roles are stated honestly.',
  'Avoid mixing urgency with decisions involving shared money.',
  'Learning a new method can open a practical professional door.'
];
const relationshipGuidance = [
  'Relationships improve when expectations are spoken gently and directly.',
  'Warmth will achieve more than proving who is right.',
  'Give important conversations enough time instead of forcing an answer.',
  'A boundary can be loving when it is explained with respect.',
  'Listen for the need beneath the words before responding.',
  'Shared plans benefit from one simple agreement both people can maintain.',
  'Do not let an old disappointment decide the tone of a new conversation.',
  'Affection is best expressed through reliable actions this month.'
];
const wellbeingGuidance = [
  'Protect sleep and hydration before asking more from your energy.',
  'A simpler morning rhythm will improve focus throughout the day.',
  'Regular movement can release pressure that thinking alone cannot solve.',
  'Reduce unnecessary noise and give your mind a short daily pause.',
  'Keep spiritual practice gentle, consistent and connected to real action.',
  'Balance service to others with time that restores your own steadiness.'
];

function cyclePick(list,signIndex,month,year,offset = 0) {
  const seed = year * 17 + month * 13 + signIndex * 7 + offset;
  return list[((seed % list.length) + list.length) % list.length];
}

function zodiacMonthContext(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthName = new Intl.DateTimeFormat('en-IN',{month:'long'}).format(date);
  const lastDay = new Date(year,month + 1,0).getDate();
  return {year,month,monthName,period:`${monthName} 1–${lastDay}, ${year}`};
}

function buildMonthlyHoroscope(sign,context) {
  const names = Object.keys(zodiacProfiles);
  const signIndex = names.indexOf(sign);
  const profile = zodiacProfiles[sign];
  const focus = cyclePick(monthlyFocus,signIndex,context.month,context.year);
  const work = cyclePick(workGuidance,signIndex,context.month,context.year,3);
  const relationship = cyclePick(relationshipGuidance,signIndex,context.month,context.year,7);
  const wellbeing = cyclePick(wellbeingGuidance,signIndex,context.month,context.year,11);
  return `<p><strong>How this month can benefit you:</strong> ${context.monthName} supports ${focus}. Used thoughtfully, this can bring clearer priorities, steadier decisions and better use of your time.</p><p><strong>What the month is telling you:</strong> ${work} ${relationship}</p><p><strong>Your practical guidance:</strong> ${wellbeing} A supportive practice is to ${profile.practice}.</p>`;
}

function refreshZodiacMonth() {
  const wheelSection = document.querySelector('.wheel-section');
  if (!wheelSection) return;
  const context = zodiacMonthContext();
  const kicker = document.querySelector('#zodiacKicker');
  const intro = document.querySelector('#zodiacIntro');
  const reading = document.querySelector('.reading');
  if (kicker) kicker.textContent = `${context.monthName} ${context.year} Zodiac Guidance`;
  if (intro) intro.textContent = `Select any static gold rashi symbol to read its automatically refreshed guidance for ${context.period}.`;
  const active = document.querySelector('.sign.active');
  if (active && reading) {
    const sign = active.dataset.sign;
    reading.innerHTML = `<h3>${sign}</h3><small>${context.period}</small>${buildMonthlyHoroscope(sign,context)}`;
  } else if (reading) {
    const period = reading.querySelector('small');
    if (period) period.textContent = context.period;
  }
}

document.querySelectorAll('.sign').forEach(button => button.addEventListener('click',() => {
  document.querySelectorAll('.sign').forEach(sign => sign.classList.remove('active'));
  button.classList.add('active');
  const context = zodiacMonthContext();
  const sign = button.dataset.sign;
  const reading = document.querySelector('.reading');
  if (reading) reading.innerHTML = `<h3>${sign}</h3><small>${context.period}</small>${buildMonthlyHoroscope(sign,context)}`;
}));

refreshZodiacMonth();
setInterval(refreshZodiacMonth,60 * 60 * 1000);
