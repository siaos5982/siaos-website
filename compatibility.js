(() => {
  const form = document.querySelector('#compatibilityForm');
  if (!form) return;

  const yourDob = document.querySelector('#yourDob');
  const partnerDob = document.querySelector('#partnerDob');
  const today = new Date();
  const maxDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  yourDob.max = maxDate;
  partnerDob.max = maxDate;

  const profiles = {
    1:{planet:'Sun',gift:'initiative, confidence and direction',need:'respect and room to lead',shadow:'pride or impatience can make compromise difficult',communication:'direct appreciation followed by a clear request'},
    2:{planet:'Moon',gift:'sensitivity, cooperation and emotional awareness',need:'gentleness and reassurance',shadow:'unspoken hurt can grow when feelings are avoided',communication:'a calm tone and enough time to process emotion'},
    3:{planet:'Jupiter',gift:'optimism, wisdom and generous encouragement',need:'growth, purpose and honest appreciation',shadow:'big expectations can overlook practical details',communication:'shared ideas supported by one realistic next step'},
    4:{planet:'Rahu',gift:'originality, persistence and unconventional thinking',need:'stability without feeling controlled',shadow:'suspicion or rigidity can create unnecessary distance',communication:'facts, consistency and clearly defined boundaries'},
    5:{planet:'Mercury',gift:'adaptability, curiosity and lively communication',need:'variety, conversation and mental freedom',shadow:'restlessness can weaken follow-through',communication:'short, specific conversations with agreed action'},
    6:{planet:'Venus',gift:'care, loyalty and a strong sense of harmony',need:'affection, beauty and shared responsibility',shadow:'over-giving can become expectation or resentment',communication:'warmth combined with fair division of effort'},
    7:{planet:'Ketu',gift:'intuition, observation and spiritual depth',need:'privacy, trust and meaningful connection',shadow:'withdrawal can be mistaken for rejection',communication:'patient questions without pressure for an instant answer'},
    8:{planet:'Saturn',gift:'discipline, endurance and commitment',need:'reliability and respect for responsibility',shadow:'seriousness can become emotional distance or control',communication:'practical honesty softened by visible appreciation'},
    9:{planet:'Mars',gift:'courage, passion and protective energy',need:'purpose, movement and emotional honesty',shadow:'intensity can turn a small disagreement into a contest',communication:'a pause before responding and one issue at a time'}
  };

  const compatibilityMatrix = [
    [86,84,88,58,82,67,64,52,91],
    [84,88,90,62,66,92,86,55,81],
    [88,90,91,60,86,88,68,59,90],
    [58,62,60,82,84,64,88,80,66],
    [82,66,86,84,89,87,70,72,83],
    [67,92,88,64,87,92,78,68,86],
    [64,86,68,88,70,78,88,73,82],
    [52,55,59,80,72,68,73,84,76],
    [91,81,90,66,83,86,82,76,90]
  ];

  const reduceNumber = value => {
    let number = Number(value);
    while (number > 9) number = String(number).split('').reduce((sum,digit) => sum + Number(digit),0);
    return number;
  };
  const numbersFromDob = value => {
    const [year,month,day] = value.split('-').map(Number);
    return {
      mulank:reduceNumber(day),
      bhagyank:reduceNumber(String(year).split('').reduce((sum,digit) => sum + Number(digit),0) + reduceNumber(month) + reduceNumber(day))
    };
  };
  const pairScore = (first,second) => compatibilityMatrix[first - 1][second - 1];
  const scoreLabel = score => score >= 85 ? 'Natural harmony' : score >= 72 ? 'Strong potential' : score >= 60 ? 'Growth relationship' : 'Conscious balance needed';

  form.addEventListener('submit',async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const you = numbersFromDob(yourDob.value);
    const partner = numbersFromDob(partnerDob.value);
    const score = Math.round(
      pairScore(you.mulank,partner.mulank) * .5 +
      pairScore(you.bhagyank,partner.bhagyank) * .35 +
      pairScore(you.mulank,partner.bhagyank) * .075 +
      pairScore(partner.mulank,you.bhagyank) * .075
    );
    const yourProfile = profiles[you.mulank];
    const partnerProfile = profiles[partner.mulank];
    const yourPath = profiles[you.bhagyank];
    const partnerPath = profiles[partner.bhagyank];

    const sections = [
      {label:'Overall pattern',title:scoreLabel(score),copy:`Mulank ${you.mulank} and Mulank ${partner.mulank} combine ${yourProfile.gift} with ${partnerProfile.gift}. This works best when both qualities are valued rather than compared.`},
      {label:'How this benefits you',title:'What naturally supports the bond',copy:`Your numbers can build strength through ${yourProfile.need}, while your partner responds to ${partnerProfile.need}. Mutual appreciation can turn these different needs into complementary support.`},
      {label:'Problems to watch',title:'Where friction may appear',copy:`${yourProfile.shadow}. For your partner, ${partnerProfile.shadow}. Repeated conflict is more likely when either person expects the other to communicate in exactly the same way.`},
      {label:'Long-term rhythm',title:`Bhagyank ${you.bhagyank} × ${partner.bhagyank}`,copy:`Your deeper paths bring ${yourPath.gift} together with ${partnerPath.gift}. Long-term plans improve when purpose and responsibility are discussed openly.`},
      {label:'The numbers’ message',title:'How to understand each other',copy:`You respond best to ${yourProfile.communication}. Your partner responds best to ${partnerProfile.communication}. Both styles deserve space in important conversations.`},
      {label:'Meaning of the score',title:'Potential, not fixed destiny',copy:`${score}% indicates ${scoreLabel(score).toLowerCase()}. Everyday behaviour, communication and shared values can strengthen or weaken the potential shown by the numbers.`}
    ];

    const report = {
      score,
      yourMulank:you.mulank,
      yourBhagyank:you.bhagyank,
      partnerMulank:partner.mulank,
      partnerBhagyank:partner.bhagyank,
      label:scoreLabel(score),
      sections,
      createdAt:new Date().toISOString()
    };

    try {
      sessionStorage.setItem('siaosCompatibility',JSON.stringify(report));
      await window.SIAOSAccount?.saveReading({readingType:'compatibility',title:'Mulank & Bhagyank Compatibility',summary:{score:report.score,yourMulank:report.yourMulank,partnerMulank:report.partnerMulank},payload:report,createdAt:report.createdAt});
      location.href = 'compatibility-report.html';
    } catch {
      alert('Your browser could not prepare the report. Please allow session storage and try again.');
    }
  });
})();
