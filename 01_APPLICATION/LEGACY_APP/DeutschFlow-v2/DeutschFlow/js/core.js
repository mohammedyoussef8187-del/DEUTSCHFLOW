(function(){
  "use strict";
  const DF=window.DF=window.DF||{};
  const DAY=86400000;
  const MINUTE=60000;
  const AR_DIACRITICS=/[ؐ-ًؚ-ٟۖ-ۭ]/g;
  const ARTICLES=["der","die","das"];

  const DEFAULT_SETTINGS={
    schemaVersion:2,
    theme:"auto",
    newPerDay:12,
    reviewsPerDay:40,
    sessionSize:20,
    retryLimit:2,
    showPronunciation:true,
    acceptAeOeUe:true,
    acceptSs:true,
    requireArticle:true,
    ignoreSentencePunctuation:true,
    dailyGoal:25,
    autoPlayAudio:false,
    compactMode:false
  };

  const DATA_PATCHES={
    17:{arabic:"سهل / خفيف",qualityNote:"تم تصحيح ترجمة مؤكدة: leicht ليست «ضوء»."},
    54:{arabic:"معلومات",qualityNote:"تم تصحيح المفرد إلى الجمع بما يتوافق مع Informationen."},
    107:{arabic:"تركيا",qualityNote:"تم تصحيح ترجمة مؤكدة لاسم الدولة."}
  };

  function esc(value){
    return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  }
  function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,n));}
  function round(n,d=0){const p=10**d;return Math.round(n*p)/p;}
  function shuffle(list){const a=list.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function sample(list,n){return shuffle(list).slice(0,n);}
  function uniqueBy(list,keyFn){const seen=new Set();return list.filter(x=>{const k=keyFn(x);if(seen.has(k))return false;seen.add(k);return true;});}
  function localDateKey(date=new Date()){
    const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");
    return `${y}-${m}-${d}`;
  }
  function startOfLocalDay(ts=Date.now()){const d=new Date(ts);d.setHours(0,0,0,0);return d.getTime();}
  function formatDate(ts){if(!ts)return"—";return new Intl.DateTimeFormat("ar-EG",{dateStyle:"medium"}).format(new Date(ts));}
  function formatRelative(ts,now=Date.now()){
    if(!ts)return"غير مجدولة";
    const diff=ts-now;
    const abs=Math.abs(diff);
    if(abs<45*MINUTE){const m=Math.max(1,Math.round(abs/MINUTE));return diff<=0?`منذ ${m} دقيقة`:`بعد ${m} دقيقة`;}
    const days=Math.round(abs/DAY);
    if(days===0)return diff<=0?"مستحقة اليوم":"لاحقاً اليوم";
    if(days===1)return diff<=0?"منذ يوم":"غداً";
    return diff<=0?`متأخرة ${days} أيام`:`بعد ${days} أيام`;
  }
  function normalizeGerman(s,{stripPunctuation=true}={}){
    let r=String(s??"").trim().normalize("NFC").replace(/\s+/g," ").toLowerCase();
    if(stripPunctuation)r=r.replace(/[.,!?;:()\[\]{}"'«»„“”\/\\-]+/g," ").replace(/\s+/g," ").trim();
    return r;
  }
  function normalizeArabic(s){
    return String(s??"").trim().replace(AR_DIACRITICS,"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[.,!?;:،؛()\[\]{}"'«»]/g," ").replace(/\s+/g," ").trim();
  }
  function foldGerman(s,{ae=true,ss=true}={}){
    let r=String(s??"");
    if(ae)r=r.replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/Ä/g,"Ae").replace(/Ö/g,"Oe").replace(/Ü/g,"Ue");
    if(ss)r=r.replace(/ß/g,"ss");
    return r;
  }
  function splitArticle(german){
    const raw=String(german??"").trim();
    const parts=raw.split(/\s+/);
    const article=ARTICLES.includes((parts[0]||"").toLowerCase())?parts[0].toLowerCase():null;
    return {article,rest:article?parts.slice(1).join(" "):raw};
  }
  function inferItemType(german,article=null){
    const g=String(german??"").trim();
    if(article||splitArticle(g).article)return"noun";
    const words=g.split(/\s+/).filter(Boolean);
    if(/[.!?]$/.test(g)||words.length>=5)return"sentence";
    if(words.length>=2)return"phrase";
    return"word";
  }
  function levenshtein(a,b){
    a=String(a);b=String(b);if(!a.length)return b.length;if(!b.length)return a.length;
    const row=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      let prev=row[0];row[0]=i;
      for(let j=1;j<=b.length;j++){
        const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;
      }
    }
    return row[b.length];
  }
  function typoThreshold(len){if(len<=5)return 1;if(len<=10)return 2;if(len<=18)return 3;return 4;}
  function sameTokens(a,b){
    const aa=normalizeGerman(a).split(" ").filter(Boolean).sort();
    const bb=normalizeGerman(b).split(" ").filter(Boolean).sort();
    return aa.length===bb.length&&aa.every((x,i)=>x===bb[i]);
  }
  function validateGermanAnswer(userRaw,word,settings=DEFAULT_SETTINGS,expectedOverride=null){
    const expected=String(expectedOverride??word.german??"").trim();
    const user=String(userRaw??"").trim().replace(/\s+/g," ");
    const accepted=(word.acceptedAnswers||[]).map(String).filter(Boolean);
    const candidates=[expected,...accepted];
    if(!user)return result("empty",false,expected,user,"لم تكتب إجابة.",0);

    for(const cand of candidates){
      if(user===cand)return result("perfect",true,expected,user,"إجابة صحيحة تماماً.",1);
    }

    const stripPunc=settings.ignoreSentencePunctuation!==false;
    const userNorm=normalizeGerman(user,{stripPunctuation:stripPunc});
    for(const cand of candidates){
      const candNorm=normalizeGerman(cand,{stripPunctuation:stripPunc});
      if(userNorm===candNorm){
        if(user.toLowerCase()===cand.toLowerCase()&&user!==cand)return result("capitalization",true,expected,user,"الإجابة صحيحة، مع ملاحظة الحروف الكبيرة والصغيرة.",.82);
        return result("punctuation",true,expected,user,"الإجابة صحيحة؛ اختلاف علامات الترقيم غير مؤثر.",.92);
      }
    }

    const isNoun=word.itemType==="noun"&&!!word.article;
    if(isNoun){
      const e=splitArticle(expected),u=splitArticle(user);
      const eRest=normalizeGerman(e.rest),uRest=normalizeGerman(u.rest);
      if(eRest===uRest){
        if(!u.article&&settings.requireArticle!==false)return result("article_missing",false,expected,user,`الأداة ناقصة. الصحيح: ${word.article}.`,.35);
        if(u.article&&u.article!==word.article)return result("article_wrong",false,expected,user,`الأداة خاطئة. الصحيح: ${word.article}.`,.25);
      }
    }

    const foldedUser=normalizeGerman(foldGerman(user,{ae:settings.acceptAeOeUe,ss:settings.acceptSs}),{stripPunctuation:stripPunc});
    for(const cand of candidates){
      const foldedExpected=normalizeGerman(foldGerman(cand,{ae:settings.acceptAeOeUe,ss:settings.acceptSs}),{stripPunctuation:stripPunc});
      if(foldedUser===foldedExpected)return result("umlaut_variant",true,expected,user,"صحيحة باستخدام ae/oe/ue أو ss كبديل.",.88);
    }

    if(sameTokens(user,expected)&&userNorm!==normalizeGerman(expected,{stripPunctuation:stripPunc}))return result("wrong_order",false,expected,user,"الكلمات صحيحة لكن ترتيبها غير صحيح.",.3);

    const expNorm=normalizeGerman(isNoun?splitArticle(expected).rest:expected,{stripPunctuation:stripPunc});
    const usrNorm=normalizeGerman(isNoun?splitArticle(user).rest:user,{stripPunctuation:stripPunc});
    const expWords=expNorm.split(" ").filter(Boolean),usrWords=usrNorm.split(" ").filter(Boolean);
    if(expWords.length>1&&usrWords.length<expWords.length&&usrWords.every(x=>expWords.includes(x)))return result("incomplete",false,expected,user,"الإجابة ناقصة؛ توجد كلمة أو أكثر مفقودة.",.3);

    const dist=levenshtein(usrNorm,expNorm);
    if(dist>0&&dist<=typoThreshold(expNorm.length))return result("minor_typo",false,expected,user,"قريب جداً، لكن يوجد خطأ إملائي.",.45,{distance:dist});
    return result("wrong",false,expected,user,"الإجابة غير صحيحة.",0,{distance:dist});
  }
  function result(type,isCorrect,correctAnswer,userAnswer,note,quality,extra={}){
    return {type,isCorrect,correctAnswer,userAnswer,note,quality,...extra};
  }

  function qualityIssues(word){
    const issues=[];
    const g=String(word.german||""),a=String(word.arabic||"");
    const balance=(s,o,c)=>(s.match(new RegExp(`\\${o}`,"g"))||[]).length===(s.match(new RegExp(`\\${c}`,"g"))||[]).length;
    if(!g.trim()||!a.trim())issues.push("بيانات أساسية ناقصة");
    if(!balance(g,"(",")")||!balance(a,"(",")"))issues.push("قوس غير مغلق");
    if(/\b[A-Z]\s*\/\s*\d+[a-z]?\b/i.test(g)||/\b\d+[a-z]?\s*\/\s*[A-Z]\b/i.test(g))issues.push("يبدو أنه يحتوي على مرجع تمرين");
    if(/\b(platz|sofort|planen)\s+[A-Z]\s*\/\s*\d/i.test(g))issues.push("مدخل مشوه محتمل من جدول أو تمرين");
    if(g.length>180||a.length>220)issues.push("طول غير معتاد");
    if(word.itemType==="noun"&&!word.article)issues.push("اسم دون أداة تعريف");
    if(word.article&&!normalizeGerman(g,{stripPunctuation:false}).startsWith(word.article+" "))issues.push("الأداة لا تطابق بداية المدخل");
    if(/^[\d\W_]+$/.test(g))issues.push("لا يحتوي على كلمة ألمانية صالحة");
    return issues;
  }
  function applyPatchToSeed(seed){
    const p=DATA_PATCHES[seed.id]||{};
    const german=p.german??seed.de;
    const arabic=p.arabic??seed.ar;
    const pronunciation=p.pronunciation??seed.pr??"";
    let article=(Object.prototype.hasOwnProperty.call(p,"article")?p.article:(seed.art??splitArticle(german).article));
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
      sourceRow:seed.row??null,
      favorite:false,
      ignored:false,
      createdAt:Date.now(),
      updatedAt:Date.now(),
      qualityStatus:"ok",
      qualityIssues:[],
      qualityNote:p.qualityNote||""
    };
    word.qualityIssues=qualityIssues(word);
    word.qualityStatus=word.qualityIssues.length?"review":"ok";
    return word;
  }

  function createCard(wordId,skill,now=Date.now()){
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
  function scheduleCard(card,rating,now=Date.now()){
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
  function cardMastery(card){
    if(!card||card.state==="new")return 0;
    const base=Math.min(70,card.reps*11);
    const interval=Math.min(25,Math.log2((card.intervalDays||0)+1)*7);
    const streak=Math.min(12,(card.streak||0)*2);
    const penalty=Math.min(35,(card.lapses||0)*7);
    return Math.round(clamp(base+interval+streak-penalty));
  }
  function automaticRating(answer,{usedHint=false,revealed=false,elapsedMs=0}={}){
    if(revealed||!answer?.isCorrect)return 1;
    if(usedHint||["capitalization","umlaut_variant","punctuation"].includes(answer.type)||elapsedMs>18000)return 2;
    if(answer.type==="perfect"&&elapsedMs<7000)return 4;
    return 3;
  }
  function skillLabel(skill){return({recall:"الاستدعاء والكتابة",recognition:"التعرّف على المعنى",article:"أداة الاسم",order:"ترتيب الجملة"})[skill]||skill;}
  function skillWeight(word,skill){
    if(skill==="recall")return .5;
    if(skill==="recognition")return .2;
    if(skill==="article"&&word.itemType==="noun")return .3;
    if(skill==="order"&&word.itemType==="sentence")return .3;
    return .15;
  }
  function wordMastery(word,cards){
    const relevant=cards.filter(c=>c.wordId===word.id&&!c.suspended);
    if(!relevant.length)return 0;
    let sum=0,w=0;for(const c of relevant){const wt=skillWeight(word,c.skill);sum+=cardMastery(c)*wt;w+=wt;}
    return Math.round(w?sum/w:0);
  }
  function wordStatus(word,cards,now=Date.now()){
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
  function cardStatus(card,now=Date.now()){
    if(card.suspended)return"ignored";
    if(card.state==="new")return"new";
    if(card.dueAt<now-DAY)return"overdue";
    if(card.dueAt<=now)return"due";
    if(card.lapses>=2&&card.mastery<60)return"weak";
    if(card.mastery>=85&&card.intervalDays>=30)return"mastered";
    return"learning";
  }
  function preferredSkills(word){
    const skills=["recall","recognition"];
    if(word.itemType==="noun"&&word.article)skills.push("article");
    if(word.itemType==="sentence")skills.push("order");
    return skills;
  }
  function nextSkillUnlocks(word,skill){
    if(skill!=="recall")return[];
    const out=["recognition"];
    if(word.itemType==="noun"&&word.article)out.push("article");
    if(word.itemType==="sentence")out.push("order");
    return out;
  }
  function makeId(prefix="id"){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`;}
  function csvCell(v){const s=String(v??"");return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
  function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
  function debounce(fn,wait=180){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),wait);};}

  Object.assign(DF,{DAY,MINUTE,ARTICLES,DEFAULT_SETTINGS,DATA_PATCHES,esc,clamp,round,shuffle,sample,uniqueBy,localDateKey,startOfLocalDay,formatDate,formatRelative,normalizeGerman,normalizeArabic,foldGerman,splitArticle,inferItemType,levenshtein,validateGermanAnswer,qualityIssues,applyPatchToSeed,createCard,scheduleCard,cardMastery,automaticRating,skillLabel,skillWeight,wordMastery,wordStatus,cardStatus,preferredSkills,nextSkillUnlocks,makeId,csvCell,downloadBlob,debounce});
})();
