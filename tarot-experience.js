(() => {
  const form = document.querySelector('#tarotQuestionForm');
  if (!form) return;

  const questionInput = document.querySelector('#tarotQuestion');
  const drawButton = document.querySelector('#drawTarotCard');
  const deck = document.querySelector('#tarotDeck');
  const reading = document.querySelector('#tarotReading');
  const storageKey = 'siaosTarotDailyDrawV2';
  const bookingUrl = 'booking.html?service=tarot&subservice=Single%20Question%20Reading';

  const cards = [
    {number:'0',name:'The Fool',keywords:'Beginnings · Trust · Possibility',message:'A new path may be opening, but it asks for awareness as well as courage. Begin lightly, learn as you move, and do not confuse freedom with lack of preparation.',benefit:'This card helps you recognise a fresh opportunity and move forward without carrying unnecessary fear from the past.'},
    {number:'I',name:'The Magician',keywords:'Will · Skill · Action',message:'You already hold more useful ability than you may be recognising. Bring thought, words and action into one direction instead of waiting for perfect conditions.',benefit:'Its benefit is renewed confidence: it reminds you to use the skills and resources already available to you.'},
    {number:'II',name:'The High Priestess',keywords:'Intuition · Silence · Inner knowing',message:'Not every answer needs to be forced today. Notice what remains consistent beneath changing emotions, and allow hidden information time to become clear.',benefit:'This card benefits you by slowing impulsive decisions and helping you trust careful observation and inner awareness.'},
    {number:'III',name:'The Empress',keywords:'Growth · Care · Abundance',message:'What you nourish can grow, but care must include yourself as well as others. Choose the environment, relationships and habits that support steady flourishing.',benefit:'It encourages healthy growth, self-care and attention to the people or projects that genuinely deserve your energy.'},
    {number:'IV',name:'The Emperor',keywords:'Structure · Authority · Boundaries',message:'Clarity requires a firm foundation. Define the responsibility, boundary or practical plan that will keep this situation from being ruled by changing moods.',benefit:'The card helps you create order, protect your priorities and replace uncertainty with a workable plan.'},
    {number:'V',name:'The Hierophant',keywords:'Tradition · Learning · Guidance',message:'A trusted method, teacher or established principle may be more useful than improvisation. Learn the structure first, then decide what genuinely belongs to you.',benefit:'It benefits you by directing attention toward reliable guidance, proven knowledge and values that can steady your decision.'},
    {number:'VI',name:'The Lovers',keywords:'Values · Choice · Union',message:'The important question is not only what attracts you, but what aligns with your values. Honest choice creates stronger connection than avoiding discomfort.',benefit:'This card helps reveal whether a relationship or choice supports your deeper values, not only immediate emotion.'},
    {number:'VII',name:'The Chariot',keywords:'Direction · Discipline · Progress',message:'Movement is possible when competing impulses are brought under one clear intention. Choose the direction, hold the reins steadily and avoid proving yourself through speed.',benefit:'Its benefit is focused momentum: it encourages you to choose one direction and use discipline to make measurable progress.'},
    {number:'VIII',name:'Strength',keywords:'Courage · Patience · Compassion',message:'Gentle self-command is more powerful than force. Meet intensity with patience, and let courage include tenderness, restraint and respect for your own limits.',benefit:'The card helps you handle pressure without aggression and turn emotional intensity into calm, compassionate strength.'},
    {number:'IX',name:'The Hermit',keywords:'Reflection · Wisdom · Solitude',message:'A temporary step inward can reveal what noise has hidden. Seek clarity before consensus, but do not turn reflection into permanent withdrawal.',benefit:'It benefits you by creating mental space to identify your own answer before outside opinions influence the decision.'},
    {number:'X',name:'Wheel of Fortune',keywords:'Change · Cycles · Timing',message:'The situation is moving through a larger cycle. Work with what is changing, keep your centre, and use the opening without assuming that every condition can be controlled.',benefit:'This card helps you adapt to changing circumstances and recognise opportunities that become visible during a transition.'},
    {number:'XI',name:'Justice',keywords:'Truth · Balance · Consequence',message:'Look at facts, choices and consequences with equal honesty. A fair decision may require accountability as well as compassion.',benefit:'Its benefit is clearer judgment: it asks you to separate facts from assumptions and choose what is fair and responsible.'},
    {number:'XII',name:'The Hanged Man',keywords:'Pause · Perspective · Surrender',message:'Progress may come through seeing the matter differently rather than pushing harder. Release one fixed assumption and notice what the pause is teaching.',benefit:'The card helps reduce wasted effort by inviting a new perspective before another action is taken.'},
    {number:'XIII',name:'Death',keywords:'Ending · Release · Transformation',message:'A chapter may need to end so that energy can move again. This card speaks of transition, not literal death: honour what is complete and make space for renewal.',benefit:'It benefits you by supporting necessary closure and freeing energy for a healthier next phase.'},
    {number:'XIV',name:'Temperance',keywords:'Healing · Moderation · Integration',message:'The best path is created by measured adjustment rather than extremes. Combine what works, reduce what overwhelms, and give balance enough time to develop.',benefit:'This card helps you find a sustainable middle path and improve the situation through gradual, balanced adjustments.'},
    {number:'XV',name:'The Devil',keywords:'Attachment · Pattern · Awareness',message:'A habit, fear or attachment may be limiting choice. Name the pattern without shame; awareness is the first step toward reclaiming your freedom.',benefit:'Its benefit is honest awareness: recognising an unhealthy attachment gives you the power to make a freer choice.'},
    {number:'XVI',name:'The Tower',keywords:'Revelation · Disruption · Truth',message:'Something unstable may be asking to be seen clearly. Do not create fear around change; protect what matters and let truth remove what cannot support you.',benefit:'The card helps you identify a weak foundation early so you can rebuild with greater honesty and stability.'},
    {number:'XVII',name:'The Star',keywords:'Hope · Renewal · Authenticity',message:'A quieter form of hope is returning. Let healing be gradual, remain honest about what you need, and take the next sincere step toward renewal.',benefit:'It benefits you by restoring confidence, emotional openness and a realistic sense of hope after difficulty.'},
    {number:'XVIII',name:'The Moon',keywords:'Uncertainty · Emotion · Imagination',message:'Feelings are meaningful but may not yet show the complete picture. Move slowly, verify assumptions and allow confusion to settle before making a final judgment.',benefit:'This card protects you from premature decisions by encouraging patience, verification and deeper emotional awareness.'},
    {number:'XIX',name:'The Sun',keywords:'Clarity · Vitality · Confidence',message:'Clarity grows when you allow yourself to be seen without performance. Choose openness, acknowledge genuine progress and bring warmth to the next step.',benefit:'Its benefit is clarity and renewed energy, helping you recognise progress and communicate with greater confidence.'},
    {number:'XX',name:'Judgement',keywords:'Awakening · Review · Calling',message:'A larger lesson is asking to be recognised. Review the past without living inside it, answer what now feels true, and act with mature responsibility.',benefit:'The card helps you understand the lesson behind past experience and make a more conscious next decision.'},
    {number:'XXI',name:'The World',keywords:'Completion · Integration · Achievement',message:'A cycle is ready to be understood as a whole. Acknowledge what has been completed, gather the lesson, and prepare for the next chapter without rushing past closure.',benefit:'It benefits you by helping you recognise completion, celebrate genuine progress and enter the next phase with wisdom.'}
  ];

  const cardArtwork = {
    'The Fool':'assets/tarot/the-fool.png',
    'The Magician':'assets/tarot/the-magician.png',
    'The High Priestess':'assets/tarot/the-high-priestess.png',
    'The Empress':'assets/tarot/the-empress.png',
    'The Hermit':'assets/tarot/the-hermit.png',
    'The Star':'assets/tarot/the-star.png'
  };
  const illustratedCards = cards
    .filter(card => cardArtwork[card.name])
    .map(card => ({...card,image:cardArtwork[card.name]}));

  const hashText = value => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash,16777619);
    }
    return hash >>> 0;
  };
  const normaliseQuestion = value => value.trim().toLocaleLowerCase('en-IN').replace(/\s+/g,' ');
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

  function deviceToken() {
    const key = 'siaosVisitorToken';
    try {
      let token = localStorage.getItem(key);
      if (!token) {
        token = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
        localStorage.setItem(key,token);
      }
      return token;
    } catch {
      return 'siaos-session-visitor';
    }
  }

  function savedDraw() {
    try { return JSON.parse(localStorage.getItem(storageKey)); } catch { return null; }
  }

  function showDailyLimit() {
    reading.hidden = false;
    reading.innerHTML = `<span class="kicker">Daily complimentary draw used</span><h3>You have exhausted your daily limit.</h3><p>Your next free card will be available tomorrow. For another question or a complete spread today, continue directly to the Tarot consultation form.</p><a class="btn fill" href="${bookingUrl}">Open Tarot Reading Form</a>`;
    questionInput.disabled = true;
    drawButton.disabled = true;
    drawButton.textContent = 'Daily Limit Exhausted';
  }

  const existingAtLoad = savedDraw();
  if (existingAtLoad?.dateKey === dateKey()) showDailyLimit();

  form.addEventListener('submit',event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const todayKey = dateKey();
    const existing = savedDraw();
    if (existing?.dateKey === todayKey) {
      showDailyLimit();
      return;
    }

    const question = questionInput.value.trim();
    const cardIndex = hashText(`${deviceToken()}|${todayKey}|${normaliseQuestion(question)}`) % illustratedCards.length;
    const selectedCard = illustratedCards[cardIndex];
    const report = {
      dateKey:todayKey,
      questionHash:hashText(normaliseQuestion(question)),
      cardIndex,
      question,
      card:selectedCard,
      createdAt:new Date().toISOString()
    };

    drawButton.disabled = true;
    deck.hidden = false;
    deck.classList.add('shuffling');
    reading.hidden = true;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    setTimeout(async () => {
      deck.classList.remove('shuffling');
      try {
        localStorage.setItem(storageKey,JSON.stringify(report));
        sessionStorage.setItem('siaosTarotReport',JSON.stringify(report));
        await window.SIAOSAccount?.saveReading({readingType:'tarot',title:`Tarot · ${report.card.name}`,summary:{card:report.card.name,question:report.question},payload:report,createdAt:report.createdAt});
        location.href = 'tarot-report.html';
      } catch {
        drawButton.disabled = false;
        reading.hidden = false;
        reading.innerHTML = '<h3>The card could not be saved</h3><p>Please allow browser storage and try again.</p>';
      }
    },reducedMotion ? 80 : 1450);
  });
})();
