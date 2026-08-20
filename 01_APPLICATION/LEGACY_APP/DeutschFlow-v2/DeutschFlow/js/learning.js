(function(){
  "use strict";
  const DF=window.DF;

  function cardFor(state,wordId,skill){return state.cardsMap.get(`${wordId}:${skill}`)||null;}
  function ensureCardInMemory(state,wordId,skill,{dueAt=Date.now(),stateName="new"}={}){
    const key=`${wordId}:${skill}`;let card=state.cardsMap.get(key);
    if(!card){card=DF.createCard(wordId,skill);card.dueAt=dueAt;card.state=stateName;state.cards.push(card);state.cardsMap.set(key,card);}
    return card;
  }
  async function persistCard(state,card){
    card.updatedAt=Date.now();state.cardsMap.set(card.key,card);
    const idx=state.cards.findIndex(c=>c.key===card.key);if(idx>=0)state.cards[idx]=card;else state.cards.push(card);
    await DF.DB.put("cards",card);
  }

  function questionFor(state,entry){
    const word=state.wordsMap.get(entry.wordId);
    const card=entry.skill?cardFor(state,entry.wordId,entry.skill):null;
    if(entry.kind==="intro")return {kind:"intro",word,entry};
    const skill=entry.skill||"recall";
    if(skill==="recognition"){
      const pool=state.words.filter(w=>!w.ignored&&w.id!==word.id&&w.itemType===word.itemType&&w.normalizedArabic!==word.normalizedArabic);
      const distractors=DF.sample(DF.uniqueBy(pool,w=>w.normalizedArabic),3);
      const choices=DF.shuffle([{id:String(word.id),label:word.arabic},...distractors.map(w=>({id:String(w.id),label:w.arabic}))]);
      return {kind:"test",skill,word,card,entry,prompt:word.german,promptLang:"de",choices,correctId:String(word.id),label:"اختر المعنى العربي الصحيح"};
    }
    if(skill==="article"){
      const rest=DF.splitArticle(word.german).rest;
      const choices=DF.ARTICLES.map(x=>({id:x,label:x}));
      return {kind:"test",skill,word,card,entry,prompt:rest,promptLang:"de",choices,correctId:word.article,label:"اختر أداة التعريف الصحيحة"};
    }
    if(skill==="order"){
      const cleaned=word.german.replace(/[.!?]+$/g,"").trim();
      const tokens=DF.shuffle(cleaned.split(/\s+/).filter(Boolean));
      return {kind:"test",skill,word,card,entry,prompt:word.arabic,promptLang:"ar",tokens,expected:cleaned,label:"رتّب كلمات الجملة الألمانية"};
    }
    return {kind:"test",skill:"recall",word,card,entry,prompt:word.arabic,promptLang:"ar",expected:word.german,label:word.itemType==="sentence"?"اكتب الجملة بالألمانية":"اكتب الكلمة بالألمانية"};
  }

  function statusPriority(card,now=Date.now()){
    const s=DF.cardStatus(card,now);return ({overdue:0,due:1,weak:2,learning:3,new:4,mastered:5,ignored:9})[s]??6;
  }
  function activeWords(state){return state.words.filter(w=>!w.ignored);}
  function learnedWordIds(state){
    const ids=new Set();for(const c of state.cards){if(c.reps>0||c.state!=="new")ids.add(c.wordId);}return ids;
  }
  function pickDueCards(state,limit,{skills=null,weakOnly=false,mistakesOnly=false}={}){
    const now=Date.now(),seen=new Set();
    let cards=state.cards.filter(c=>!c.suspended&&state.wordsMap.has(c.wordId));
    if(skills)cards=cards.filter(c=>skills.includes(c.skill));
    if(weakOnly)cards=cards.filter(c=>DF.cardStatus(c,now)==="weak"||c.lapses>=2||c.wrong>c.correct);
    else if(mistakesOnly)cards=cards.filter(c=>c.wrong>0).sort((a,b)=>(b.wrong-b.correct)-(a.wrong-a.correct));
    else cards=cards.filter(c=>c.dueAt<=now||DF.cardStatus(c,now)==="weak");
    cards.sort((a,b)=>statusPriority(a,now)-statusPriority(b,now)||(a.dueAt||0)-(b.dueAt||0)||(b.lapses-a.lapses));
    const out=[];for(const c of cards){if(seen.has(c.wordId))continue;seen.add(c.wordId);out.push(c);if(out.length>=limit)break;}return out;
  }
  function pickNewWords(state,limit){
    const learned=learnedWordIds(state);
    const candidates=activeWords(state).filter(w=>!learned.has(w.id));
    // Keep source order stable but rotate the starting point daily for variety.
    const offset=candidates.length?Math.abs(hashString(DF.localDateKey()))%candidates.length:0;
    const rotated=candidates.slice(offset).concat(candidates.slice(0,offset));
    return rotated.slice(0,limit);
  }
  function hashString(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return h;}

  function baseSession(mode){return{
    id:DF.makeId("session"),mode,queue:[],current:null,result:null,startedAt:Date.now(),updatedAt:Date.now(),done:false,
    initialCards:0,initialWords:0,initialCompleted:0,introduced:0,attempts:0,correctAttempts:0,wrongAttempts:0,
    firstPassCorrect:0,firstPassWrong:0,reveals:0,hints:0,xp:0,retriesCompleted:0
  };}
  function addInitialTest(session,card){session.queue.push({id:DF.makeId("q"),kind:"test",wordId:card.wordId,skill:card.skill,initial:true,retryCount:0});session.initialCards++;}
  function addIntro(session,word){session.queue.push({id:DF.makeId("intro"),kind:"intro",wordId:word.id,skill:null,initial:false,retryCount:0});session.initialCards++;}

  async function buildSession(state,mode){
    const s=baseSession(mode),settings=state.settings;
    const cap=Math.max(1,settings.sessionSize||20);
    if(mode==="daily"){
      const due=pickDueCards(state,Math.min(settings.reviewsPerDay||40,cap));
      due.forEach(c=>addInitialTest(s,c));
      const remaining=Math.max(0,cap-due.length),newCount=Math.min(settings.newPerDay||12,remaining);
      pickNewWords(state,newCount).forEach(w=>addIntro(s,w));
    }else if(mode==="new"){
      pickNewWords(state,Math.min(cap,settings.newPerDay||12)).forEach(w=>addIntro(s,w));
    }else if(mode==="due"){
      pickDueCards(state,cap).forEach(c=>addInitialTest(s,c));
    }else if(mode==="weak"){
      pickDueCards(state,cap,{weakOnly:true}).forEach(c=>addInitialTest(s,c));
    }else if(mode==="mistakes"){
      pickDueCards(state,cap,{mistakesOnly:true}).forEach(c=>addInitialTest(s,c));
    }else if(mode==="article"){
      const due=pickDueCards(state,cap,{skills:["article"]}),seen=new Set(due.map(c=>c.wordId));
      due.forEach(c=>addInitialTest(s,c));
      const nouns=DF.shuffle(activeWords(state).filter(w=>w.itemType==="noun"&&w.article&&!seen.has(w.id)));
      for(const w of nouns){if(s.initialCards>=cap)break;addInitialTest(s,ensureCardInMemory(state,w.id,"article"));}
    }else if(mode==="writing"){
      const due=pickDueCards(state,cap,{skills:["recall"]}),seen=new Set(due.map(c=>c.wordId));
      due.forEach(c=>addInitialTest(s,c));
      const candidates=DF.shuffle(activeWords(state).filter(w=>!seen.has(w.id)));
      for(const w of candidates){if(s.initialCards>=cap)break;addInitialTest(s,ensureCardInMemory(state,w.id,"recall"));}
    }else if(mode==="quick"){
      const due=pickDueCards(state,10),seen=new Set(due.map(c=>c.wordId));due.forEach(c=>addInitialTest(s,c));
      if(s.initialCards<10){for(const w of pickNewWords(state,10-s.initialCards)){if(!seen.has(w.id))addIntro(s,w);}}
    }
    s.initialWords=new Set(s.queue.map(x=>x.wordId)).size;
    await DF.DB.setMeta("session",s);
    return s;
  }

  function pendingRetries(session){return session.queue.filter(x=>x.kind==="test"&&!x.initial).length;}
  function progress(session){
    const planned=Math.max(1,session.initialCards),completed=Math.min(session.initialCompleted,session.initialCards),retries=pendingRetries(session);
    const percent=Math.round(Math.min(1,completed/Math.max(1,planned+retries))*100);
    return {planned,completed,percent,pendingRetries:retries};
  }

  async function beginCurrent(state){
    const s=state.session;if(!s)return null;
    if(s.result)return s.current;
    if(!s.queue.length){s.done=true;s.current=null;s.updatedAt=Date.now();await completeSession(state);return null;}
    s.current=questionFor(state,s.queue[0]);s.current.startedAt=Date.now();s.current.usedHint=false;s.current.revealed=false;s.result=null;s.updatedAt=Date.now();await DF.DB.setMeta("session",s);return s.current;
  }

  function evaluateChoice(question,id){
    const ok=String(id)===String(question.correctId);
    return {type:ok?"perfect":"wrong",isCorrect:ok,correctAnswer:question.skill==="recognition"?question.word.arabic:question.correctId,userAnswer:id,note:ok?"إجابة صحيحة.":question.skill==="article"?`الأداة الصحيحة: ${question.correctId}.`:"الإجابة غير صحيحة.",quality:ok?1:0};
  }
  function evaluateOrder(question,tokens){
    const user=(tokens||[]).join(" ").trim();
    return DF.validateGermanAnswer(user,question.word,{...DF.DEFAULT_SETTINGS,ignoreSentencePunctuation:true,requireArticle:false},question.expected);
  }
  async function submitAnswer(state,payload){
    const s=state.session,q=s?.current;if(!s||!q||s.result||q.kind!=="test")return;
    let answer;
    if(q.choices)answer=evaluateChoice(q,payload.choiceId);
    else if(q.skill==="order")answer=evaluateOrder(q,payload.tokens||[]);
    else answer=DF.validateGermanAnswer(payload.text,q.word,state.settings,q.expected);
    const elapsed=Date.now()-q.startedAt;
    const suggestedRating=DF.automaticRating(answer,{usedHint:q.usedHint,revealed:false,elapsedMs:elapsed});
    s.result={answer,elapsedMs:elapsed,suggestedRating,revealed:false};
    s.updatedAt=Date.now();await DF.DB.setMeta("session",s);
  }
  async function revealAnswer(state){
    const s=state.session,q=s?.current;if(!s||!q||s.result||q.kind!=="test")return;
    q.revealed=true;
    s.result={answer:{type:"revealed",isCorrect:false,correctAnswer:q.skill==="article"?q.word.article:q.skill==="recognition"?q.word.arabic:q.expected||q.word.german,userAnswer:"",note:"تم عرض الإجابة. ستُعاد البطاقة داخل الجلسة.",quality:0},elapsedMs:Date.now()-q.startedAt,suggestedRating:1,revealed:true};
    s.updatedAt=Date.now();await DF.DB.setMeta("session",s);
  }
  async function useHint(state){
    const s=state.session,q=s?.current;if(!s||!q||q.usedHint)return;
    q.usedHint=true;s.hints++;s.updatedAt=Date.now();await DF.DB.setMeta("session",s);
  }

  async function introduceWord(state,known=false){
    const s=state.session,q=s?.current;if(!s||!q||q.kind!=="intro")return;
    const entry=s.queue.shift(),word=q.word;
    s.introduced++;
    const recall=ensureCardInMemory(state,word.id,"recall",{dueAt:Date.now(),stateName:"new"});
    if(known){
      const scheduled=DF.scheduleCard({...recall,reps:2,correct:2,state:"review",intervalDays:7},4,Date.now());
      scheduled.intervalDays=30;scheduled.dueAt=Date.now()+30*DF.DAY;scheduled.state="review";scheduled.mastery=70;
      await persistCard(state,scheduled);s.xp+=4;s.initialCompleted++;
    }else{
      await persistCard(state,recall);
      const test={id:DF.makeId("q"),kind:"test",wordId:word.id,skill:"recall",initial:true,retryCount:0};
      const at=Math.min(3,s.queue.length);s.queue.splice(at,0,test);
    }
    s.current=null;s.result=null;s.updatedAt=Date.now();await DF.DB.setMeta("session",s);await beginCurrent(state);
  }

  function ratingName(r){return({1:"again",2:"hard",3:"good",4:"easy"})[r]||"good";}
  async function finalizeAnswer(state,rating=null){
    const s=state.session,q=s?.current,r=s?.result;if(!s||!q||!r)return;
    const entry=s.queue.shift();
    const finalRating=(!r.answer.isCorrect||r.revealed)?1:Number(rating||r.suggestedRating||1);
    let card=q.card||ensureCardInMemory(state,q.word.id,q.skill);
    card=DF.scheduleCard(card,finalRating,Date.now());
    await persistCard(state,card);

    s.attempts++;
    const correct=r.answer.isCorrect;
    if(correct){s.correctAttempts++;s.xp+=q.usedHint?6:10;}else{s.wrongAttempts++;s.xp+=1;}
    if(r.revealed)s.reveals++;
    if(entry.initial){s.initialCompleted++;if(correct)s.firstPassCorrect++;else s.firstPassWrong++;}
    else s.retriesCompleted++;

    await DF.DB.add("attempts",{
      sessionId:s.id,wordId:q.word.id,cardKey:card.key,skill:q.skill,correct,answerType:r.answer.type,rating:finalRating,
      usedHint:!!q.usedHint,revealed:!!r.revealed,elapsedMs:r.elapsedMs,userAnswer:r.answer.userAnswer||"",correctAnswer:r.answer.correctAnswer||"",createdAt:Date.now()
    });

    if(correct&&card.reps>=1){
      const unlocks=DF.nextSkillUnlocks(q.word,q.skill);
      for(let i=0;i<unlocks.length;i++){
        const skill=unlocks[i],existing=cardFor(state,q.word.id,skill);
        if(!existing){const c=DF.createCard(q.word.id,skill);c.dueAt=Date.now()+(i+1)*DF.DAY;c.state="new";await persistCard(state,c);}
      }
    }
    const shouldRetry=(!correct||r.revealed)&&entry.retryCount<(state.settings.retryLimit??2);
    if(shouldRetry){
      const retry={id:DF.makeId("retry"),kind:"test",wordId:q.word.id,skill:q.skill,initial:false,retryCount:(entry.retryCount||0)+1};
      const at=Math.min(4,s.queue.length);s.queue.splice(at,0,retry);
    }
    s.current=null;s.result=null;s.updatedAt=Date.now();await DF.DB.setMeta("session",s);await beginCurrent(state);
  }

  async function completeSession(state){
    const s=state.session;if(!s||!s.done)return;
    const profile={...(state.profile||{})},today=DF.localDateKey();
    if(profile.lastStudyDate!==today){
      const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
      profile.streak=profile.lastStudyDate===DF.localDateKey(yesterday)?(profile.streak||0)+1:1;
      profile.lastStudyDate=today;
    }
    profile.totalXP=(profile.totalXP||0)+(s.xp||0);profile.lastSessionAt=Date.now();profile.sessions=(profile.sessions||0)+1;
    state.profile=profile;await DF.DB.setMeta("profile",profile);await DF.DB.setMeta("session",s);
  }
  async function abandonSession(state,{discard=false}={}){
    if(discard){state.session=null;await DF.DB.setMeta("session",null);}
    else if(state.session){state.session.updatedAt=Date.now();await DF.DB.setMeta("session",state.session);}
  }
  async function resumeSession(state){
    const s=await DF.DB.getMeta("session",null);if(s&&!s.done){state.session=s;await beginCurrent(state);return s;}return null;
  }

  function sessionAccuracy(session){
    const firstTotal=session.firstPassCorrect+session.firstPassWrong;
    const attemptTotal=session.correctAttempts+session.wrongAttempts;
    return {
      first:firstTotal?Math.round((session.firstPassCorrect/firstTotal)*100):null,
      attempts:attemptTotal?Math.round((session.correctAttempts/attemptTotal)*100):null
    };
  }

  Object.assign(DF,{Learning:{cardFor,ensureCardInMemory,persistCard,questionFor,pickDueCards,pickNewWords,buildSession,beginCurrent,submitAnswer,revealAnswer,useHint,introduceWord,finalizeAnswer,completeSession,abandonSession,resumeSession,progress,pendingRetries,sessionAccuracy,ratingName}});
})();
