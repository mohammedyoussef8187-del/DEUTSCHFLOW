import { DAY, MINUTE, DEFAULT_SETTINGS, esc, clamp, round, randomUnit, randomInt, shuffle, sample, uniqueBy, localDateKey, startOfLocalDay, formatDate, formatRelative } from "./core/utils.js";
import { ARTICLES, normalizeGerman, normalizeArabic, foldGerman, splitArticle, inferItemType } from "./core/text.js";
import { levenshtein, validateGermanAnswer, validateArticleAnswer, validateArabicAnswer, arabicTokenScore } from "./exercises/answer-evaluator.js";
import { createCard, scheduleCard, cardMastery, automaticRating, skillLabel, skillWeight, wordMastery, wordStatus, cardStatus, preferredSkills, nextSkillUnlocks } from "./srs/scheduler.js";
import { createRepositories } from "./data/repositories.js";
import { createIndexedDbAdapter } from "./platform/indexeddb/adapter.js";
import { summarizeLearnerState } from "./services/review-summary-service.js";
import "./ui/components/df-review-summary.js";
import "./ui/components/df-stat-tile.js";

(function(){
  "use strict";
  const DF=window.DF=window.DF||{};

  const DATA_PATCHES={
    17:{arabic:"سهل / خفيف",qualityNote:"تم تصحيح ترجمة مؤكدة: leicht ليست «ضوء»."},
    30:{arabic:"من الجميل أن أكون هنا من جديد.",acceptedArabicAnswers:["من الجميل العودة إلى هنا.","من الجميل أن أعود إلى هنا.","من الجميل أن أكون هنا مرة أخرى."],qualityNote:"تم استكمال معنى hier وzu sein في الترجمة."},
    54:{arabic:"معلومات",qualityNote:"تم تصحيح المفرد إلى الجمع بما يتوافق مع Informationen."},
    107:{arabic:"تركيا",qualityNote:"تم تصحيح ترجمة مؤكدة لاسم الدولة."},
    2791:{arabic:"يعيد الإرسال / يرسل مجدداً",acceptedArabicAnswers:["يرسل مرة أخرى","يعيد إرسال الشيء"],qualityNote:"تم تصحيح معنى zurückschicken."},
    2792:{arabic:"يوافق / يؤكد",acceptedArabicAnswers:["يؤكد الحضور","يعطي موافقته"],qualityNote:"تم تصحيح معنى zusagen؛ يحدد السياق الصياغة الأدق."},
    2796:{arabic:"يتناسبان / يلائمان بعضهما",acceptedArabicAnswers:["يتناسب مع","ينسجم مع"],qualityNote:"تم تصحيح معنى zusammenpassen."},
    2816:{arabic:"يفكر / يتأمل",acceptedArabicAnswers:["يفكر في الأمر","يتروى"],qualityNote:"اعتمدت صيغة الفعل überlegen؛ الصفة überlegen لها معنى مختلف."},
    2820:{arabic:"يحوّل المال",acceptedArabicAnswers:["يحوّل مبلغاً","يجري تحويلاً بنكياً"],qualityNote:"تم تحويل المصدر العربي إلى معنى فعلي مناسب لـ überweisen."}
  };

  const DATA_EXCLUSIONS=new Map([
    [1115,"مدخل مبتور: der Glauben (Ich glaube"],
    [1260,"مدخل مشوه ناتج عن مرجع تمرين"],
    [1336,"مدخل مشوه ناتج عن مرجع تمرين"]
  ]);

  function dataAudit(words){
    const byGerman=new Map(),byPair=new Map(),byArabic=new Map();
    for(const w of words){
      const g=normalizeGerman(w.german),a=normalizeArabic(w.arabic);
      if(g){if(!byGerman.has(g))byGerman.set(g,[]);byGerman.get(g).push(w);}
      if(g||a){const k=g+"|"+a;if(!byPair.has(k))byPair.set(k,[]);byPair.get(k).push(w);}
      if(a){if(!byArabic.has(a))byArabic.set(a,[]);byArabic.get(a).push(w);}
    }
    const exactDuplicates=[],conflictingGerman=[],ambiguousArabic=[];
    for(const [key,list] of byPair)if(list.length>1)exactDuplicates.push({key,ids:list.map(x=>x.id),german:list[0].german,arabic:list[0].arabic,count:list.length});
    for(const [key,list] of byGerman){const meanings=[...new Set(list.map(x=>normalizeArabic(x.arabic)).filter(Boolean))];if(meanings.length>1)conflictingGerman.push({key,ids:list.map(x=>x.id),german:list[0].german,meanings:list.map(x=>x.arabic),count:list.length});}
    for(const [key,list] of byArabic){const forms=[...new Set(list.map(x=>normalizeGerman(x.german)).filter(Boolean))];if(forms.length>1)ambiguousArabic.push({key,ids:list.map(x=>x.id),arabic:list[0].arabic,german:list.map(x=>x.german),count:list.length});}
    const review=words.filter(w=>w.qualityStatus==="review"),ignored=words.filter(w=>w.ignored),flagged=words.filter(w=>w.userFlagged);
    return {total:words.length,review:review.length,ignored:ignored.length,flagged:flagged.length,exactDuplicates,conflictingGerman,ambiguousArabic,structurallyClean:words.length-review.length,generatedAt:Date.now()};
  }
  function attemptAnalytics(attempts){
    const valid=attempts.filter(a=>a&&a.skill),total=valid.length,correct=valid.filter(a=>a.correct).length;
    const first=valid.filter(a=>a.initial!==false),firstCorrect=first.filter(a=>a.correct).length,avgMs=total?Math.round(valid.reduce((s,a)=>s+(Number(a.elapsedMs)||0),0)/total):0;
    const skills={},errors={};
    for(const a of valid){
      const k=a.skill||"unknown";if(!skills[k])skills[k]={total:0,correct:0,wrong:0,hints:0,reveals:0,elapsed:0};
      const x=skills[k];x.total++;a.correct?x.correct++:x.wrong++;if(a.usedHint)x.hints++;if(a.revealed)x.reveals++;x.elapsed+=Number(a.elapsedMs)||0;
      if(!a.correct){const e=a.answerType||"wrong";errors[e]=(errors[e]||0)+1;}
    }
    for(const x of Object.values(skills)){x.accuracy=x.total?Math.round(x.correct/x.total*100):0;x.avgMs=x.total?Math.round(x.elapsed/x.total):0;}
    return {total,correct,wrong:total-correct,accuracy:total?Math.round(correct/total*100):null,firstTotal:first.length,firstCorrect,firstAccuracy:first.length?Math.round(firstCorrect/first.length*100):null,avgMs,skills,errors};
  }

  function qualityIssues(word){
    const issues=[];
    const g=String(word.german||""),a=String(word.arabic||"");
    const balance=(s,o,c)=>(s.match(new RegExp(`\\${o}`,"g"))||[]).length===(s.match(new RegExp(`\\${c}`,"g"))||[]).length;
    if(word.userFlagged)issues.push("أبلغ المستخدم عن مشكلة لغوية أو بياناتية");
    if(!g.trim()||!a.trim())issues.push("بيانات أساسية ناقصة");
    if(!balance(g,"(",")")||!balance(a,"(",")"))issues.push("قوس غير مغلق");
    if(/\b[A-Z]\s*\/\s*\d+[a-z]?\b/i.test(g)||/\b\d+[a-z]?\s*\/\s*[A-Z]\b/i.test(g))issues.push("يبدو أنه يحتوي على مرجع تمرين");
    if(/\b(platz|sofort|planen)\s+[A-Z]\s*\/\s*\d/i.test(g))issues.push("مدخل مشوه محتمل من جدول أو تمرين");
    if(g.length>180||a.length>220)issues.push("طول غير معتاد");
    if(word.itemType==="noun"&&!word.article)issues.push("اسم دون أداة تعريف");
    if(word.article&&!normalizeGerman(g,{stripPunctuation:false}).startsWith(word.article+" "))issues.push("الأداة لا تطابق بداية المدخل");
    const gTokens=normalizeGerman(g).split(" ").filter(Boolean).length,aTokens=normalizeArabic(a).split(" ").filter(Boolean).length;
    if(word.itemType==="sentence"&&gTokens>=6&&aTokens>0&&aTokens/gTokens<.48)issues.push("الترجمة العربية مختصرة بصورة تحتاج مراجعة");
    if(/^[\d\W_]+$/.test(g))issues.push("لا يحتوي على كلمة ألمانية صالحة");
    if(/\b(seite|aufgabe|lektion|kapitel)\s*\d+/i.test(g))issues.push("مرجع كتاب أو تمرين داخل المدخل");
    if(/[<>\[\]{}]|\.{3,}/.test(g))issues.push("رموز أو جزء مبتور يحتاج مراجعة");
    if(word.itemType==="sentence"&&!/[.!?…]$/.test(g.trim())&&gTokens>=7)issues.push("جملة طويلة دون نهاية واضحة");
    if(/^die\s+[A-ZÄÖÜ][a-zäöüß]+$/.test(g)&&/^(هو|هي|يفعل|يكون|يذهب|يعود)$/.test(normalizeArabic(a)))issues.push("احتمال تعارض بين اسم ألماني وترجمة فعلية عامة");
    return issues;
  }
  function applyPatchToSeed(seed){
    const p=DATA_PATCHES[seed.id]||{};
    const german=p.german??seed.de;
    const arabic=p.arabic??seed.ar;
    const pronunciation=p.pronunciation??seed.pr??"";
    let article=(p&&Object.prototype.hasOwnProperty.call(p,"article")?p.article:(seed.art??splitArticle(german).article));
    let itemType=p.itemType??seed.it??inferItemType(german,article);
    if(ARTICLES.includes(normalizeGerman(german,{stripPunctuation:false}))&&!splitArticle(german).rest.includes(" ")){article=null;itemType="word";}
    const word={
      id:seed.id,
      german,
      arabic,
      pronunciation,
      normalizedGerman:normalizeGerman(german),
      normalizedArabic:normalizeArabic(arabic),
      itemType,
      article,
      plural:p.plural??"",
      level:p.level??"",
      tags:Array.isArray(p.tags)?p.tags:[],
      acceptedAnswers:Array.isArray(p.acceptedAnswers)?p.acceptedAnswers:[],
      acceptedArabicAnswers:Array.isArray(p.acceptedArabicAnswers)?p.acceptedArabicAnswers:[],
      sourceRow:seed.row??null,
      favorite:false,
      ignored:DATA_EXCLUSIONS.has(seed.id),
      userFlagged:false,
      createdAt:Date.now(),
      updatedAt:Date.now(),
      qualityStatus:"ok",
      qualityIssues:[],
      qualityNote:p.qualityNote||(DATA_EXCLUSIONS.get(seed.id)||"")
    };
    word.qualityIssues=qualityIssues(word);
    word.qualityStatus=word.qualityIssues.length?"review":"ok";
    return word;
  }


  function applyPatchesToExistingWords(words){
    const changed=[];
    for(const word of words){
      const p=DATA_PATCHES[word.id]||null;
      let dirty=false;
      if(DATA_EXCLUSIONS.has(word.id)){
        if(!word.ignored){word.ignored=true;dirty=true;}
        if(word.qualityNote!==DATA_EXCLUSIONS.get(word.id)){word.qualityNote=DATA_EXCLUSIONS.get(word.id);dirty=true;}
      }
      if(!p&&!dirty)continue;
      for(const [src,dst] of [["german","german"],["arabic","arabic"],["pronunciation","pronunciation"],["plural","plural"],["level","level"]]){
        if(p&&Object.prototype.hasOwnProperty.call(p,src)&&word[dst]!==p[src]){word[dst]=p[src];dirty=true;}
      }
      if(Array.isArray(p?.acceptedAnswers)){word.acceptedAnswers=p.acceptedAnswers.slice();dirty=true;}
      if(Array.isArray(p?.acceptedArabicAnswers)){word.acceptedArabicAnswers=p.acceptedArabicAnswers.slice();dirty=true;}
      if(p?.qualityNote&&word.qualityNote!==p.qualityNote){word.qualityNote=p.qualityNote;dirty=true;}
      if(dirty){
        word.normalizedGerman=normalizeGerman(word.german);word.normalizedArabic=normalizeArabic(word.arabic);
        word.article=p&&Object.prototype.hasOwnProperty.call(p,"article")?p.article:(word.article??splitArticle(word.german).article);
        word.itemType=p?.itemType??inferItemType(word.german,word.article);
        word.qualityIssues=qualityIssues(word);word.qualityStatus=word.qualityIssues.length?"review":"ok";word.updatedAt=Date.now();changed.push(word);
      }
    }
    return changed;
  }
  function makeId(prefix="id"){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`;}
  function csvCell(v){const s=String(v??"");return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
  function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
  function debounce(fn,wait=180){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),wait);};}

  Object.assign(DF,{DAY,MINUTE,ARTICLES,DEFAULT_SETTINGS,DATA_PATCHES,DATA_EXCLUSIONS,esc,clamp,round,randomUnit,randomInt,shuffle,sample,uniqueBy,dataAudit,attemptAnalytics,localDateKey,startOfLocalDay,formatDate,formatRelative,normalizeGerman,normalizeArabic,foldGerman,splitArticle,inferItemType,levenshtein,validateGermanAnswer,validateArticleAnswer,validateArabicAnswer,arabicTokenScore,qualityIssues,applyPatchToSeed,applyPatchesToExistingWords,createCard,scheduleCard,cardMastery,automaticRating,skillLabel,skillWeight,wordMastery,wordStatus,cardStatus,preferredSkills,nextSkillUnlocks,makeId,csvCell,downloadBlob,debounce});
})();

const database=createIndexedDbAdapter(window.DF,window);
Object.assign(window.DF,{DB:database,Repositories:createRepositories(database)});
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
    await DF.Repositories.cards.save(card);
  }
function questionFor(state,entry){
    const word=state.wordsMap.get(entry.wordId);
    const card=entry.skill?cardFor(state,entry.wordId,entry.skill):null;
    if(entry.kind==="intro")return {kind:"intro",word,entry};
    const skill=entry.skill||"recall";
    if(skill==="recognition"){
      return {kind:"test",skill,word,card,entry,prompt:word.german,promptLang:"de",expected:word.arabic,answerLang:"ar",label:word.itemType==="sentence"?"اكتب معنى الجملة بالعربية بدقة":"اكتب المعنى العربي"};
    }
    if(skill==="article"){
      const rest=DF.splitArticle(word.german).rest;
      if(state.settings.difficultyMode==="hard"&&state.settings.typedArticleInHardMode!==false){
        return {kind:"test",skill,word,card,entry,prompt:rest,promptLang:"de",expected:word.article,answerLang:"de",label:"اكتب أداة التعريف: der أو die أو das"};
      }
      if(!entry.choiceIds){
        const counts=state.session.choicePositionCounts||(state.session.choicePositionCounts=[0,0,0]);
        const min=Math.min(...counts),positions=counts.map((v,i)=>v===min?i:-1).filter(i=>i>=0);
        const target=positions[DF.randomInt(positions.length)];
        const wrong=DF.shuffle(DF.ARTICLES.filter(x=>x!==word.article));
        const ids=[];let wi=0;for(let i=0;i<3;i++)ids.push(i===target?word.article:wrong[wi++]);
        entry.choiceIds=ids;counts[target]++;
      }
      const choices=entry.choiceIds.map(x=>({id:x,label:x}));
      return {kind:"test",skill,word,card,entry,prompt:rest,promptLang:"de",choices,correctId:word.article,label:"اختر أداة التعريف الصحيحة"};
    }
    if(skill==="order"){
      const cleaned=word.german.replace(/[.!?]+$/g,"").trim();
      if(!entry.tokens)entry.tokens=DF.shuffle(cleaned.split(/\s+/).filter(Boolean));
      return {kind:"test",skill,word,card,entry,prompt:word.arabic,promptLang:"ar",tokens:entry.tokens.slice(),expected:cleaned,answerLang:"de",label:"رتّب كلمات الجملة الألمانية"};
    }
    return {kind:"test",skill:"recall",word,card,entry,prompt:word.arabic,promptLang:"ar",expected:word.german,answerLang:"de",label:word.itemType==="sentence"?"اكتب الجملة بالألمانية كاملة":"اكتب الكلمة أو التركيب بالألمانية"};
  }

  function statusPriority(card,now=Date.now()){
    const s=DF.cardStatus(card,now);return ({overdue:0,due:1,weak:2,learning:3,new:4,mastered:5,ignored:9})[s]??6;
  }
function activeWords(state){return state.words.filter(w=>!w.ignored&&w.qualityStatus!=="review");}
  function learnedWordIds(state){
    const ids=new Set();for(const c of state.cards){if(c.reps>0||c.state!=="new")ids.add(c.wordId);}return ids;
  }
function pickDueCards(state,limit,{skills=null,weakOnly=false,mistakesOnly=false}={}){
    const now=Date.now(),seen=new Set();
    let cards=state.cards.filter(c=>!c.suspended&&state.wordsMap.has(c.wordId)&&state.wordsMap.get(c.wordId)?.qualityStatus!=="review");
    if(state.settings.difficultyMode==="hard"&&!state.settings.enableOrderPractice)cards=cards.filter(c=>c.skill!=="order");
    if(skills)cards=cards.filter(c=>skills.includes(c.skill));
    if(weakOnly)cards=cards.filter(c=>DF.cardStatus(c,now)==="weak"||c.lapses>=2||c.wrong>c.correct);
    else if(mistakesOnly)cards=cards.filter(c=>c.wrong>0);
    else cards=cards.filter(c=>c.dueAt<=now||DF.cardStatus(c,now)==="weak");
    const buckets=new Map();
    for(const c of cards){const p=statusPriority(c,now);if(!buckets.has(p))buckets.set(p,[]);buckets.get(p).push(c);}
    const ordered=[];
    for(const p of Array.from(buckets.keys()).sort((a,b)=>a-b)){
      let bucket=buckets.get(p);
      if(mistakesOnly)bucket=bucket.sort((a,b)=>(b.wrong-b.correct)-(a.wrong-a.correct));
      const windows=[];for(let i=0;i<bucket.length;i+=6)windows.push(...DF.shuffle(bucket.slice(i,i+6)));
      ordered.push(...windows);
    }
    const out=[];for(const c of ordered){if(seen.has(c.wordId))continue;seen.add(c.wordId);out.push(c);if(out.length>=limit)break;}return out;
  }
function pickNewWords(state,limit){
    const learned=learnedWordIds(state);
    const candidates=DF.shuffle(activeWords(state).filter(w=>!learned.has(w.id)));
    const groups={sentence:[],phrase:[],noun:[],word:[]};for(const w of candidates)(groups[w.itemType]||groups.word).push(w);
    const order=DF.shuffle(["sentence","phrase","noun","word"]),out=[];
    while(out.length<limit){let added=false;for(const type of order){const item=groups[type]?.shift();if(item){out.push(item);added=true;if(out.length>=limit)break;}}if(!added)break;}
    return out;
  }
  function hashString(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return h;}


  function randomGap(settings,queueLength){
    const min=Math.max(3,Number(settings.retryGapMin)||5),max=Math.max(min,Number(settings.retryGapMax)||8);
    return Math.min(queueLength,min+DF.randomInt(max-min+1));
  }
  function itemTypeOfEntry(state,entry){return state.wordsMap.get(entry.wordId)?.itemType||"word";}
  function interleaveEntries(state,entries){
    const pool=DF.shuffle(entries),out=[],maxStreak=Math.max(1,Number(state.settings.maxSameItemTypeStreak)||2);
    while(pool.length){
      const previous=out[out.length-1],prevType=previous?itemTypeOfEntry(state,previous):null,prevSkill=previous?.skill||null;
      let streak=0;for(let i=out.length-1;i>=0&&itemTypeOfEntry(state,out[i])===prevType;i--)streak++;
      const candidates=pool.map((e,i)=>{
        const type=itemTypeOfEntry(state,e),wouldExceed=type===prevType&&streak>=maxStreak;
        return {e,i,score:(wouldExceed?1000:0)+(type===prevType?4:0)+((e.skill||e.kind)===prevSkill?2:0)+DF.randomUnit()};
      });
      candidates.sort((a,b)=>a.score-b.score);const pick=candidates[0];out.push(pick.e);pool.splice(pick.i,1);
    }
    return out;
  }
  function avoidPreviousOrder(entries,previousIds){
    if(!Array.isArray(previousIds)||previousIds.length<4||entries.length<4)return entries;
    const ids=entries.map(e=>e.wordId),samePrefix=ids.slice(0,6).filter((id,i)=>id===previousIds[i]).length;
    if(samePrefix<3)return entries;
    const cut=Math.max(1,Math.floor(entries.length/2));
    return entries.slice(cut).concat(entries.slice(0,cut)).reverse();
  }
  function baseSession(mode){return{
    id:DF.makeId("session"),mode,queue:[],current:null,result:null,startedAt:Date.now(),updatedAt:Date.now(),done:false,
    initialCards:0,initialWords:0,initialCompleted:0,introduced:0,attempts:0,correctAttempts:0,wrongAttempts:0,
    firstPassCorrect:0,firstPassWrong:0,reveals:0,hints:0,xp:0,retriesCompleted:0,choicePositionCounts:[0,0,0],engineVersion:6
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
    if(settings.randomizeSession!==false)s.queue=interleaveEntries(state,s.queue);
    if(settings.avoidRecentSessionOrder!==false){
      const previous=await DF.Repositories.metadata.get("lastSessionWordOrder",[]);
      s.queue=avoidPreviousOrder(s.queue,previous);
      await DF.Repositories.metadata.set("lastSessionWordOrder",s.queue.map(x=>x.wordId));
    }
    s.initialWords=new Set(s.queue.map(x=>x.wordId)).size;
    await DF.Repositories.metadata.set("session",s);
    return s;
  }

  function pendingRetries(session){return session.queue.filter(x=>x.kind==="test"&&!x.initial).length;}
function progress(session){
    const planned=Math.max(1,session.initialCards),completed=Math.min(session.initialCompleted,session.initialCards),retries=pendingRetries(session);
    const percent=Math.round(Math.min(1,completed/planned)*100);
    return {planned,completed,percent,pendingRetries:retries};
  }

  async function beginCurrent(state){
    const s=state.session;if(!s)return null;
    if(s.result)return s.current;
    if(!s.queue.length){s.done=true;s.current=null;s.updatedAt=Date.now();await completeSession(state);return null;}
    s.current=questionFor(state,s.queue[0]);s.current.startedAt=Date.now();s.current.usedHint=false;s.current.revealed=false;s.result=null;s.updatedAt=Date.now();await DF.Repositories.metadata.set("session",s);return s.current;
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
    else if(q.skill==="article")answer=DF.validateArticleAnswer(payload.text,q.word);
    else if(q.skill==="order")answer=evaluateOrder(q,payload.tokens||[]);
    else if(q.skill==="recognition")answer=DF.validateArabicAnswer(payload.text,q.word,q.expected,state.settings);
    else answer=DF.validateGermanAnswer(payload.text,q.word,state.settings,q.expected);
    const elapsed=Date.now()-q.startedAt;
    const suggestedRating=DF.automaticRating(answer,{usedHint:q.usedHint,revealed:false,elapsedMs:elapsed});
    s.result={answer,elapsedMs:elapsed,suggestedRating,revealed:false};
    s.updatedAt=Date.now();await DF.Repositories.metadata.set("session",s);
  }
  async function revealAnswer(state){
    const s=state.session,q=s?.current;if(!s||!q||s.result||q.kind!=="test")return;
    q.revealed=true;
    s.result={answer:{type:"revealed",isCorrect:false,correctAnswer:q.skill==="article"?q.word.article:q.skill==="recognition"?q.word.arabic:q.expected||q.word.german,userAnswer:"",note:"تم عرض الإجابة. ستعاد البطاقة داخل الجلسة.",quality:0},elapsedMs:Date.now()-q.startedAt,suggestedRating:1,revealed:true};
    s.updatedAt=Date.now();await DF.Repositories.metadata.set("session",s);
  }
  async function useHint(state){
    const s=state.session,q=s?.current;if(!s||!q||q.usedHint)return;
    q.usedHint=true;s.hints++;s.updatedAt=Date.now();await DF.Repositories.metadata.set("session",s);
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
      const at=randomGap(state.settings,s.queue.length);s.queue.splice(at,0,test);
    }
    s.current=null;s.result=null;s.updatedAt=Date.now();await DF.Repositories.metadata.set("session",s);await beginCurrent(state);
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

    await DF.Repositories.attempts.add({
      sessionId:s.id,wordId:q.word.id,cardKey:card.key,skill:q.skill,correct,answerType:r.answer.type,rating:finalRating,
      initial:!!entry.initial,retryCount:Number(entry.retryCount)||0,itemType:q.word.itemType||"word",
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
      const at=randomGap(state.settings,s.queue.length);s.queue.splice(at,0,retry);
    }
    s.current=null;s.result=null;s.updatedAt=Date.now();await DF.Repositories.metadata.set("session",s);await beginCurrent(state);
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
    state.profile=profile;await DF.Repositories.metadata.set("profile",profile);await DF.Repositories.metadata.set("session",s);
  }
  async function abandonSession(state,{discard=false}={}){
    if(discard){state.session=null;await DF.Repositories.metadata.set("session",null);}
    else if(state.session){state.session.updatedAt=Date.now();await DF.Repositories.metadata.set("session",state.session);}
  }
  async function resumeSession(state){
    const s=await DF.Repositories.metadata.get("session",null);if(s&&!s.done){state.session=s;await beginCurrent(state);return s;}return null;
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

(function(){
  "use strict";
  const DF=window.DF;

  function parseCSV(text){
    const sample=text.slice(0,4000),counts=[[",",(sample.match(/,/g)||[]).length],[";",(sample.match(/;/g)||[]).length],["\t",(sample.match(/\t/g)||[]).length]];
    const delimiter=counts.sort((a,b)=>b[1]-a[1])[0][0];
    const rows=[];let row=[],field="",quoted=false;
    text=String(text).replace(/^\uFEFF/,"").replace(/\r\n/g,"\n").replace(/\r/g,"\n");
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=c;}
      else if(c==='"')quoted=true;
      else if(c===delimiter){row.push(field);field="";}
      else if(c==='\n'){row.push(field);rows.push(row);row=[];field="";}
      else field+=c;
    }
    if(field.length||row.length){row.push(field);rows.push(row);}
    return rows.filter(r=>r.some(x=>String(x).trim()));
  }

  async function inflateRaw(bytes){
    if(typeof DecompressionStream!=="function")throw new Error("المتصفح لا يدعم فك ضغط XLSX. استخدم Chrome أو Edge حديثاً.");
    const ds=new DecompressionStream("deflate-raw");
    const stream=new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  function u16(v,o){return v.getUint16(o,true)}function u32(v,o){return v.getUint32(o,true)}
  async function unzip(arrayBuffer){
    const v=new DataView(arrayBuffer),bytes=new Uint8Array(arrayBuffer);let eocd=-1;
    for(let i=v.byteLength-22;i>=Math.max(0,v.byteLength-65557);i--){if(u32(v,i)===0x06054b50){eocd=i;break;}}
    if(eocd<0)throw new Error("ملف XLSX غير صالح أو غير مدعوم.");
    const count=u16(v,eocd+10),centralOffset=u32(v,eocd+16),decoder=new TextDecoder("utf-8");
    const entries=new Map();let p=centralOffset;
    for(let n=0;n<count;n++){
      if(u32(v,p)!==0x02014b50)break;
      const method=u16(v,p+10),compSize=u32(v,p+20),nameLen=u16(v,p+28),extraLen=u16(v,p+30),commentLen=u16(v,p+32),localOffset=u32(v,p+42);
      const name=decoder.decode(bytes.slice(p+46,p+46+nameLen));
      if(u32(v,localOffset)!==0x04034b50)throw new Error("بنية ZIP داخل XLSX غير صالحة.");
      const localNameLen=u16(v,localOffset+26),localExtraLen=u16(v,localOffset+28),start=localOffset+30+localNameLen+localExtraLen;
      const compressed=bytes.slice(start,start+compSize);let out;
      if(method===0)out=compressed;else if(method===8)out=await inflateRaw(compressed);else throw new Error("نوع ضغط XLSX غير مدعوم.");
      entries.set(name,out);p+=46+nameLen+extraLen+commentLen;
    }
    return entries;
  }
  function xmlText(bytes){return new TextDecoder("utf-8").decode(bytes)}
  function parseXML(text){const doc=new DOMParser().parseFromString(text,"application/xml");if(doc.querySelector("parsererror"))throw new Error("تعذر قراءة XML داخل XLSX.");return doc;}
  function colIndex(ref){let n=0;for(const c of (ref.match(/[A-Z]+/i)?.[0]||"A").toUpperCase())n=n*26+(c.charCodeAt(0)-64);return n-1;}
  async function parseXLSX(buffer){
    const files=await unzip(buffer),shared=[];
    if(files.has("xl/sharedStrings.xml")){
      const doc=parseXML(xmlText(files.get("xl/sharedStrings.xml")));
      for(const si of doc.getElementsByTagName("si"))shared.push(Array.from(si.getElementsByTagName("t")).map(x=>x.textContent||"").join(""));
    }
    let sheetPath="xl/worksheets/sheet1.xml";
    if(!files.has(sheetPath))sheetPath=Array.from(files.keys()).find(k=>/^xl\/worksheets\/sheet\d+\.xml$/.test(k));
    if(!sheetPath)throw new Error("لا توجد ورقة عمل قابلة للقراءة داخل الملف.");
    const doc=parseXML(xmlText(files.get(sheetPath))),rows=[];
    for(const rowNode of doc.getElementsByTagName("row")){
      const row=[];
      for(const c of rowNode.getElementsByTagName("c")){
        const idx=colIndex(c.getAttribute("r")||"A1"),type=c.getAttribute("t"),v=c.getElementsByTagName("v")[0]?.textContent??"";
        let value=v;
        if(type==="s")value=shared[Number(v)]??"";
        else if(type==="inlineStr")value=Array.from(c.getElementsByTagName("t")).map(x=>x.textContent||"").join("");
        row[idx]=value;
      }
      rows.push(row.map(x=>x??""));
    }
    return rows.filter(r=>r.some(x=>String(x).trim()));
  }

  function mapRows(rows,state){
    if(!rows.length)return {items:[],stats:{read:0,duplicates:0,invalid:0}};
    const header=rows[0].map(h=>String(h||"").trim());
    const find=(re)=>header.findIndex(x=>re.test(x));
    const de=find(/ألماني|الماني|german|deutsch|الكلمة/i),ar=find(/عرب|arabic|معنى|الترجمة/i),pr=find(/نطق|pron/i),level=find(/level|cefr|مستوى/i),tags=find(/tag|تصنيف|موضوع/i),plural=find(/plural|جمع/i);
    const hasHeader=de>=0||ar>=0;const start=hasHeader?1:0,D=de>=0?de:0,A=ar>=0?ar:1,P=pr>=0?pr:2;
    const existing=new Set(state.words.map(w=>`${w.normalizedGerman}|${w.normalizedArabic}`));
    const seen=new Set(),items=[];let duplicates=0,invalid=0,maxId=state.words.reduce((m,w)=>Math.max(m,Number(w.id)||0),0);
    for(let i=start;i<rows.length;i++){
      const r=rows[i],g=String(r[D]??"").trim(),a=String(r[A]??"").trim(),p=String(r[P]??"").trim();
      if(!g&&!a)continue;if(!g||!a){invalid++;continue;}
      const key=`${DF.normalizeGerman(g)}|${DF.normalizeArabic(a)}`;if(existing.has(key)||seen.has(key)){duplicates++;continue;}seen.add(key);
      const split=DF.splitArticle(g),itemType=DF.inferItemType(g,split.article);
      const word={id:++maxId,german:g,arabic:a,pronunciation:p,normalizedGerman:DF.normalizeGerman(g),normalizedArabic:DF.normalizeArabic(a),itemType,article:split.article,plural:plural>=0?String(r[plural]??"").trim():"",level:level>=0?String(r[level]??"").trim():"",tags:tags>=0?String(r[tags]??"").split(/[;,|]/).map(x=>x.trim()).filter(Boolean):[],acceptedAnswers:[],acceptedArabicAnswers:[],sourceRow:i+1,favorite:false,ignored:false,createdAt:Date.now(),updatedAt:Date.now(),qualityStatus:"ok",qualityIssues:[],qualityNote:"مستورد بواسطة المستخدم"};
      word.qualityIssues=DF.qualityIssues(word);word.qualityStatus=word.qualityIssues.length?"review":"ok";items.push(word);
    }
    return {items,stats:{read:Math.max(0,rows.length-start),duplicates,invalid,added:items.length},columns:{de:D,ar:A,pr:P}};
  }

  async function readImportFile(file,state){
    if(!file)throw new Error("لم يتم اختيار ملف.");
    const name=file.name.toLowerCase();let rows;
    if(name.endsWith(".csv")||name.endsWith(".tsv"))rows=parseCSV(await file.text());
    else if(name.endsWith(".xlsx"))rows=await parseXLSX(await file.arrayBuffer());
    else throw new Error("الصيغ المدعومة هي XLSX وCSV فقط.");
    return mapRows(rows,state);
  }
  async function commitImport(state,preview){
    if(!preview?.items?.length)return 0;await DF.Repositories.vocabulary.saveMany(preview.items);
    state.words.push(...preview.items);for(const w of preview.items)state.wordsMap.set(w.id,w);return preview.items.length;
  }

  async function exportBackup(state){
    const attempts=await DF.Repositories.attempts.all();
    const payload={app:"DeutschFlow",schemaVersion:5,exportedAt:Date.now(),words:state.words,cards:state.cards,attempts,settings:state.settings,profile:state.profile};
    DF.downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),`DeutschFlow-backup-${DF.localDateKey()}.json`);
  }
  async function savePreRestoreSnapshot(){
    try{await DF.Repositories.metadata.set("preRestoreSnapshot",{app:"DeutschFlow",schemaVersion:5,exportedAt:Date.now(),reason:"automatic-pre-restore",words:await DF.Repositories.vocabulary.all(),cards:await DF.Repositories.cards.all(),attempts:await DF.Repositories.attempts.all(),settings:await DF.Repositories.metadata.get("settings",{}),profile:await DF.Repositories.metadata.get("profile",{})});}
    catch(e){console.warn("تعذر حفظ لقطة ما قبل الاستعادة",e);}
  }
  async function restoreBackup(file){
    if(!file)throw new Error("لم يتم اختيار ملف.");let payload;
    try{payload=JSON.parse(await file.text());}catch{throw new Error("ملف النسخة الاحتياطية غير صالح.");}
    if(payload.app!=="DeutschFlow"||!Array.isArray(payload.words)||!Array.isArray(payload.cards))throw new Error("هذا الملف ليس نسخة DeutschFlow صحيحة.");
    await savePreRestoreSnapshot();await DF.Repositories.lifecycle.replaceAll(payload);return payload;
  }
  function exportCSV(state,filter="all"){
    let words=state.words;
    if(filter==="weak")words=words.filter(w=>DF.wordStatus(w,state.cards)==="weak");
    if(filter==="quality")words=words.filter(w=>w.qualityStatus==="review");
    const head=["German","Arabic","Pronunciation","Article","Plural","Type","Level","Tags","Status","Mastery","Quality Issues"];
    const rows=words.map(w=>{
      const mastery=DF.wordMastery(w,state.cards),status=DF.wordStatus(w,state.cards);
      return [w.german,w.arabic,w.pronunciation,w.article,w.plural,w.itemType,w.level,(w.tags||[]).join("; "),status,mastery,(w.qualityIssues||[]).join("; ")].map(DF.csvCell).join(",");
    });
    DF.downloadBlob(new Blob(["\uFEFF"+head.join(",")+"\n"+rows.join("\n")],{type:"text/csv;charset=utf-8"}),`DeutschFlow-words-${filter}-${DF.localDateKey()}.csv`);
  }

  Object.assign(DF,{IO:{parseCSV,parseXLSX,readImportFile,commitImport,exportBackup,restoreBackup,exportCSV}});
})();

(function(){
  "use strict";
  const DF=window.DF;
  const ICONS={
    home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/></svg>',
    words:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16M4 12h16M4 19h16"/><path d="M8 3v4M8 10v4M8 17v4"/></svg>',
    study:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>',
    stats:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.16.37.38.7.65.98.3.3.7.44 1.12.42H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"/></svg>',
    sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
    plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>'
  };

  function toast(message,type=""){const root=document.getElementById("toast-root"),el=document.createElement("div");el.className=`toast ${type}`;el.textContent=message;root.appendChild(el);setTimeout(()=>el.remove(),2600);}
  function modal(html){document.getElementById("modal-root").innerHTML=`<div class="modal-backdrop" data-action="modal-backdrop"><section class="modal" role="dialog" aria-modal="true">${html}</section></div>`;}
  function closeModal(){document.getElementById("modal-root").innerHTML="";}
  function statusLabel(s){return({new:"جديدة",learning:"قيد التعلم",due:"مستحقة",overdue:"متأخرة",weak:"ضعيفة",mastered:"متقنة",ignored:"مستبعدة"})[s]||s;}
  function statusPill(s){const cls=s==="overdue"?"weak":s;return `<span class="pill ${cls}">${statusLabel(s)}</span>`;}
  function routeLabel(route){return({home:"الرئيسية",words:"الكلمات",study:"تعلّم",stats:"الإحصائيات",settings:"الإعدادات"})[route]||route;}
  function modeLabel(mode){return({daily:"جلسة اليوم",new:"كلمات جديدة",due:"المراجعات المستحقة",weak:"الكلمات الضعيفة",mistakes:"مراجعة الأخطاء",article:"اختبار الأدوات",writing:"اختبار الكتابة",quick:"اختبار سريع"})[mode]||"جلسة تعلم";}

  function applyTheme(settings){const dark=settings.theme==="dark"||(settings.theme==="auto"&&matchMedia("(prefers-color-scheme:dark)").matches);document.documentElement.dataset.theme=dark?"dark":"light";document.querySelector('meta[name="theme-color"]')?.setAttribute("content",dark?"#08101f":"#0f766e");}

  function render(state){
    applyTheme(state.settings);
    const app=document.getElementById("app");
    if(state.route==="study"){app.innerHTML=renderStudy(state);afterRender(state);return;}
    app.innerHTML=`<div class="layout">${renderTopbar(state)}<main class="content">${renderPage(state)}</main></div>${renderNav(state)}`;
    afterRender(state);
  }
  function renderTopbar(state){return `<header class="topbar"><div class="brand"><span class="logo">DF</span><div>DeutschFlow<small>تعلّم الألمانية بذكاء</small></div></div><div class="top-actions"><button class="icon-btn" data-action="cycle-theme" title="تغيير المظهر">${ICONS.sun}</button>${state.installPrompt?'<button class="ghost-btn hide-mobile" data-action="install-app">تثبيت التطبيق</button>':''}</div></header>`;}
  function renderNav(state){const routes=[["home",ICONS.home,"الرئيسية"],["words",ICONS.words,"الكلمات"],["study",ICONS.study,"تعلّم"],["stats",ICONS.stats,"الإحصائيات"],["settings",ICONS.settings,"الإعدادات"]];return `<nav class="bottom-nav">${routes.map(([r,i,l])=>`<button class="nav-btn ${state.route===r?'active':''}" data-action="nav" data-route="${r}">${i}<span>${l}</span></button>`).join("")}</nav>`;}
  function renderPage(state){if(state.route==="words")return renderWords(state);if(state.route==="stats")return renderStats(state);if(state.route==="settings")return renderSettings(state);return renderHome(state);}

  /* حساب حالات الكلمات صار في خدمة التطبيق (review-summary-service) ويستخدمه
     مكوّن df-review-summary وصفحة الإحصائيات معاً. */
  function renderHome(state){
    /* الإحصاءات التفصيلية تُشتق الآن في df-review-summary عبر خدمة التطبيق. */
    const dueCards=state.cards.filter(x=>!x.suspended&&x.dueAt<=Date.now()).length,quality=state.words.filter(w=>w.qualityStatus==="review").length;
    const resume=state.session&&!state.session.done?`<div class="card" style="margin-bottom:14px;border-inline-start:4px solid var(--warning)"><div class="hero-row"><div><strong>جلسة غير مكتملة</strong><p style="margin:4px 0 0;color:var(--muted);font-size:13px">${modeLabel(state.session.mode)} · ${state.session.initialCompleted} من ${state.session.initialCards} عناصر أساسية</p></div><button class="primary-btn" data-action="resume-session">متابعة</button></div></div>`:"";
    return `<section class="page-head"><div><h1>مرحباً، لنبدأ المراجعة</h1><p>الأسئلة والتكرار يتكيفان مع مستوى كل مهارة بصورة مستقلة.</p></div></section>
      ${resume}
      <section class="card hero"><div class="hero-row"><div><h2>جلسة اليوم</h2><p>المستحق أولاً، ثم الكلمات الجديدة. النطق لا يظهر في سؤال الاستدعاء إلا عند طلب التلميح.</p><div class="hero-metrics"><div class="hero-metric"><strong>${dueCards.toLocaleString("ar-EG")}</strong><span>بطاقة مستحقة</span></div><div class="hero-metric"><strong>${state.settings.newPerDay}</strong><span>كلمة جديدة مستهدفة</span></div><div class="hero-metric"><strong>${state.profile.streak||0}</strong><span>يوم متتالٍ</span></div></div></div><button class="primary-btn large" data-action="start-session" data-mode="daily">ابدأ الجلسة</button></div></section>
      <div class="section-title">نظرة عامة</div>
      <df-review-summary id="review-summary"></df-review-summary>
      <div class="section-title">تدريبات مخصصة</div><section class="grid grid-3 training-grid">
        ${trainingCard("✍","اختبار الكتابة","استدعاء العربية وكتابة الألمانية دون كشف الإجابة","writing")}
        ${trainingCard("D","اختبار الأدوات","تدريب مستقل على der / die / das","article")}
        ${trainingCard("⏱","اختبار سريع","عشر بطاقات من أهم ما يحتاج إلى مراجعة","quick")}
        ${trainingCard("↻","المراجعات المستحقة","البطاقات التي حان موعدها فقط","due")}
        ${trainingCard("!","الكلمات الضعيفة","الأكثر تعثراً وفق سجل المحاولات","weak")}
        ${trainingCard("×","مراجعة الأخطاء","البطاقات ذات الأخطاء السابقة","mistakes")}
      </section>
      ${quality?`<div class="section-title">جودة البيانات</div><section class="card"><div class="hero-row"><div><strong>${quality.toLocaleString("ar-EG")} مدخلاً يحتاج إلى مراجعة</strong><p style="color:var(--muted);margin:5px 0 0;font-size:13px">تم اكتشافها بقواعد تحقق هيكلية؛ لا يعني ذلك أن جميعها خاطئة لغوياً.</p></div><button class="ghost-btn" data-action="quality-review">فتح المراجعة</button></div></section>`:""}`;
  }
  /* يُصدر الآن المكوّن المشترك df-stat-tile بدل تكرار ترميز البطاقة في كل صفحة.
     التنسيق الرقمي هنا مطابق تماماً للسلوك السابق. */
  const TILE_TONES={"metric-blue":"new","metric-amber":"due","metric-red":"weak","metric-green":"mastered"};
  /* بعض البطاقات تمرر قيماً منسّقة مسبقاً مثل «—» أو «٨٥٪» أو «١٫٢ث».
     تُعرض هذه كما هي، بينما تُنسَّق الأرقام محلياً كالسابق. */
  function tileValue(n){
    if(n==null)return (0).toLocaleString("ar-EG");
    if(typeof n==="number")return Number.isFinite(n)?n.toLocaleString("ar-EG"):"—";
    const s=String(n).trim();
    if(s==="")return (0).toLocaleString("ar-EG");
    return Number.isFinite(Number(s))?Number(s).toLocaleString("ar-EG"):s;
  }
  function statCard(icon,n,label,cls=""){
    const tone=TILE_TONES[cls]||"neutral";
    return `<df-stat-tile tone="${tone}" icon="${DF.esc(icon)}" value="${DF.esc(tileValue(n))}" label="${DF.esc(label)}"></df-stat-tile>`;
  }
  function trainingCard(icon,title,desc,mode){return `<button class="card interactive training-card" data-action="start-session" data-mode="${mode}"><span class="training-icon">${icon}</span><span><h3>${title}</h3><p>${desc}</p></span></button>`;}

  function getFilteredWords(state){
    const v=state.wordView,q=DF.normalizeGerman(v.query||""),qa=DF.normalizeArabic(v.query||"");let list=state.words.slice();
    if(q||qa)list=list.filter(w=>w.normalizedGerman.includes(q)||w.normalizedArabic.includes(qa)||(w.pronunciation||"").includes(v.query));
    list=list.filter(w=>{const s=DF.wordStatus(w,state.cards);if(v.filter==="all")return true;if(v.filter==="favorite")return w.favorite;if(v.filter==="quality")return w.qualityStatus==="review";if(v.filter==="noun")return w.itemType==="noun";if(v.filter==="due")return s==="due"||s==="overdue";return s===v.filter;});
    if(v.sort==="alpha")list.sort((a,b)=>a.normalizedGerman.localeCompare(b.normalizedGerman,"de"));
    if(v.sort==="mastery")list.sort((a,b)=>DF.wordMastery(a,state.cards)-DF.wordMastery(b,state.cards));
    if(v.sort==="errors")list.sort((a,b)=>wordErrors(state,b.id)-wordErrors(state,a.id));
    if(v.sort==="recent")list.sort((a,b)=>b.updatedAt-a.updatedAt);
    return list;
  }
  function wordErrors(state,id){return state.cards.filter(c=>c.wordId===id).reduce((s,c)=>s+(c.wrong||0),0);}
  function renderWords(state){
    const list=getFilteredWords(state),shown=list.slice(0,state.wordView.limit);
    const filters=[["all","الكل"],["new","جديدة"],["due","مستحقة"],["weak","ضعيفة"],["mastered","متقنة"],["favorite","المفضلة"],["noun","الأسماء"],["quality","تحتاج مراجعة"],["ignored","مستبعدة"]];
    return `<section class="page-head"><div><h1>الكلمات</h1><p>إدارة ${state.words.length.toLocaleString("ar-EG")} كلمة وعبارة مع متابعة الإتقان لكل مهارة.</p></div><button class="primary-btn" data-action="add-word">${ICONS.plus} إضافة كلمة</button></section>
      <div class="toolbar"><input id="word-search" class="search-input" placeholder="بحث بالألمانية أو العربية أو النطق…" value="${DF.esc(state.wordView.query)}"><button class="ghost-btn" data-action="import-open">استيراد</button><select id="word-sort" class="field-select sort-select"><option value="alpha" ${state.wordView.sort==='alpha'?'selected':''}>أبجدي</option><option value="mastery" ${state.wordView.sort==='mastery'?'selected':''}>الأقل إتقاناً</option><option value="errors" ${state.wordView.sort==='errors'?'selected':''}>الأكثر خطأً</option><option value="recent" ${state.wordView.sort==='recent'?'selected':''}>الأحدث تعديلاً</option></select></div>
      <div class="chips">${filters.map(([f,l])=>`<button class="chip ${state.wordView.filter===f?'active':''}" data-action="word-filter" data-filter="${f}">${l}</button>`).join("")}</div>
      <div style="color:var(--muted);font-size:13px;margin-bottom:9px">${list.length.toLocaleString("ar-EG")} نتيجة</div>
      <section class="card list-card">${shown.length?shown.map(w=>wordRow(state,w)).join(""):'<div class="empty">لا توجد كلمات مطابقة.</div>'}</section>
      ${shown.length<list.length?`<button class="ghost-btn load-more" data-action="load-more">عرض المزيد</button>`:""}`;
  }
  function wordRow(state,w){const status=DF.wordStatus(w,state.cards),mastery=DF.wordMastery(w,state.cards);return `<article class="word-row" data-action="edit-word" data-id="${w.id}"><div class="word-main"><div class="word-german" lang="de">${DF.esc(w.german)}</div><div class="word-arabic">${DF.esc(w.arabic)}${w.pronunciation?` · ${DF.esc(w.pronunciation)}`:""}</div></div><div class="word-side">${w.favorite?'⭐':''}${w.qualityStatus==='review'?'<span class="pill due">بيانات</span>':''}<span class="pill">${mastery}%</span>${statusPill(status)}</div></article>`;}

  function renderStats(state){
    const counts=summarizeLearnerState({words:state.words,cards:state.cards}).counts,attempts=state.recentAttempts||[],analytics=DF.attemptAnalytics(attempts),audit=state.audit||DF.dataAudit(state.words),days=[];
    for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const key=DF.localDateKey(d),n=attempts.filter(a=>DF.localDateKey(new Date(a.createdAt))===key).length;days.push({label:new Intl.DateTimeFormat("ar-EG",{weekday:"short"}).format(d),n});}
    const max=Math.max(1,...days.map(x=>x.n));
    const skills=["recall","recognition","article"].map(skill=>{const a=analytics.skills[skill]||{total:0,accuracy:0,avgMs:0};const cards=state.cards.filter(c=>c.skill===skill&&!c.suspended);return {skill,value:cards.length?Math.round(cards.reduce((s,c)=>s+DF.cardMastery(c),0)/cards.length):0,count:cards.length,accuracy:a.accuracy,attempts:a.total,avgMs:a.avgMs};});
    const top=state.cards.filter(c=>c.wrong>0).sort((a,b)=>b.wrong-a.wrong).slice(0,8),errorRows=Object.entries(analytics.errors).sort((a,b)=>b[1]-a[1]).slice(0,8);
    return `<section class="page-head"><div><h1>الإحصائيات</h1><p>تحليل آخر 30 يوماً، مع فصل الإتقان عن دقة المحاولات وجودة البيانات.</p></div></section>
      <section class="grid grid-4">${statCard("✓",counts.mastered,"كلمة متقنة","metric-green")}${statCard("◎",analytics.firstAccuracy==null?"—":analytics.firstAccuracy+"%","دقة أول محاولة","metric-blue")}${statCard("Σ",analytics.total,"محاولة فعلية","metric-amber")}${statCard("⌛",formatDuration(analytics.avgMs),"متوسط زمن الإجابة","metric-red")}</section>
      <div class="grid grid-2" style="margin-top:16px"><section class="card"><h3 style="margin-top:0">الأداء حسب المهارة</h3>${skills.map(x=>performanceBar(x)).join("")}</section><section class="card"><h3 style="margin-top:0">نشاط آخر 7 أيام</h3><div class="activity-bars">${days.map(x=>`<div class="day-bar"><b>${x.n}</b><div class="bar" style="height:${Math.max(3,x.n/max*100)}%"></div><small>${x.label}</small></div>`).join("")}</div></section></div>
      <div class="section-title">تدقيق قاعدة البيانات</div><section class="card"><div class="grid grid-4">${miniAudit(audit.structurallyClean,"سليمة هيكلياً")}${miniAudit(audit.review,"تحتاج مراجعة")}${miniAudit(audit.exactDuplicates.length,"تكرارات مطابقة")}${miniAudit(audit.conflictingGerman.length,"ألمانية بمعانٍ متعارضة")}</div><div class="grid grid-2" style="margin-top:12px"><button class="ghost-btn" data-action="run-data-audit">إعادة فحص قاعدة البيانات</button><button class="ghost-btn" data-action="export-data-audit">تصدير تقرير التدقيق CSV</button></div><p style="color:var(--muted);font-size:12px;margin-bottom:0">المعاني العربية المشتركة لا تُصنّف خطأ تلقائياً، لأنها قد تمثل مترادفات ألمانية صحيحة.</p></section>
      <div class="grid grid-2"><section><div class="section-title">أكثر البطاقات خطأً</div><div class="card list-card">${top.length?top.map(c=>{const w=state.wordsMap.get(c.wordId);if(!w)return"";return `<div class="word-row" data-action="edit-word" data-id="${w.id}"><div class="word-main"><div class="word-german" lang="de">${DF.esc(w.german)}</div><div class="word-arabic">${DF.skillLabel(c.skill)}</div></div><div class="word-side"><span class="pill weak">${c.wrong} خطأ</span><span class="pill">${DF.cardMastery(c)}%</span></div></div>`;}).join(""):'<div class="empty">لا توجد أخطاء مسجلة بعد.</div>'}</div></section><section><div class="section-title">أنواع الأخطاء</div><div class="card list-card">${errorRows.length?errorRows.map(([type,n])=>`<div class="word-row" style="cursor:default"><div class="word-main"><div>${errorTypeLabel(type)}</div></div><div class="word-side"><span class="pill weak">${n}</span></div></div>`).join(""):'<div class="empty">لا توجد أخطاء في الفترة المحددة.</div>'}</div></section></div>`;
  }
  function formatDuration(ms){if(!ms)return"—";if(ms<1000)return ms+"ms";return (ms/1000).toFixed(ms<10000?1:0)+"ث";}
  function miniAudit(n,label){return `<div class="end-stat"><strong>${Number(n||0).toLocaleString("ar-EG")}</strong><span>${label}</span></div>`;}
  function errorTypeLabel(type){return ({wrong:"إجابة خاطئة",minor_typo:"خطأ كتابي بسيط",article_missing:"أداة ناقصة",article_wrong:"أداة خاطئة",incomplete:"إجابة ناقصة",wrong_order:"ترتيب خاطئ",empty:"دون إجابة",capitalization:"حالة الأحرف",umlaut_variant:"بديل Umlaut"})[type]||type;}
  function performanceBar(x){return `<div class="skill-row"><div class="skill-head"><span>${DF.skillLabel(x.skill)} · ${x.attempts.toLocaleString("ar-EG")} محاولة</span><strong>${x.accuracy}%</strong></div><div class="mini-progress"><span style="width:${x.accuracy}%"></span></div><small style="color:var(--muted)">إتقان البطاقات ${x.value}% · متوسط ${formatDuration(x.avgMs)}</small></div>`;}
  function skillBar(x){return `<div class="skill-row"><div class="skill-head"><span>${DF.skillLabel(x.skill)} · ${x.count.toLocaleString("ar-EG")} بطاقة</span><strong>${x.value}%</strong></div><div class="mini-progress"><span style="width:${x.value}%"></span></div></div>`;}

  function renderSettings(state){const s=state.settings;return `<section class="page-head"><div><h1>الإعدادات</h1><p>إعدادات الجلسات والتصحيح والبيانات.</p></div></section>
    <div class="grid grid-2"><section class="card settings-group"><h3 style="margin-top:0">الجلسة اليومية</h3>${numberSetting("الكلمات الجديدة يومياً","newPerDay",s.newPerDay,"عدد الكلمات التي تُقدّم لأول مرة.")}${numberSetting("المراجعات يومياً","reviewsPerDay",s.reviewsPerDay,"الحد الأعلى للبطاقات المستحقة.")}${numberSetting("حجم الجلسة","sessionSize",s.sessionSize,"عدد العناصر الأساسية، دون احتساب الإعادات.")}${numberSetting("حد إعادة الخطأ","retryLimit",s.retryLimit,"عدد مرات إعادة البطاقة الخاطئة داخل الجلسة.")}${numberSetting("أقل مسافة قبل الإعادة","retryGapMin",s.retryGapMin,"عدد العناصر التي تفصل الخطأ عن أول إعادة.")}${numberSetting("أكبر مسافة قبل الإعادة","retryGapMax",s.retryGapMax,"تُختار مسافة الإعادة عشوائياً داخل هذا النطاق.")}</section>
    <section class="card settings-group"><h3 style="margin-top:0">التصحيح والتلميحات</h3><div class="setting-row"><div><strong>مستوى الصعوبة</strong><p>كتابة مباشرة، تصحيح عربي صارم، أداة الاسم تُكتب دون اختيارات، ومنع تكرار نمط ترتيب الجلسة.</p></div><span class="pill weak">Hard+</span></div>${toggleSetting("إظهار النطق","showPronunciation",s.showPronunciation,"يظهر في العرض التعليمي، ولا يكشف إجابة الاستدعاء في الوضع الصعب.")}${toggleSetting("قبول ae / oe / ue","acceptAeOeUe",s.acceptAeOeUe,"قبول بدائل Umlaut عند الكتابة.")}${toggleSetting("قبول ss بدلاً من ß","acceptSs",s.acceptSs,"لا يلغي عرض الكتابة القياسية في التصحيح.")}${toggleSetting("إلزام أداة الاسم","requireArticle",s.requireArticle,"يُعد الاسم دون der/die/das إجابة ناقصة.")}${toggleSetting("تجاهل ترقيم الجمل","ignoreSentencePunctuation",s.ignoreSentencePunctuation,"النقطة أو الفاصلة لا تجعل الجملة الصحيحة خاطئة.")}</section></div>
    <div class="section-title">المظهر والبيانات</div><section class="grid grid-2"><div class="card"><div class="field"><label>المظهر</label><select id="theme-select" class="field-select"><option value="auto" ${s.theme==='auto'?'selected':''}>تلقائي حسب النظام</option><option value="light" ${s.theme==='light'?'selected':''}>فاتح</option><option value="dark" ${s.theme==='dark'?'selected':''}>داكن</option></select></div>${state.installPrompt?'<button class="ghost-btn block" data-action="install-app">تثبيت كتطبيق</button>':''}</div>
    <div class="card"><div class="grid grid-2"><button class="ghost-btn" data-action="export-backup">نسخة JSON كاملة</button><button class="ghost-btn" data-action="export-csv">تصدير CSV</button><button class="ghost-btn" data-action="restore-open">استعادة نسخة</button><button class="ghost-btn" data-action="import-open">استيراد XLSX/CSV</button></div><button class="danger-btn block" style="margin-top:10px" data-action="reset-app">إعادة ضبط التطبيق</button></div></section>
    <div class="section-title">معلومات</div><section class="card"><p style="margin:0;color:var(--muted);line-height:1.8">DeutschFlow Pro RC4 · وضع صعب · بلا اختيارات معنى عشوائية · يعمل دون إنترنت · ${state.words.length.toLocaleString("ar-EG")} مدخلاً · التخزين محلي في IndexedDB. النسخة الاحتياطية ضرورية قبل تغيير المتصفح أو الجهاز.</p></section>`;}
  function numberSetting(title,key,value,desc){return `<div class="setting-row"><div><strong>${title}</strong><p>${desc}</p></div><input class="field-input setting-number" data-setting="${key}" type="number" min="0" max="500" value="${value}" style="width:88px"></div>`;}
  function toggleSetting(title,key,on,desc){return `<div class="setting-row"><div><strong>${title}</strong><p>${desc}</p></div><button class="toggle ${on?'on':''}" data-action="toggle-setting" data-setting="${key}" aria-pressed="${on}"></button></div>`;}

  function renderStudy(state){
    const s=state.session;if(!s)return `<div class="study-layout"><div class="session-end"><h1>لا توجد جلسة نشطة</h1><button class="primary-btn" data-action="nav" data-route="home">العودة</button></div></div>`;
    if(s.done)return renderSessionEnd(state,s);
    const p=DF.Learning.progress(s),q=s.current;
    if(!q)return `<div class="study-layout"><div class="boot-screen"><p>جارٍ إعداد السؤال…</p></div></div>`;
    return `<main class="study-layout"><header class="study-head"><button class="pill" data-action="exit-study">إنهاء</button><div class="study-title">${modeLabel(s.mode)}</div><div class="study-meta">أساسي ${p.completed}/${p.planned}<br>${q.kind==='intro'?`عرض ${s.introduced+1}`:`محاولة ${s.attempts+1}`}</div></header><div class="progress-wrap"><div class="progress"><span style="width:${p.percent}%"></span></div>${p.pendingRetries?`<span class="retry-badge">إعادات ${p.pendingRetries}</span>`:""}</div><div class="score-strip"><span class="ok">صحيح ${s.correctAttempts}</span><span class="no">خطأ ${s.wrongAttempts}</span><span class="hint">تلميحات ${s.hints}</span></div>${q.kind==="intro"?renderIntro(state,q):renderQuestion(state,q)}</main>`;
  }
  function renderIntro(state,q){const w=q.word;return `<section class="card question-card intro-card"><span class="pill new">كلمة جديدة · عرض تعليمي</span><div class="question-de" lang="de">${DF.esc(w.german)}</div>${state.settings.showPronunciation&&w.pronunciation?`<div class="pronunciation">${DF.esc(w.pronunciation)}</div>`:""}<div class="intro-meaning">${DF.esc(w.arabic)}</div><div class="word-details">${w.article?`<span class="pill">الأداة: <b lang="de">${w.article}</b></span>`:""}${w.itemType?`<span class="pill">${itemTypeLabel(w.itemType)}</span>`:""}${w.level?`<span class="pill">${DF.esc(w.level)}</span>`:""}</div></section><div class="intro-actions"><button class="ghost-btn large" data-action="intro-known">أعرفها مسبقاً</button><button class="primary-btn large" data-action="intro-learned">فهمتها — اختبرني لاحقاً</button></div>`;}
  function itemTypeLabel(t){return({noun:"اسم",word:"كلمة",phrase:"تركيب",sentence:"جملة"})[t]||t;}
function renderQuestion(state,q){
    const result=state.session.result;let prompt=`<section class="card question-card"><div class="question-label">${q.label}</div><div class="${q.promptLang==='de'?'question-de':'question-ar'}" ${q.promptLang==='de'?'lang="de"':''}>${DF.esc(q.prompt)}</div>`;
    const canShowPron=state.settings.showPronunciation&&q.word.pronunciation&&(q.promptLang==="de"||(q.usedHint&&state.settings.difficultyMode!=="hard"));
    if(canShowPron)prompt+=`<div class="pronunciation">${DF.esc(q.word.pronunciation)}</div>`;
    if(q.usedHint&&q.skill==="recall"){
      const rest=DF.splitArticle(q.word.german).rest;
      const first=rest.charAt(0).toUpperCase(),length=DF.normalizeGerman(rest).replace(/\s/g,"").length;
      prompt+=`<div class="word-details"><span class="pill due">الحرف الأول: <b lang="de">${DF.esc(first)}</b></span><span class="pill due">عدد الحروف تقريباً: ${length}</span></div>`;
    }
    if(q.usedHint&&q.skill==="recognition")prompt+=`<div class="word-details"><span class="pill due">عدد كلمات المعنى التقريبي: ${DF.normalizeArabic(q.word.arabic).split(" ").filter(Boolean).length}</span></div>`;
    prompt+=`</section>`;
    let body="";
    if(q.choices)body=`<div class="choices">${q.choices.map(c=>{let cls="answer-btn";if(result){if(String(c.id)===String(q.correctId))cls+=" correct";else if(String(c.id)===String(state.lastChoice))cls+=" wrong";else cls+=" dim";}return `<button class="${cls}" data-action="choose-answer" data-choice="${DF.esc(c.id)}" ${result?'disabled':''}><span lang="de">${DF.esc(c.label)}</span></button>`;}).join("")}</div>`;
    else if(q.skill==="order")body=renderOrder(state,q,result);
    else{
      const arabic=q.answerLang==="ar",lang=arabic?'ar':'de',placeholder=arabic?'اكتب المعنى بالعربية…':'اكتب الإجابة بالألمانية…';
      body=`<textarea id="answer-input" class="answer-input ${arabic?'arabic-answer':''}" lang="${lang}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${placeholder}" ${result?'disabled':''}></textarea><div class="answer-actions"><button class="ghost-btn" data-action="hint" ${result||q.usedHint?'disabled':''}>تلميح محدود</button><button class="primary-btn" data-action="submit-writing" ${result?'disabled':''}>تحقق</button></div>${result?'':'<button class="reveal-btn" data-action="reveal-answer">لا أعرفها — أظهر الإجابة</button>'}`;
    }
    return prompt+body+(result?renderFeedback(state,q,result):"");
  }
  function renderOrder(state,q,result){
    const o=state.orderState&&state.orderState.questionId===q.entry.id?state.orderState:{questionId:q.entry.id,selected:[],pool:q.tokens.slice()};state.orderState=o;
    return `<div class="token-area">${o.selected.length?o.selected.map((t,i)=>`<button class="token" data-action="order-undo-at" data-index="${i}" ${result?'disabled':''}>${DF.esc(t)}</button>`).join(""):'<span style="color:var(--muted)">اختر الكلمات بالترتيب</span>'}</div><div class="token-bank">${o.pool.map((t,i)=>`<button class="token" data-action="order-pick" data-index="${i}" ${result?'disabled':''}>${DF.esc(t)}</button>`).join("")}</div><div class="answer-actions"><button class="ghost-btn" data-action="order-reset" ${result||!o.selected.length?'disabled':''}>إعادة</button><button class="primary-btn" data-action="order-submit" ${result||o.pool.length?'disabled':''}>تحقق</button></div>${result?'':'<button class="reveal-btn" data-action="reveal-answer">لا أعرفها — أظهر الإجابة</button>'}`;
  }
function renderFeedback(state,q,r){const a=r.answer,correct=a.isCorrect,lang=q.skill==="recognition"?"ar":"de";return `<section class="feedback ${correct?'success':'error'}"><h3>${correct?'✓':'✗'} ${DF.esc(a.note)}</h3>${!correct?`<div class="feedback-row"><span>الإجابة الصحيحة</span><strong lang="${lang}">${DF.esc(a.correctAnswer)}</strong></div>`:""}${a.userAnswer?`<div class="feedback-row"><span>إجابتك</span><span lang="${lang}">${DF.esc(a.userAnswer)}</span></div>`:""}<button class="ghost-btn block" data-action="flag-current-word" style="margin-top:12px">الإبلاغ عن ترجمة أو بيانات غير صحيحة</button><div style="font-size:12px;color:var(--muted);margin-top:12px">${correct?'قيّم صعوبة التذكر لتحديد الموعد التالي:':'ستسجل الإجابة كخطأ وستعاد البطاقة داخل الجلسة.'}</div><div class="rating-row">${correct?ratingButton(2,"صعب",r.suggestedRating)+ratingButton(3,"جيد",r.suggestedRating)+ratingButton(4,"سهل",r.suggestedRating):ratingButton(1,"ثبت الخطأ وأعدها",1)}</div></section>`;}
  function ratingButton(r,label,suggested){return `<button class="rating-btn ${DF.Learning.ratingName(r)}" data-action="rate-answer" data-rating="${r}" style="${r===suggested?'outline:2px solid var(--primary);outline-offset:1px':''}">${label}</button>`;}
  function renderSessionEnd(state,s){const acc=DF.Learning.sessionAccuracy(s);return `<main class="study-layout"><section class="session-end"><div class="end-icon">✓</div><h1>اكتملت الجلسة</h1><p>تم فصل الكلمات الأساسية عن المحاولات والإعادات، لذلك الأرقام أدناه لا تتداخل.</p><div class="end-grid"><div class="end-stat"><strong>${s.initialCards}</strong><span>عناصر أساسية</span></div><div class="end-stat"><strong>${s.attempts}</strong><span>إجمالي المحاولات</span></div><div class="end-stat"><strong>${acc.first==null?'—':acc.first+'%'}</strong><span>دقة أول محاولة</span></div><div class="end-stat"><strong>${acc.attempts==null?'—':acc.attempts+'%'}</strong><span>دقة كل المحاولات</span></div><div class="end-stat"><strong>${s.reveals}</strong><span>عرض إجابة</span></div><div class="end-stat"><strong>${s.hints}</strong><span>تلميحات</span></div><div class="end-stat"><strong>${s.retriesCompleted}</strong><span>إعادات مكتملة</span></div><div class="end-stat"><strong>+${s.xp}</strong><span>نقطة خبرة</span></div></div><div class="grid grid-2"><button class="ghost-btn large" data-action="session-home">العودة للرئيسية</button><button class="primary-btn large" data-action="start-session" data-mode="${s.mode}">جلسة أخرى</button></div></section></main>`;}
function afterRender(state){
    if(state.route==="study"&&state.session?.current?.kind==="test"&&!state.session.result&&!state.session.current.choices&&state.session.current.skill!=="order")setTimeout(()=>document.getElementById("answer-input")?.focus(),10);
    hydrateReviewSummary(state);
  }
  /* Hand the Lit component derived data from the application service. The component
     never reads state, storage, or SRS internals itself. */
  function hydrateReviewSummary(state){
    const el=document.getElementById("review-summary");
    if(!el)return;
    el.summary=summarizeLearnerState({words:state.words,cards:state.cards});
  }

  function openWordModal(state,word=null){
    const w=word||{id:"",german:"",arabic:"",pronunciation:"",plural:"",level:"",tags:[],acceptedAnswers:[],acceptedArabicAnswers:[],favorite:false,ignored:false,qualityIssues:[]};
    modal(`<div class="modal-head"><h2>${word?'تعديل الكلمة':'إضافة كلمة'}</h2><button class="modal-close" data-action="modal-close">×</button></div>${w.qualityIssues?.length?`<div class="quality-box">${w.qualityIssues.map(DF.esc).join(" · ")}</div>`:""}<form id="word-form" data-id="${w.id}"><div class="field"><label>الألمانية — مع الأداة إن وجدت</label><input name="german" class="field-input" lang="de" required value="${DF.esc(w.german)}"></div><div class="field"><label>المعنى العربي</label><input name="arabic" class="field-input" required value="${DF.esc(w.arabic)}"></div><div class="form-grid"><div class="field"><label>النطق بالعربية</label><input name="pronunciation" class="field-input" value="${DF.esc(w.pronunciation||'')}"></div><div class="field"><label>صيغة الجمع</label><input name="plural" class="field-input" lang="de" value="${DF.esc(w.plural||'')}"></div><div class="field"><label>المستوى CEFR</label><input name="level" class="field-input" value="${DF.esc(w.level||'')}"></div><div class="field"><label>التصنيفات — مفصولة بفاصلة</label><input name="tags" class="field-input" value="${DF.esc((w.tags||[]).join(', '))}"></div></div><div class="field"><label>إجابات ألمانية بديلة مقبولة — كل إجابة في سطر</label><textarea name="acceptedAnswers" class="field-textarea" lang="de">${DF.esc((w.acceptedAnswers||[]).join('\n'))}</textarea></div><div class="field"><label>صياغات عربية بديلة معتمدة — كل صياغة في سطر</label><textarea name="acceptedArabicAnswers" class="field-textarea">${DF.esc((w.acceptedArabicAnswers||[]).join('\n'))}</textarea></div><div class="grid grid-2"><label class="setting-row" style="border:1px solid var(--border);border-radius:13px;padding:11px"><span><strong>مفضلة</strong><p>إظهارها ضمن فلتر المفضلة.</p></span><input type="checkbox" name="favorite" ${w.favorite?'checked':''}></label><label class="setting-row" style="border:1px solid var(--border);border-radius:13px;padding:11px"><span><strong>مستبعدة</strong><p>عدم إدراجها في الجلسات.</p></span><input type="checkbox" name="ignored" ${w.ignored?'checked':''}></label></div><div class="modal-actions">${word?'<button type="button" class="danger-btn" data-action="delete-word" data-id="'+w.id+'">حذف</button><button type="button" class="ghost-btn" data-action="reset-word-progress" data-id="'+w.id+'">تصفير التقدم</button>':''}<button type="button" class="ghost-btn" data-action="modal-close">إلغاء</button><button type="submit" class="primary-btn">حفظ</button></div></form>`);
  }
  function openImportModal(){modal(`<div class="modal-head"><h2>استيراد الكلمات</h2><button class="modal-close" data-action="modal-close">×</button></div><p style="color:var(--muted);line-height:1.7">يدعم XLSX وCSV فعلياً. الأعمدة المتوقعة: German/Deutsch، Arabic/المعنى، Pronunciation/النطق، ويمكن إضافة Level وTags وPlural.</p><div class="field"><label>اختر الملف</label><input id="import-file" class="field-input" type="file" accept=".xlsx,.csv,.tsv"></div><div id="import-preview"></div><div class="modal-actions"><button class="ghost-btn" data-action="modal-close">إلغاء</button><button class="primary-btn" data-action="analyze-import">تحليل الملف</button></div>`);}
  function showImportPreview(preview){const root=document.getElementById("import-preview");if(!root)return;root.innerHTML=`<div class="card" style="box-shadow:none;margin-top:12px"><div class="grid grid-4">${statCard("≡",preview.stats.read,"تمت قراءتها")}${statCard("+",preview.stats.added,"جديدة","metric-green")}${statCard("=",preview.stats.duplicates,"مكررة","metric-amber")}${statCard("!",preview.stats.invalid,"غير صالحة","metric-red")}</div>${preview.items.length?`<div class="modal-actions"><button class="primary-btn" data-action="commit-import">إضافة ${preview.items.length.toLocaleString('ar-EG')} كلمة</button></div>`:""}</div>`;}
  function openRestoreModal(){modal(`<div class="modal-head"><h2>استعادة نسخة احتياطية</h2><button class="modal-close" data-action="modal-close">×</button></div><div class="quality-box">ستُستبدل الكلمات والبطاقات والتقدم الحالي بالكامل. صدّر نسخة قبل المتابعة.</div><div class="field"><label>ملف DeutschFlow JSON</label><input id="restore-file" class="field-input" type="file" accept=".json"></div><div class="modal-actions"><button class="ghost-btn" data-action="modal-close">إلغاء</button><button class="danger-btn" data-action="restore-backup">استعادة واستبدال</button></div>`);}
  function openQualityModal(state){const flagged=state.words.filter(w=>w.qualityStatus==="review").slice(0,100);modal(`<div class="modal-head"><h2>مراجعة جودة البيانات</h2><button class="modal-close" data-action="modal-close">×</button></div><p style="color:var(--muted)">هذه إشارات آلية إلى تعارض هيكلي محتمل، وليست حكماً لغوياً نهائياً.</p><div class="quality-list">${flagged.map(w=>`<button class="quality-item card interactive" data-action="quality-edit" data-id="${w.id}" style="text-align:start"><strong lang="de">${DF.esc(w.german)}</strong><small>${DF.esc(w.arabic)} · ${(w.qualityIssues||[]).map(DF.esc).join('، ')}</small></button>`).join("")}</div>${state.words.filter(w=>w.qualityStatus==='review').length>100?'<p style="color:var(--muted)">يُعرض أول 100 مدخل. استخدم فلتر «تحتاج مراجعة» في صفحة الكلمات لعرض الجميع.</p>':''}`);}
  function confirmModal(title,text,action,label="تأكيد",danger=true){modal(`<div class="modal-head"><h2>${DF.esc(title)}</h2><button class="modal-close" data-action="modal-close">×</button></div><p style="color:var(--muted);line-height:1.7">${DF.esc(text)}</p><div class="modal-actions"><button class="ghost-btn" data-action="modal-close">إلغاء</button><button class="${danger?'danger-btn':'primary-btn'}" data-action="${action}">${DF.esc(label)}</button></div>`);}

  Object.assign(DF,{UI:{render,toast,modal,closeModal,openWordModal,openImportModal,showImportPreview,openRestoreModal,openQualityModal,confirmModal,applyTheme,modeLabel,routeLabel}});
})();

(function(){
  "use strict";
  const DF=window.DF;
  const state=DF.state={
    route:"home",settings:{...DF.DEFAULT_SETTINGS},profile:{streak:0,totalXP:0},words:[],cards:[],wordsMap:new Map(),cardsMap:new Map(),
    session:null,recentAttempts:[],wordView:{query:"",filter:"all",sort:"alpha",limit:200},orderState:null,lastChoice:null,
    importPreview:null,installPrompt:null,busy:false,audit:null
  };

  async function loadState(){
    const init=await DF.Repositories.lifecycle.initialize();state.settings=init.settings;
    state.words=await DF.Repositories.vocabulary.all();state.cards=await DF.Repositories.cards.all();
    state.wordsMap=new Map(state.words.map(w=>[w.id,w]));state.cardsMap=new Map(state.cards.map(c=>[c.key,c]));
    const patched=DF.applyPatchesToExistingWords(state.words);if(patched.length)await DF.Repositories.vocabulary.saveMany(patched);
    state.wordsMap=new Map(state.words.map(w=>[w.id,w]));
    state.profile=await DF.Repositories.metadata.get("profile",{streak:0,totalXP:0});
    const engineVersion=await DF.Repositories.metadata.get("engineVersion",0);
    if(engineVersion<6){await DF.Repositories.metadata.set("session",null);await DF.Repositories.metadata.set("engineVersion",6);state.session=null;}else state.session=await DF.Repositories.metadata.get("session",null);
    state.recentAttempts=await DF.Repositories.attempts.since(Date.now()-30*DF.DAY);
    state.audit=DF.dataAudit(state.words);
    if(state.session?.done)state.session=null;
    if(init.migration?.type==="legacy")setTimeout(()=>DF.UI.toast(`تم نقل ${init.migration.count.toLocaleString("ar-EG")} كلمة وتقدمها من النسخة السابقة.`,"success"),350);
  }
  async function refreshAttempts(){state.recentAttempts=await DF.Repositories.attempts.since(Date.now()-30*DF.DAY);state.audit=DF.dataAudit(state.words);}
  function render(){DF.UI.render(state);}
  async function withBusy(fn){if(state.busy)return;state.busy=true;try{await fn();}catch(e){console.error(e);DF.UI.toast(e?.message||"حدث خطأ غير متوقع.","error");}finally{state.busy=false;render();}}

  async function startSession(mode){
    state.orderState=null;state.lastChoice=null;
    state.session=await DF.Learning.buildSession(state,mode);
    state.route="study";await DF.Learning.beginCurrent(state);
    if(state.session.done&&state.session.initialCards===0)DF.UI.toast("لا توجد عناصر مناسبة لهذا التدريب الآن.");
  }
  async function resumeSession(){
    const s=await DF.Learning.resumeSession(state);if(s){state.route="study";}else{await startSession("daily");}
  }
  async function saveSettings(){await DF.Repositories.metadata.set("settings",state.settings);DF.UI.applyTheme(state.settings);}

  function formObject(form){const fd=new FormData(form),o={};for(const [k,v] of fd)o[k]=typeof v==="string"?v.trim():v;return o;}
  async function saveWord(form){
    const data=formObject(form),id=Number(form.dataset.id||0),existing=id?state.wordsMap.get(id):null;
    if(!data.german||!data.arabic)throw new Error("أدخل الكلمة الألمانية والمعنى العربي.");
    const normG=DF.normalizeGerman(data.german),normA=DF.normalizeArabic(data.arabic);
    const duplicate=state.words.find(w=>w.id!==id&&w.normalizedGerman===normG&&w.normalizedArabic===normA);
    if(duplicate)throw new Error("هذه الكلمة والمعنى موجودان بالفعل.");
    const split=DF.splitArticle(data.german),now=Date.now();
    const word={...(existing||{}),id:id||state.words.reduce((m,w)=>Math.max(m,Number(w.id)||0),0)+1,german:data.german,arabic:data.arabic,pronunciation:data.pronunciation||"",plural:data.plural||"",level:data.level||"",tags:(data.tags||"").split(/[;,|]/).map(x=>x.trim()).filter(Boolean),acceptedAnswers:(data.acceptedAnswers||"").split(/\n/).map(x=>x.trim()).filter(Boolean),acceptedArabicAnswers:(data.acceptedArabicAnswers||"").split(/\n/).map(x=>x.trim()).filter(Boolean),normalizedGerman:normG,normalizedArabic:normA,article:split.article,itemType:DF.inferItemType(data.german,split.article),favorite:data.favorite==="on",ignored:data.ignored==="on",userFlagged:existing?.userFlagged&&data.ignored==="on",sourceRow:existing?.sourceRow??null,createdAt:existing?.createdAt||now,updatedAt:now,qualityNote:existing?.qualityNote||""};
    word.qualityIssues=DF.qualityIssues(word);word.qualityStatus=word.qualityIssues.length?"review":"ok";
    await DF.Repositories.vocabulary.save(word);state.wordsMap.set(word.id,word);
    const idx=state.words.findIndex(w=>w.id===word.id);if(idx>=0)state.words[idx]=word;else state.words.push(word);
    // Suspend card types that no longer apply after editing.
    const related=state.cards.filter(c=>c.wordId===word.id);for(const c of related){const invalid=(c.skill==="article"&&!(word.itemType==="noun"&&word.article))||(c.skill==="order"&&word.itemType!=="sentence");if(invalid){c.suspended=true;await DF.Learning.persistCard(state,c);}}
    DF.UI.closeModal();DF.UI.toast(existing?"تم تحديث الكلمة.":"تمت إضافة الكلمة.","success");
  }
  async function deleteWord(id){
    const related=state.cards.filter(c=>c.wordId===id),attempts=await DF.Repositories.attempts.byWordId(id);
    await DF.Repositories.vocabulary.remove(id);await DF.Repositories.cards.removeMany(related.map(c=>c.key));await DF.Repositories.attempts.removeMany(attempts.map(a=>a.id));
    state.words=state.words.filter(w=>w.id!==id);state.wordsMap.delete(id);state.cards=state.cards.filter(c=>c.wordId!==id);for(const c of related)state.cardsMap.delete(c.key);
    DF.UI.closeModal();DF.UI.toast("تم حذف الكلمة وسجلها.");
  }
  async function resetWordProgress(id){
    const related=state.cards.filter(c=>c.wordId===id);await DF.Repositories.cards.removeMany(related.map(c=>c.key));state.cards=state.cards.filter(c=>c.wordId!==id);for(const c of related)state.cardsMap.delete(c.key);DF.UI.closeModal();DF.UI.toast("تم تصفير تقدم الكلمة.");
  }

  async function resetApp(){
    await DF.Repositories.vocabulary.clear();await DF.Repositories.cards.clear();await DF.Repositories.attempts.clear();await DF.Repositories.metadata.set("session",null);await DF.Repositories.metadata.set("profile",{streak:0,lastStudyDate:null,totalXP:0,createdAt:Date.now()});location.reload();
  }

  document.addEventListener("click",e=>{
    const btn=e.target.closest("[data-action]");if(!btn)return;const action=btn.dataset.action;
    if(action==="modal-backdrop"&&e.target===btn)return DF.UI.closeModal();
    if(action==="modal-close")return DF.UI.closeModal();
    if(action==="nav")return withBusy(async()=>{const route=btn.dataset.route;if(route==="study"){if(state.session&&!state.session.done)await resumeSession();else await startSession("daily");}else{state.route=route;} });
    if(action==="start-session")return withBusy(()=>startSession(btn.dataset.mode));
    if(action==="resume-session")return withBusy(resumeSession);
    if(action==="exit-study")return withBusy(async()=>{await DF.Learning.abandonSession(state);state.route="home";});
    if(action==="session-home")return withBusy(async()=>{await DF.Learning.abandonSession(state,{discard:true});state.session=null;state.route="home";await refreshAttempts();});
    if(action==="intro-learned")return withBusy(()=>DF.Learning.introduceWord(state,false));
    if(action==="intro-known")return withBusy(()=>DF.Learning.introduceWord(state,true));
    if(action==="hint")return withBusy(()=>DF.Learning.useHint(state));
    if(action==="reveal-answer")return withBusy(()=>DF.Learning.revealAnswer(state));
    if(action==="submit-writing")return withBusy(async()=>{const input=document.getElementById("answer-input");if(!input?.value.trim())throw new Error("اكتب إجابة أولاً.");await DF.Learning.submitAnswer(state,{text:input.value.trim()});});
    if(action==="choose-answer")return withBusy(async()=>{state.lastChoice=btn.dataset.choice;await DF.Learning.submitAnswer(state,{choiceId:btn.dataset.choice});});
    if(action==="flag-current-word")return withBusy(async()=>{
      const w=state.session?.current?.word;if(!w)return;
      w.userFlagged=true;w.ignored=true;w.qualityIssues=DF.qualityIssues(w);w.qualityStatus="review";w.updatedAt=Date.now();
      await DF.Repositories.vocabulary.save(w);state.audit=DF.dataAudit(state.words);
      for(const c of state.cards.filter(c=>c.wordId===w.id)){c.suspended=true;await DF.Learning.persistCard(state,c);}
      DF.UI.toast("تم استبعاد المدخل ووضعه في مراجعة الجودة.");
      render();
    });
    if(action==="rate-answer")return withBusy(async()=>{await DF.Learning.finalizeAnswer(state,Number(btn.dataset.rating));state.orderState=null;state.lastChoice=null;if(state.session?.done)await refreshAttempts();});
    if(action==="order-pick")return (()=>{const i=Number(btn.dataset.index),o=state.orderState;if(!o)return;o.selected.push(o.pool.splice(i,1)[0]);render();})();
    if(action==="order-undo-at")return (()=>{const i=Number(btn.dataset.index),o=state.orderState;if(!o)return;o.pool.push(o.selected.splice(i,1)[0]);render();})();
    if(action==="order-reset")return (()=>{const o=state.orderState;if(!o)return;o.pool=DF.shuffle(o.pool.concat(o.selected));o.selected=[];render();})();
    if(action==="order-submit")return withBusy(()=>DF.Learning.submitAnswer(state,{tokens:state.orderState?.selected||[]}));
    if(action==="cycle-theme")return withBusy(async()=>{state.settings.theme=state.settings.theme==="auto"?"light":state.settings.theme==="light"?"dark":"auto";await saveSettings();});
    if(action==="install-app")return withBusy(async()=>{if(!state.installPrompt)throw new Error("التثبيت غير متاح في هذا المتصفح أو تم تثبيت التطبيق بالفعل.");state.installPrompt.prompt();await state.installPrompt.userChoice;state.installPrompt=null;});
    if(action==="word-filter")return (()=>{state.wordView.filter=btn.dataset.filter;state.wordView.limit=200;render();})();
    if(action==="load-more")return (()=>{state.wordView.limit+=200;render();})();
    if(action==="add-word")return DF.UI.openWordModal(state);
    if(action==="edit-word")return DF.UI.openWordModal(state,state.wordsMap.get(Number(btn.dataset.id)));
    if(action==="quality-edit")return (()=>{const w=state.wordsMap.get(Number(btn.dataset.id));DF.UI.closeModal();setTimeout(()=>DF.UI.openWordModal(state,w),0);})();
    if(action==="delete-word")return (()=>{state.pendingWordId=Number(btn.dataset.id);DF.UI.confirmModal("حذف الكلمة","سيتم حذف الكلمة وبطاقاتها وسجل محاولاتها نهائياً.","delete-word-confirmed","حذف");})();
    if(action==="delete-word-confirmed")return withBusy(()=>deleteWord(Number(state.pendingWordId)));
    if(action==="reset-word-progress")return withBusy(()=>resetWordProgress(Number(btn.dataset.id)));
    if(action==="import-open")return DF.UI.openImportModal();
    if(action==="analyze-import")return withBusy(async()=>{const f=document.getElementById("import-file")?.files?.[0];state.importPreview=await DF.IO.readImportFile(f,state);DF.UI.showImportPreview(state.importPreview);});
    if(action==="commit-import")return withBusy(async()=>{const n=await DF.IO.commitImport(state,state.importPreview);state.importPreview=null;DF.UI.closeModal();DF.UI.toast(`تمت إضافة ${n.toLocaleString("ar-EG")} كلمة.`,"success");});
    if(action==="run-data-audit")return withBusy(async()=>{
      const germanGroups=new Map();for(const w of state.words){const g=DF.normalizeGerman(w.german);if(!germanGroups.has(g))germanGroups.set(g,[]);germanGroups.get(g).push(w);}
      const changed=[];
      for(const w of state.words){
        const base=DF.qualityIssues(w),same=germanGroups.get(DF.normalizeGerman(w.german))||[],meanings=[...new Set(same.map(x=>DF.normalizeArabic(x.arabic)).filter(Boolean))],pairCount=same.filter(x=>DF.normalizeArabic(x.arabic)===DF.normalizeArabic(w.arabic)).length;
        const issues=[...base];if(pairCount>1)issues.push("مدخل مكرر مطابق للألمانية والعربية");if(meanings.length>1)issues.push("نفس الصيغة الألمانية مرتبطة بمعانٍ عربية مختلفة");
        const unique=[...new Set(issues)];
        if(JSON.stringify(unique)!==JSON.stringify(w.qualityIssues||[])){w.qualityIssues=unique;w.qualityStatus=unique.length?"review":"ok";w.updatedAt=Date.now();changed.push(w);}
      }
      if(changed.length)await DF.Repositories.vocabulary.saveMany(changed);state.audit=DF.dataAudit(state.words);DF.UI.toast(`اكتمل التدقيق: ${state.audit.review.toLocaleString("ar-EG")} مدخلاً يحتاج مراجعة.`,"success");
    });
    if(action==="export-data-audit")return (()=>{const a=state.audit||DF.dataAudit(state.words),rows=[["الفئة","المعرفات","الألمانية","العربية/المعاني","العدد"]];
      for(const x of a.exactDuplicates)rows.push(["تكرار مطابق",x.ids.join("|"),x.german,x.arabic,x.count]);
      for(const x of a.conflictingGerman)rows.push(["ألمانية بمعانٍ مختلفة",x.ids.join("|"),x.german,x.meanings.join(" | "),x.count]);
      for(const w of state.words.filter(x=>x.qualityStatus==="review"))rows.push(["مراجعة جودة",w.id,w.german,w.arabic+" — "+(w.qualityIssues||[]).join(" | "),1]);
      const csv="\ufeff"+rows.map(r=>r.map(DF.csvCell).join(",")).join("\n");DF.downloadBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),`deutschflow-data-audit-${DF.localDateKey()}.csv`);})();
    if(action==="export-backup")return withBusy(()=>DF.IO.exportBackup(state));
    if(action==="export-csv")return DF.IO.exportCSV(state);
    if(action==="restore-open")return DF.UI.openRestoreModal();
    if(action==="restore-backup")return withBusy(async()=>{const f=document.getElementById("restore-file")?.files?.[0];await DF.IO.restoreBackup(f);location.reload();});
    if(action==="quality-review")return DF.UI.openQualityModal(state);
    if(action==="toggle-setting")return withBusy(async()=>{const k=btn.dataset.setting;state.settings[k]=!state.settings[k];await saveSettings();});
    if(action==="reset-app")return DF.UI.confirmModal("إعادة ضبط التطبيق","سيتم حذف التقدم والكلمات المضافة وإعادة تحميل قاعدة الكلمات الأصلية. لا يمكن التراجع دون نسخة احتياطية.","reset-app-confirmed","إعادة الضبط");
    if(action==="reset-app-confirmed")return withBusy(resetApp);
  });

  document.addEventListener("submit",e=>{if(e.target.id==="word-form"){e.preventDefault();withBusy(()=>saveWord(e.target));}});
  document.addEventListener("input",DF.debounce(e=>{if(e.target.id==="word-search"){state.wordView.query=e.target.value;state.wordView.limit=200;render();}},160));
  document.addEventListener("change",e=>{
    if(e.target.id==="word-sort"){state.wordView.sort=e.target.value;render();}
    if(e.target.id==="theme-select"){withBusy(async()=>{state.settings.theme=e.target.value;await saveSettings();});}
    if(e.target.classList.contains("setting-number")){withBusy(async()=>{const k=e.target.dataset.setting;state.settings[k]=Math.max(0,Math.min(500,parseInt(e.target.value,10)||0));await saveSettings();});}
  });
  document.addEventListener("keydown",e=>{
    if(e.key==="Enter"&&!e.shiftKey&&state.route==="study"&&!state.session?.result&&document.activeElement?.id==="answer-input"){e.preventDefault();document.querySelector('[data-action="submit-writing"]')?.click();}
    if(e.key==="Escape"&&document.querySelector(".modal-backdrop"))DF.UI.closeModal();
  });

  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.installPrompt=e;render();});
  matchMedia("(prefers-color-scheme:dark)").addEventListener?.("change",()=>{if(state.settings.theme==="auto")DF.UI.applyTheme(state.settings);});
  window.addEventListener("unhandledrejection",e=>{console.error(e.reason);DF.UI.toast(e.reason?.message||"حدث خطأ في التطبيق.","error");});

  async function boot(){
    try{
      await loadState();DF.UI.applyTheme(state.settings);render();
      
    }catch(e){console.error(e);document.getElementById("app").innerHTML=`<main class="boot-screen"><div class="brand-mark">!</div><h1>تعذر تشغيل التطبيق</h1><p>${DF.esc(e?.message||e)}</p><button class="primary-btn" onclick="location.reload()">إعادة المحاولة</button></main>`;}
  }
  boot();
})();
