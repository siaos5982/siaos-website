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

  cards.push(
    {number:'Ace',name:'Ace of Wands',suit:'Wands',keywords:'Inspiration · Initiative · Potential',message:'A lively beginning is asking for expression. The spark is real, but it needs one practical first step before enthusiasm becomes momentum.',benefit:'This card helps you recognise a promising idea and direct fresh energy toward an achievable beginning.'},
    {number:'Two',name:'Two of Wands',suit:'Wands',keywords:'Planning · Choice · Expansion',message:'You can see beyond the present position, but progress requires choosing a direction. Compare the possibilities, then commit rather than planning indefinitely.',benefit:'It helps you turn ambition into a considered plan and choose the path with the strongest long-term potential.'},
    {number:'Three',name:'Three of Wands',suit:'Wands',keywords:'Progress · Foresight · Opportunity',message:'Earlier effort is beginning to create wider possibilities. Stay attentive to what is approaching and prepare to work with opportunities beyond familiar limits.',benefit:'This card encourages strategic patience and helps you recognise growth that is already developing.'},
    {number:'Four',name:'Four of Wands',suit:'Wands',keywords:'Celebration · Stability · Belonging',message:'A milestone deserves acknowledgement. Shared joy, a supportive home or a reliable community can strengthen the foundation for what comes next.',benefit:'It reminds you to value stability, celebrate genuine progress and receive support from trusted people.'},
    {number:'Five',name:'Five of Wands',suit:'Wands',keywords:'Competition · Friction · Learning',message:'Different priorities may be colliding. The tension can sharpen ideas when it remains respectful, but scattered conflict will waste energy.',benefit:'This card helps you separate useful challenge from unnecessary argument and respond with clearer purpose.'},
    {number:'Six',name:'Six of Wands',suit:'Wands',keywords:'Recognition · Confidence · Victory',message:'Effort may be receiving deserved recognition. Accept encouragement without allowing approval to become the only measure of your worth.',benefit:'It supports healthy confidence and helps you acknowledge success while staying grounded and responsible.'},
    {number:'Seven',name:'Seven of Wands',suit:'Wands',keywords:'Courage · Defence · Conviction',message:'Your position may be tested. Protect what matters, but choose your battles and avoid treating every disagreement as a threat.',benefit:'This card strengthens boundaries and helps you stand firmly for a priority without exhausting yourself.'},
    {number:'Eight',name:'Eight of Wands',suit:'Wands',keywords:'Movement · News · Momentum',message:'Events may begin moving quickly after delay. Communicate clearly, remain organised and respond promptly without confusing speed with certainty.',benefit:'It helps you use a fast-moving opportunity wisely and keep several developments moving in one direction.'},
    {number:'Nine',name:'Nine of Wands',suit:'Wands',keywords:'Resilience · Vigilance · Persistence',message:'Experience has made you cautious, and one final effort may be required. Protect your energy while refusing to let past difficulty define every new situation.',benefit:'This card supports perseverance and helps you remain prepared without becoming permanently defensive.'},
    {number:'Ten',name:'Ten of Wands',suit:'Wands',keywords:'Burden · Duty · Priorities',message:'Too much responsibility may be resting on one person. Complete what truly matters, then delegate, simplify or release what is not yours to carry.',benefit:'It helps you identify overload and create a more sustainable balance between commitment and personal capacity.'},
    {number:'Page',name:'Page of Wands',suit:'Wands',keywords:'Curiosity · Discovery · Enthusiasm',message:'A message, interest or creative experiment may invite exploration. Learn through action, but give your enthusiasm enough structure to develop.',benefit:'This card renews curiosity and encourages a low-risk first step toward a new interest or possibility.'},
    {number:'Knight',name:'Knight of Wands',suit:'Wands',keywords:'Adventure · Passion · Impulse',message:'Bold movement can break stagnation, yet haste may create avoidable problems. Carry the passion forward with a clear destination and realistic preparation.',benefit:'It helps you use courage and energy constructively while reducing impulsive choices.'},
    {number:'Queen',name:'Queen of Wands',suit:'Wands',keywords:'Warmth · Independence · Magnetism',message:'Confidence grows when you honour your own strengths and encourage the strengths of others. Be visible without needing to dominate the room.',benefit:'This card supports authentic self-belief, creative leadership and generous influence.'},
    {number:'King',name:'King of Wands',suit:'Wands',keywords:'Vision · Leadership · Enterprise',message:'A larger vision needs mature direction. Lead through consistency, communicate the purpose clearly and take responsibility for the impact of your decisions.',benefit:'It helps transform ambition into principled leadership and a plan others can understand and support.'},

    {number:'Ace',name:'Ace of Cups',suit:'Cups',keywords:'Love · Openness · Renewal',message:'An emotional beginning is possible when the heart is open without abandoning discernment. Allow care, creativity or spiritual renewal to enter gradually.',benefit:'This card helps you receive affection, reconnect with feeling and begin from emotional honesty.'},
    {number:'Two',name:'Two of Cups',suit:'Cups',keywords:'Partnership · Harmony · Reciprocity',message:'Mutual respect can create a meaningful bond. Healthy connection requires both people to listen, contribute and remain honest about their needs.',benefit:'It highlights balanced partnership and helps you recognise where trust and cooperation can deepen.'},
    {number:'Three',name:'Three of Cups',suit:'Cups',keywords:'Friendship · Support · Celebration',message:'Connection with supportive people can restore perspective. Share joy and seek community, while keeping boundaries clear where too many voices create confusion.',benefit:'This card encourages friendship, collaboration and the emotional nourishment of belonging.'},
    {number:'Four',name:'Four of Cups',suit:'Cups',keywords:'Reflection · Apathy · Reconsideration',message:'Disappointment or boredom may be hiding an available option. Pause honestly, but do not become so focused on what is missing that you overlook what is offered.',benefit:'It helps you reassess emotional needs and notice possibilities that habit or discouragement has obscured.'},
    {number:'Five',name:'Five of Cups',suit:'Cups',keywords:'Loss · Grief · Perspective',message:'A disappointment deserves acknowledgement, yet it is not the whole story. Grieve what changed while remaining aware of support and possibility that still remain.',benefit:'This card supports emotional processing and helps you turn gently toward what can still be repaired or rebuilt.'},
    {number:'Six',name:'Six of Cups',suit:'Cups',keywords:'Memory · Kindness · Simplicity',message:'The past may offer comfort, insight or reconnection. Receive its lesson without idealising an earlier time or avoiding the responsibilities of the present.',benefit:'It helps you recover innocence, generosity and useful memories while maintaining adult perspective.'},
    {number:'Seven',name:'Seven of Cups',suit:'Cups',keywords:'Choices · Fantasy · Discernment',message:'Many possibilities may look attractive, but not all are realistic. Clarify your values, verify the facts and choose one option that can be acted upon.',benefit:'This card helps reduce confusion and turn imagination into a grounded, conscious choice.'},
    {number:'Eight',name:'Eight of Cups',suit:'Cups',keywords:'Departure · Search · Emotional truth',message:'Something may no longer provide the meaning it once did. Leaving should be thoughtful rather than dramatic, guided by deeper truth instead of temporary frustration.',benefit:'It supports the courage to move beyond emotional stagnation and seek a more honest direction.'},
    {number:'Nine',name:'Nine of Cups',suit:'Cups',keywords:'Contentment · Gratitude · Fulfilment',message:'A wish or source of satisfaction may be close. Enjoy what has been created, while remembering that lasting fulfilment includes gratitude and consideration for others.',benefit:'This card helps you recognise abundance, receive pleasure and appreciate genuine emotional progress.'},
    {number:'Ten',name:'Ten of Cups',suit:'Cups',keywords:'Harmony · Family · Shared joy',message:'Emotional security grows through shared values, honest communication and daily care. Appreciate the bond while continuing to contribute to its wellbeing.',benefit:'It highlights the possibility of lasting harmony and helps you nurture supportive relationships.'},
    {number:'Page',name:'Page of Cups',suit:'Cups',keywords:'Sensitivity · Message · Imagination',message:'A gentle message, feeling or creative idea may arrive unexpectedly. Stay receptive while giving emotion enough time to reveal its full meaning.',benefit:'This card encourages emotional curiosity, creative expression and a softer response to new information.'},
    {number:'Knight',name:'Knight of Cups',suit:'Cups',keywords:'Romance · Invitation · Idealism',message:'An offer or heartfelt pursuit may be sincere, though ideals should be balanced with facts. Let meaningful action confirm beautiful words.',benefit:'It helps you express feeling gracefully while keeping expectations realistic and mutually respectful.'},
    {number:'Queen',name:'Queen of Cups',suit:'Cups',keywords:'Compassion · Intuition · Emotional depth',message:'Sensitivity is a strength when it is protected by boundaries. Listen deeply to yourself and others without absorbing every emotion as your responsibility.',benefit:'This card supports compassionate understanding, intuitive awareness and healthier emotional boundaries.'},
    {number:'King',name:'King of Cups',suit:'Cups',keywords:'Balance · Wisdom · Emotional leadership',message:'Strong feeling can be held with steadiness. Respond from mature compassion, communicate calmly and avoid using emotional control to hide vulnerability.',benefit:'It helps you manage emotion wisely and bring calm, fair leadership to a sensitive situation.'},

    {number:'Ace',name:'Ace of Swords',suit:'Swords',keywords:'Clarity · Truth · Breakthrough',message:'A clear idea or honest realisation can cut through confusion. Use truth carefully, because accuracy without compassion can still cause unnecessary harm.',benefit:'This card helps you identify the central fact and make a cleaner, more informed decision.'},
    {number:'Two',name:'Two of Swords',suit:'Swords',keywords:'Stalemate · Choice · Inner conflict',message:'Avoiding a decision may be preserving temporary peace while increasing pressure. Gather the missing facts, acknowledge the emotion and choose a workable next step.',benefit:'It helps you move beyond indecision by balancing logic, intuition and practical consequence.'},
    {number:'Three',name:'Three of Swords',suit:'Swords',keywords:'Heartache · Truth · Release',message:'A painful truth or separation may need to be faced directly. Honour the hurt without turning it into a permanent identity or a reason to abandon trust.',benefit:'This card supports honest healing and helps you release pain through acceptance, expression and appropriate support.'},
    {number:'Four',name:'Four of Swords',suit:'Swords',keywords:'Rest · Recovery · Contemplation',message:'The mind needs a genuine pause before the next demand. Rest is part of progress when it restores clarity rather than becoming avoidance.',benefit:'It encourages recovery, quiet reflection and a calmer return to decisions that cannot be solved through exhaustion.'},
    {number:'Five',name:'Five of Swords',suit:'Swords',keywords:'Conflict · Tension · Consequences',message:'Winning an argument may still damage the relationship or larger goal. Consider whether pride, fear or poor communication is costing more than the issue itself.',benefit:'This card helps you recognise harmful conflict patterns and choose dignity, repair or strategic withdrawal.'},
    {number:'Six',name:'Six of Swords',suit:'Swords',keywords:'Transition · Passage · Recovery',message:'You may be moving away from difficulty even if the destination is not fully clear. Travel lightly, accept support and carry forward only the lessons you need.',benefit:'It offers reassurance during transition and helps you focus on steady movement toward calmer conditions.'},
    {number:'Seven',name:'Seven of Swords',suit:'Swords',keywords:'Strategy · Secrecy · Self-honesty',message:'A situation may involve avoidance, hidden motives or the need for careful strategy. Protect legitimate privacy, but do not let cleverness replace integrity.',benefit:'This card sharpens awareness and helps you distinguish wise discretion from dishonesty or self-deception.'},
    {number:'Eight',name:'Eight of Swords',suit:'Swords',keywords:'Restriction · Fear · Perspective',message:'The options may feel narrower than they truly are. Question the belief that says you are powerless and identify one practical freedom available now.',benefit:'It helps you challenge limiting thoughts and regain agency through a small, realistic action.'},
    {number:'Nine',name:'Nine of Swords',suit:'Swords',keywords:'Anxiety · Worry · Mental strain',message:'The mind may be repeating worst-case possibilities. Name the real concern, seek support and separate what requires action from what requires rest.',benefit:'This card helps bring private fear into perspective and encourages grounded help instead of silent overthinking.'},
    {number:'Ten',name:'Ten of Swords',suit:'Swords',keywords:'Ending · Exhaustion · Recovery',message:'A difficult cycle may have reached its limit. Stop fighting what is already complete, protect your wellbeing and begin rebuilding from the truth of the present.',benefit:'It helps you accept finality, end repeated suffering and recognise that recovery can begin now.'},
    {number:'Page',name:'Page of Swords',suit:'Swords',keywords:'Inquiry · Alertness · Communication',message:'Curiosity is active and information may be arriving quickly. Ask clear questions and verify what you hear before repeating or acting upon it.',benefit:'This card supports learning, sharper observation and more responsible communication.'},
    {number:'Knight',name:'Knight of Swords',suit:'Swords',keywords:'Speed · Conviction · Direct action',message:'Determination can produce rapid progress, but certainty may overlook important consequences. Act decisively after checking the facts and the effect on others.',benefit:'It helps channel mental force into focused action while reducing recklessness and unnecessary confrontation.'},
    {number:'Queen',name:'Queen of Swords',suit:'Swords',keywords:'Discernment · Independence · Honesty',message:'Clear boundaries and honest language are needed. Speak directly without becoming cold, and let experience refine judgment rather than harden the heart.',benefit:'This card helps you make an intelligent, self-respecting decision with both precision and fairness.'},
    {number:'King',name:'King of Swords',suit:'Swords',keywords:'Reason · Authority · Ethical judgment',message:'The situation calls for disciplined thought and impartial standards. Use knowledge responsibly, explain the reasoning and remain accountable to truth.',benefit:'It supports sound judgment, strategic leadership and decisions based on evidence rather than pressure.'},

    {number:'Ace',name:'Ace of Pentacles',suit:'Pentacles',keywords:'Opportunity · Foundation · Prosperity',message:'A practical opening may offer lasting value. Treat it as a seed: assess it carefully, then support it with consistent time, skill and stewardship.',benefit:'This card helps you recognise a tangible opportunity and begin building security in a grounded way.'},
    {number:'Two',name:'Two of Pentacles',suit:'Pentacles',keywords:'Balance · Adaptability · Priorities',message:'Several responsibilities require coordination. Flexibility will help, but lasting balance also requires deciding what deserves time and what can wait.',benefit:'It helps you organise competing demands and maintain movement without losing stability.'},
    {number:'Three',name:'Three of Pentacles',suit:'Pentacles',keywords:'Teamwork · Skill · Craftsmanship',message:'Good results grow through cooperation, useful feedback and respect for expertise. Contribute your strength while remaining willing to learn from others.',benefit:'This card supports skilled collaboration and helps turn individual effort into higher-quality shared work.'},
    {number:'Four',name:'Four of Pentacles',suit:'Pentacles',keywords:'Security · Control · Holding on',message:'Protecting resources may feel necessary, but excessive control can restrict growth and connection. Distinguish wise saving from fear-based attachment.',benefit:'It helps you create healthy security while becoming more flexible with money, energy or emotional possession.'},
    {number:'Five',name:'Five of Pentacles',suit:'Pentacles',keywords:'Hardship · Exclusion · Support',message:'Difficulty can create the feeling of being alone, yet assistance may be closer than it appears. Ask clearly, use available resources and avoid shame-based isolation.',benefit:'This card encourages practical support, resilience and recognition that a hard season does not define your future.'},
    {number:'Six',name:'Six of Pentacles',suit:'Pentacles',keywords:'Giving · Receiving · Fair exchange',message:'Resources are moving between people, and balance matters. Give without control, receive without shame and notice whether the exchange preserves dignity.',benefit:'It helps create healthier generosity, clearer agreements and more equitable sharing of time, money or support.'},
    {number:'Seven',name:'Seven of Pentacles',suit:'Pentacles',keywords:'Patience · Assessment · Investment',message:'Progress may be slower than hoped, but careful review is more useful than impatience. Evaluate what is growing and adjust where effort is not producing value.',benefit:'This card helps you assess long-term investment and make patient, evidence-based improvements.'},
    {number:'Eight',name:'Eight of Pentacles',suit:'Pentacles',keywords:'Practice · Mastery · Dedication',message:'Improvement comes through focused repetition and attention to detail. Keep learning, correct small errors and let quality become the visible result of discipline.',benefit:'It supports skill development and helps you build confidence through consistent, measurable practice.'},
    {number:'Nine',name:'Nine of Pentacles',suit:'Pentacles',keywords:'Independence · Comfort · Self-worth',message:'Your effort may be creating greater independence and stability. Enjoy what has been earned while remembering that true abundance includes peace, integrity and gratitude.',benefit:'This card helps you value self-sufficiency, refined choices and the rewards of sustained personal effort.'},
    {number:'Ten',name:'Ten of Pentacles',suit:'Pentacles',keywords:'Legacy · Family · Long-term security',message:'The focus extends beyond immediate gain toward lasting foundations. Consider how today’s choices affect family, community, reputation and future stability.',benefit:'It helps you plan for durable prosperity and align material success with shared values and legacy.'},
    {number:'Page',name:'Page of Pentacles',suit:'Pentacles',keywords:'Study · Practical beginning · Ambition',message:'A realistic opportunity to learn or build is presenting itself. Begin humbly, understand the requirements and create a routine that supports progress.',benefit:'This card encourages grounded ambition and helps turn interest into useful knowledge or a tangible result.'},
    {number:'Knight',name:'Knight of Pentacles',suit:'Pentacles',keywords:'Reliability · Routine · Persistence',message:'Steady work may seem slow, but consistency is the strength here. Continue carefully while checking that routine still serves the intended purpose.',benefit:'It helps you build dependable progress, honour commitments and avoid shortcuts that weaken the foundation.'},
    {number:'Queen',name:'Queen of Pentacles',suit:'Pentacles',keywords:'Nurture · Resourcefulness · Practical care',message:'Care becomes powerful when it is practical, sustainable and inclusive of your own needs. Create comfort without carrying every responsibility alone.',benefit:'This card supports wise resource management, grounded generosity and a healthier balance between care and self-care.'},
    {number:'King',name:'King of Pentacles',suit:'Pentacles',keywords:'Stability · Stewardship · Achievement',message:'Material success carries responsibility. Lead with patience, protect what has been built and use resources in ways that create security beyond personal gain.',benefit:'It helps you make mature financial or practical decisions and build prosperity through disciplined stewardship.'}
  );

  const cardArtwork = {
    'The Fool':'assets/tarot/the-fool.png',
    'The Magician':'assets/tarot/the-magician.png',
    'The High Priestess':'assets/tarot/the-high-priestess.png',
    'The Empress':'assets/tarot/the-empress.png',
    'The Hermit':'assets/tarot/the-hermit.png',
    'The Star':'assets/tarot/the-star.png'
  };
  const availableCards = cards.map(card => ({...card,image:cardArtwork[card.name] || ''}));

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
    const cardIndex = hashText(`${deviceToken()}|${todayKey}|${normaliseQuestion(question)}`) % availableCards.length;
    const selectedCard = availableCards[cardIndex];
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
