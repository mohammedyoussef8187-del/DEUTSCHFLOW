import { DEFAULT_SETTINGS } from "../core/utils.js";
import { ARTICLES, foldGerman, normalizeArabic, normalizeGerman, splitArticle } from "../core/text.js";

export function levenshtein(a,b){
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

export function validateGermanAnswer(userRaw,word,settings=DEFAULT_SETTINGS,expectedOverride=null){
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

export function arabicTokenScore(user,expected){
  const stop=new Set(["من","في","على","إلى","الى","أن","ان","هو","هي","هذا","هذه","ذلك","التي","الذي","و","أو","او","ثم","قد"]);
  const u=normalizeArabic(user).split(" ").filter(x=>x&&!stop.has(x));
  const e=normalizeArabic(expected).split(" ").filter(x=>x&&!stop.has(x));
  if(!u.length||!e.length)return 0;
  const uc=new Map(),ec=new Map();for(const x of u)uc.set(x,(uc.get(x)||0)+1);for(const x of e)ec.set(x,(ec.get(x)||0)+1);
  let common=0;for(const [x,n] of uc)common+=Math.min(n,ec.get(x)||0);
  const precision=common/u.length,recall=common/e.length;
  return precision+recall?2*precision*recall/(precision+recall):0;
}

export function validateArticleAnswer(userRaw,word){
  const user=normalizeGerman(userRaw,{stripPunctuation:true});
  const expected=String(word.article||"").toLowerCase();
  if(!user)return result("empty",false,expected,"","لم تكتب أداة التعريف.",0);
  if(user===expected)return result("perfect",true,expected,user,"أداة التعريف صحيحة.",1);
  if(ARTICLES.includes(user))return result("article_wrong",false,expected,user,`الأداة الصحيحة: ${expected}.`,.2);
  return result("wrong",false,expected,user,"اكتب فقط: der أو die أو das.",0);
}

export function validateArabicAnswer(userRaw,word,expectedOverride=null,settings=DEFAULT_SETTINGS){
  const expected=String(expectedOverride??word.arabic??"").trim();
  const user=String(userRaw??"").trim().replace(/\s+/g," ");
  if(!user)return result("empty",false,expected,user,"لم تكتب إجابة.",0);
  const candidates=[expected,...(word.acceptedArabicAnswers||[])].map(String).filter(Boolean);
  const un=normalizeArabic(user);
  for(const cand of candidates){
    const cn=normalizeArabic(cand);
    if(un===cn)return result("perfect",true,expected,user,"إجابة صحيحة تماماً.",1);
    const dist=levenshtein(un,cn);
    const typoLimit=Math.max(1,Math.floor(cn.length/(settings.difficultyMode==="hard"?28:18)));
    if(dist>0&&dist<=typoLimit)return result("minor_typo",true,expected,user,"المعنى صحيح مع خطأ كتابي بسيط.",.82);
    if(settings.difficultyMode!=="hard"&&!settings.strictArabicAnswers&&cn.split(" ").length>=4&&arabicTokenScore(user,cand)>=.92){
      return result("acceptable_paraphrase",true,expected,user,"صياغة عربية قريبة من إجابة معتمدة.",.84);
    }
  }
  return result("wrong",false,expected,user,settings.difficultyMode==="hard"?"اكتب المعنى بدقة أو استخدم صياغة بديلة معتمدة لهذه البطاقة.":"المعنى المكتوب لا يطابق الإجابة المعتمدة.",0);
}

function result(type,isCorrect,correctAnswer,userAnswer,note,quality,extra={}){
  return {type,isCorrect,correctAnswer,userAnswer,note,quality,...extra};
}
