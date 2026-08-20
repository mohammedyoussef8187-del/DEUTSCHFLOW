import { DAY, MINUTE, clamp, round } from "../core/utils.js";

export function createCard(wordId,skill,now=Date.now()){
  return {
    key:`${wordId}:${skill}`,
    wordId,
    skill,
    state:"new",
    dueAt:now,
    intervalDays:0,
    ease:2.5,
    stability:0,
    difficulty:5,
    reps:0,
    lapses:0,
    correct:0,
    wrong:0,
    streak:0,
    mastery:0,
    lastReviewedAt:null,
    lastResult:null,
    suspended:false,
    createdAt:now,
    updatedAt:now
  };
}

export function scheduleCard(card,rating,now=Date.now()){
  const c={...card};
  const r=Number(rating);
  c.lastReviewedAt=now;c.updatedAt=now;c.lastResult=r;
  if(r<=1){
    c.lapses+=1;c.wrong+=1;c.streak=0;c.ease=Math.max(1.3,round(c.ease-.2,2));
    c.stability=Math.max(.1,c.stability*.45);
    c.intervalDays=0;
    c.dueAt=now+10*MINUTE;
    c.state="learning";
  }else{
    c.correct+=1;c.reps+=1;c.streak+=1;
    const factor=r===2?1.2:r===3?Math.max(1.7,c.ease):Math.max(2.4,c.ease+.35);
    c.ease=clamp(round(c.ease+(r===2?-.08:r===3?.02:.08),2),1.3,3.2);
    if(c.reps===1)c.intervalDays=r===2?1:r===3?1:3;
    else if(c.reps===2)c.intervalDays=r===2?2:r===3?4:7;
    else c.intervalDays=Math.max(1,Math.round(Math.max(1,c.intervalDays)*factor));
    c.stability=Math.max(1,round((c.stability||1)*factor,2));
    c.dueAt=now+c.intervalDays*DAY;
    c.state=c.intervalDays>=30&&c.reps>=5?"mastered":"review";
  }
  c.mastery=cardMastery(c);
  return c;
}

export function cardMastery(card){
  if(!card||card.state==="new")return 0;
  const base=Math.min(70,card.reps*11);
  const interval=Math.min(25,Math.log2((card.intervalDays||0)+1)*7);
  const streak=Math.min(12,(card.streak||0)*2);
  const penalty=Math.min(35,(card.lapses||0)*7);
  return Math.round(clamp(base+interval+streak-penalty));
}

export function automaticRating(answer,{usedHint=false,revealed=false,elapsedMs=0}={}){
  if(revealed||!answer?.isCorrect)return 1;
  if(usedHint||["capitalization","umlaut_variant","punctuation"].includes(answer.type)||elapsedMs>18000)return 2;
  if(answer.type==="perfect"&&elapsedMs<7000)return 4;
  return 3;
}

export function skillLabel(skill){return({recall:"الاستدعاء والكتابة",recognition:"التعرّف على المعنى",article:"أداة الاسم",order:"ترتيب الجملة"})[skill]||skill;}
export function skillWeight(word,skill){
  if(skill==="recall")return .5;
  if(skill==="recognition")return .2;
  if(skill==="article"&&word.itemType==="noun")return .3;
  if(skill==="order"&&word.itemType==="sentence")return .08;
  return .15;
}

export function wordMastery(word,cards){
  const relevant=cards.filter(c=>c.wordId===word.id&&!c.suspended);
  if(!relevant.length)return 0;
  let sum=0,w=0;for(const c of relevant){const wt=skillWeight(word,c.skill);sum+=cardMastery(c)*wt;w+=wt;}
  return Math.round(w?sum/w:0);
}

export function wordStatus(word,cards,now=Date.now()){
  if(word.ignored)return"ignored";
  const relevant=cards.filter(c=>c.wordId===word.id&&!c.suspended);
  if(!relevant.length||relevant.every(c=>c.state==="new"))return"new";
  const mastery=wordMastery(word,relevant);
  if(relevant.some(c=>c.dueAt&&c.dueAt<now-DAY))return"overdue";
  if(relevant.some(c=>c.dueAt&&c.dueAt<=now))return"due";
  if(relevant.some(c=>c.lapses>=2||c.wrong>c.correct)&&mastery<60)return"weak";
  if(mastery>=85&&relevant.every(c=>(c.intervalDays||0)>=30))return"mastered";
  return"learning";
}

export function cardStatus(card,now=Date.now()){
  if(card.suspended)return"ignored";
  if(card.state==="new")return"new";
  if(card.dueAt<now-DAY)return"overdue";
  if(card.dueAt<=now)return"due";
  if(card.lapses>=2&&card.mastery<60)return"weak";
  if(card.mastery>=85&&card.intervalDays>=30)return"mastered";
  return"learning";
}

export function preferredSkills(word){
  const skills=["recall","recognition"];
  if(word.itemType==="noun"&&word.article)skills.push("article");
  /* ترتيب الجملة تدريب مساعد، وليس شرطاً للإتقان في الوضع الصعب. */
  return skills;
}

export function nextSkillUnlocks(word,skill){
  if(skill!=="recall")return[];
  const out=["recognition"];
  if(word.itemType==="noun"&&word.article)out.push("article");
  /* لا تُفتح بطاقة ترتيب تلقائياً؛ الاستدعاء الكتابي هو المعيار الأساسي. */
  return out;
}
