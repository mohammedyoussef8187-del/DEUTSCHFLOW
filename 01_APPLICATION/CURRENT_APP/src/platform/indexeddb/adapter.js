export function createIndexedDbAdapter(DF, environment = globalThis) {
  const DB_NAME="deutschflow_v2";
  const DB_VERSION=2;
  const indexedDB=environment.indexedDB;
  let db=null;

  function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error("IndexedDB request failed"));});}
  function transactionDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error("IndexedDB transaction failed"));tx.onabort=()=>reject(tx.error||new Error("IndexedDB transaction aborted"));});}

  async function open(){
    if(db)return db;
    db=await new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=e=>{
        const d=e.target.result;
        if(!d.objectStoreNames.contains("words")){
          const s=d.createObjectStore("words",{keyPath:"id"});
          s.createIndex("normalizedGerman","normalizedGerman",{unique:false});
          s.createIndex("qualityStatus","qualityStatus",{unique:false});
        }
        if(!d.objectStoreNames.contains("cards")){
          const s=d.createObjectStore("cards",{keyPath:"key"});
          s.createIndex("wordId","wordId",{unique:false});
          s.createIndex("dueAt","dueAt",{unique:false});
          s.createIndex("skill","skill",{unique:false});
        }
        if(!d.objectStoreNames.contains("attempts")){
          const s=d.createObjectStore("attempts",{keyPath:"id",autoIncrement:true});
          s.createIndex("createdAt","createdAt",{unique:false});
          s.createIndex("wordId","wordId",{unique:false});
          s.createIndex("cardKey","cardKey",{unique:false});
          s.createIndex("sessionId","sessionId",{unique:false});
          s.createIndex("skill","skill",{unique:false});
          s.createIndex("correct","correct",{unique:false});
          s.createIndex("answerType","answerType",{unique:false});
        }else{
          const s=req.transaction.objectStore("attempts");
          if(!s.indexNames.contains("sessionId"))s.createIndex("sessionId","sessionId",{unique:false});
          if(!s.indexNames.contains("skill"))s.createIndex("skill","skill",{unique:false});
          if(!s.indexNames.contains("correct"))s.createIndex("correct","correct",{unique:false});
          if(!s.indexNames.contains("answerType"))s.createIndex("answerType","answerType",{unique:false});
        }
        if(!d.objectStoreNames.contains("meta"))d.createObjectStore("meta",{keyPath:"key"});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error("تعذر فتح قاعدة البيانات"));
      req.onblocked=()=>reject(new Error("قاعدة البيانات مفتوحة في تبويب آخر. أغلق التبويبات القديمة ثم أعد المحاولة."));
    });
    db.onversionchange=()=>{db.close();db=null;};
    return db;
  }

  function store(name,mode="readonly"){return db.transaction(name,mode).objectStore(name);}
  async function get(name,key){await open();return request(store(name).get(key));}
  async function getAll(name){await open();return request(store(name).getAll());}
  async function put(name,value){await open();return request(store(name,"readwrite").put(value));}
  async function add(name,value){await open();return request(store(name,"readwrite").add(value));}
  async function del(name,key){await open();return request(store(name,"readwrite").delete(key));}
  async function clear(name){await open();return request(store(name,"readwrite").clear());}
  async function bulkPut(name,values){
    await open();if(!values.length)return;
    const tx=db.transaction(name,"readwrite"),s=tx.objectStore(name);for(const v of values)s.put(v);await transactionDone(tx);
  }
  async function bulkDelete(name,keys){
    await open();if(!keys.length)return;
    const tx=db.transaction(name,"readwrite"),s=tx.objectStore(name);for(const k of keys)s.delete(k);await transactionDone(tx);
  }
  async function getByIndex(name,indexName,query=null){await open();const idx=store(name).index(indexName);return request(query==null?idx.getAll():idx.getAll(query));}
  async function getAttemptsSince(ts){
    await open();const tx=db.transaction("attempts","readonly"),idx=tx.objectStore("attempts").index("createdAt");
    return request(idx.getAll(environment.IDBKeyRange.lowerBound(ts)));
  }

  async function getMeta(key,fallback=null){const r=await get("meta",key);return r?r.value:fallback;}
  async function setMeta(key,value){return put("meta",{key,value,updatedAt:Date.now()});}

  async function databaseExists(name){
    if(typeof indexedDB.databases!=="function")return true;
    try{return (await indexedDB.databases()).some(x=>x.name===name);}catch{return true;}
  }
  async function readLegacy(){
    const name="german_vocab_std";
    if(!(await databaseExists(name)))return null;
    return new Promise(resolve=>{
      let settled=false;
      const req=indexedDB.open(name);
      req.onerror=()=>resolve(null);
      req.onupgradeneeded=()=>{try{req.transaction.abort();}catch{} resolve(null);};
      req.onsuccess=()=>{
        const legacy=req.result;
        if(!legacy.objectStoreNames.contains("words")){legacy.close();return resolve(null);}
        const tx=legacy.transaction(["words",...(legacy.objectStoreNames.contains("meta")?["meta"]:[])],"readonly");
        const wr=tx.objectStore("words").getAll();
        let sr=null;if(legacy.objectStoreNames.contains("meta"))sr=tx.objectStore("meta").get("settings");
        tx.oncomplete=()=>{legacy.close();if(settled)return;settled=true;resolve({words:wr.result||[],settings:sr?.result||null});};
        tx.onerror=()=>{legacy.close();if(!settled){settled=true;resolve(null);}};
      };
    });
  }

  function transformLegacyWord(w){
    const split=DF.splitArticle(w.german);
    let article=w.article||split.article,itemType=w.itemType||DF.inferItemType(w.german,article);
    if(DF.ARTICLES.includes(DF.normalizeGerman(w.german,{stripPunctuation:false}))&&!split.rest.includes(" ")){article=null;itemType="word";}
    const word={
      id:w.id,
      german:w.german,
      arabic:w.arabic,
      pronunciation:w.pr||w.pronunciation||"",
      normalizedGerman:DF.normalizeGerman(w.german),
      normalizedArabic:DF.normalizeArabic(w.arabic),
      itemType,
      article,
      plural:w.plural||"",
      level:w.level||"",
      tags:Array.isArray(w.tags)?w.tags:[],
      acceptedAnswers:Array.isArray(w.acceptedAnswers)?w.acceptedAnswers:[],
      sourceRow:w.sourceRow??null,
      favorite:!!w.favorite,
      ignored:!!w.ignored,
      createdAt:w.createdAt||Date.now(),
      updatedAt:Date.now(),
      qualityStatus:"ok",
      qualityIssues:[],
      qualityNote:"تم استيرادها من النسخة السابقة."
    };
    const patch=DF.DATA_PATCHES[word.id];
    if(patch){Object.assign(word,patch);word.normalizedGerman=DF.normalizeGerman(word.german);word.normalizedArabic=DF.normalizeArabic(word.arabic);}
    word.qualityIssues=DF.qualityIssues(word);word.qualityStatus=word.qualityIssues.length?"review":"ok";
    return word;
  }

  function legacyCards(w,word){
    const cards=[];
    const now=Date.now();
    const mapping=[
      ["recall",Math.max(w.recallScore||0,w.writingScore||0)],
      ["recognition",w.recognitionScore||0]
    ];
    if(word.itemType==="noun"&&word.article)mapping.push(["article",w.articleScore||0]);
    if(word.itemType==="sentence")mapping.push(["order",w.recallScore||0]);
    for(const [skill,score] of mapping){
      if(score<=0&&(w.reps||0)<=0)continue;
      const c=DF.createCard(word.id,skill,now);
      c.reps=Math.max(1,Math.round((w.reps||0)*(skill==="recall"?1:.65)));
      c.lapses=w.lapses||0;c.correct=Math.max(0,w.correctCount||0);c.wrong=Math.max(0,w.incorrectCount||0);
      c.intervalDays=Math.max(0,w.intervalDays||0);c.ease=w.easeFactor||2.5;c.dueAt=w.nextReviewAt||now;c.lastReviewedAt=w.lastReviewedAt||null;
      c.state=c.intervalDays>=30?"mastered":"review";c.mastery=Math.max(score,DF.cardMastery(c));c.updatedAt=now;
      cards.push(c);
    }
    return cards;
  }

  async function initialize(){
    await open();
    const existing=await getAll("words");
    let settings=await getMeta("settings",null);
    let migration=null;
    if(!existing.length){
      const legacy=await readLegacy();
      if(legacy?.words?.length){
        const words=legacy.words.map(transformLegacyWord);
        const cards=legacy.words.flatMap((w,i)=>legacyCards(w,words[i]));
        await bulkPut("words",words);await bulkPut("cards",cards);
        if(legacy.settings){
          settings={...DF.DEFAULT_SETTINGS,
            theme:legacy.settings.theme||"auto",
            newPerDay:legacy.settings.newPerDay??DF.DEFAULT_SETTINGS.newPerDay,
            reviewsPerDay:legacy.settings.reviewsPerDay??DF.DEFAULT_SETTINGS.reviewsPerDay,
            sessionSize:legacy.settings.sessionSize??DF.DEFAULT_SETTINGS.sessionSize,
            showPronunciation:legacy.settings.showPronunciation??true,
            acceptAeOeUe:legacy.settings.acceptAeOeUe??true,
            acceptSs:legacy.settings.acceptSs??true,
            dailyGoal:legacy.settings.dailyGoal??DF.DEFAULT_SETTINGS.dailyGoal
          };
          await setMeta("settings",settings);
        }
        migration={type:"legacy",count:words.length};
      }else{
        const seed=Array.isArray(environment.SEED)?environment.SEED:[];
        /* Rows the triage excluded never become learner words. They stay in seed-data.js,
           which is the evidence; what is dropped here is only their publication. */
        const triaged=seed.map(DF.applyPatchToSeed);
        const words=triaged.filter(w=>!w.excluded);
        await bulkPut("words",words);
        migration={type:"seed",count:words.length,excluded:triaged.length-words.length};
      }
    }
    settings={...DF.DEFAULT_SETTINGS,...(settings||await getMeta("settings",{}))};
    await setMeta("settings",settings);
    if(await getMeta("profile",null)==null)await setMeta("profile",{streak:0,lastStudyDate:null,totalXP:0,createdAt:Date.now()});
    return {settings,migration};
  }

  async function replaceAll({words,cards,attempts,settings,profile}){
    await open();const tx=db.transaction(["words","cards","attempts","meta"],"readwrite");
    tx.objectStore("words").clear();tx.objectStore("cards").clear();tx.objectStore("attempts").clear();
    for(const w of words||[])tx.objectStore("words").put(w);
    for(const c of cards||[])tx.objectStore("cards").put(c);
    for(const a of attempts||[])tx.objectStore("attempts").put(a);
    if(settings)tx.objectStore("meta").put({key:"settings",value:{...DF.DEFAULT_SETTINGS,...settings},updatedAt:Date.now()});
    if(profile)tx.objectStore("meta").put({key:"profile",value:profile,updatedAt:Date.now()});
    tx.objectStore("meta").put({key:"session",value:null,updatedAt:Date.now()});
    await transactionDone(tx);
  }

  return {open,get,getAll,put,add,delete:del,clear,bulkPut,bulkDelete,getByIndex,getAttemptsSince,getMeta,setMeta,initialize,replaceAll,DB_NAME};
}
