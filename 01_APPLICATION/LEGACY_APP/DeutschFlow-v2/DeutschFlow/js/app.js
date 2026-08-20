(function(){
  "use strict";
  const DF=window.DF;
  const state=DF.state={
    route:"home",settings:{...DF.DEFAULT_SETTINGS},profile:{streak:0,totalXP:0},words:[],cards:[],wordsMap:new Map(),cardsMap:new Map(),
    session:null,recentAttempts:[],wordView:{query:"",filter:"all",sort:"alpha",limit:200},orderState:null,lastChoice:null,
    importPreview:null,installPrompt:null,busy:false
  };

  async function loadState(){
    const init=await DF.DB.initialize();state.settings=init.settings;
    state.words=await DF.DB.getAll("words");state.cards=await DF.DB.getAll("cards");
    state.wordsMap=new Map(state.words.map(w=>[w.id,w]));state.cardsMap=new Map(state.cards.map(c=>[c.key,c]));
    state.profile=await DF.DB.getMeta("profile",{streak:0,totalXP:0});
    state.session=await DF.DB.getMeta("session",null);
    state.recentAttempts=await DF.DB.getAttemptsSince(Date.now()-7*DF.DAY);
    if(state.session?.done)state.session=null;
    if(init.migration?.type==="legacy")setTimeout(()=>DF.UI.toast(`تم نقل ${init.migration.count.toLocaleString("ar-EG")} كلمة وتقدمها من النسخة السابقة.`,"success"),350);
  }
  async function refreshAttempts(){state.recentAttempts=await DF.DB.getAttemptsSince(Date.now()-7*DF.DAY);}
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
  async function saveSettings(){await DF.DB.setMeta("settings",state.settings);DF.UI.applyTheme(state.settings);}

  function formObject(form){const fd=new FormData(form),o={};for(const [k,v] of fd)o[k]=typeof v==="string"?v.trim():v;return o;}
  async function saveWord(form){
    const data=formObject(form),id=Number(form.dataset.id||0),existing=id?state.wordsMap.get(id):null;
    if(!data.german||!data.arabic)throw new Error("أدخل الكلمة الألمانية والمعنى العربي.");
    const normG=DF.normalizeGerman(data.german),normA=DF.normalizeArabic(data.arabic);
    const duplicate=state.words.find(w=>w.id!==id&&w.normalizedGerman===normG&&w.normalizedArabic===normA);
    if(duplicate)throw new Error("هذه الكلمة والمعنى موجودان بالفعل.");
    const split=DF.splitArticle(data.german),now=Date.now();
    const word={...(existing||{}),id:id||state.words.reduce((m,w)=>Math.max(m,Number(w.id)||0),0)+1,german:data.german,arabic:data.arabic,pronunciation:data.pronunciation||"",plural:data.plural||"",level:data.level||"",tags:(data.tags||"").split(/[;,|]/).map(x=>x.trim()).filter(Boolean),acceptedAnswers:(data.acceptedAnswers||"").split(/\n/).map(x=>x.trim()).filter(Boolean),normalizedGerman:normG,normalizedArabic:normA,article:split.article,itemType:DF.inferItemType(data.german,split.article),favorite:data.favorite==="on",ignored:data.ignored==="on",sourceRow:existing?.sourceRow??null,createdAt:existing?.createdAt||now,updatedAt:now,qualityNote:existing?.qualityNote||""};
    word.qualityIssues=DF.qualityIssues(word);word.qualityStatus=word.qualityIssues.length?"review":"ok";
    await DF.DB.put("words",word);state.wordsMap.set(word.id,word);
    const idx=state.words.findIndex(w=>w.id===word.id);if(idx>=0)state.words[idx]=word;else state.words.push(word);
    // Suspend card types that no longer apply after editing.
    const related=state.cards.filter(c=>c.wordId===word.id);for(const c of related){const invalid=(c.skill==="article"&&!(word.itemType==="noun"&&word.article))||(c.skill==="order"&&word.itemType!=="sentence");if(invalid){c.suspended=true;await DF.Learning.persistCard(state,c);}}
    DF.UI.closeModal();DF.UI.toast(existing?"تم تحديث الكلمة.":"تمت إضافة الكلمة.","success");
  }
  async function deleteWord(id){
    const related=state.cards.filter(c=>c.wordId===id),attempts=await DF.DB.getByIndex("attempts","wordId",id);
    await DF.DB.delete("words",id);await DF.DB.bulkDelete("cards",related.map(c=>c.key));await DF.DB.bulkDelete("attempts",attempts.map(a=>a.id));
    state.words=state.words.filter(w=>w.id!==id);state.wordsMap.delete(id);state.cards=state.cards.filter(c=>c.wordId!==id);for(const c of related)state.cardsMap.delete(c.key);
    DF.UI.closeModal();DF.UI.toast("تم حذف الكلمة وسجلها.");
  }
  async function resetWordProgress(id){
    const related=state.cards.filter(c=>c.wordId===id);await DF.DB.bulkDelete("cards",related.map(c=>c.key));state.cards=state.cards.filter(c=>c.wordId!==id);for(const c of related)state.cardsMap.delete(c.key);DF.UI.closeModal();DF.UI.toast("تم تصفير تقدم الكلمة.");
  }

  async function resetApp(){
    await DF.DB.clear("words");await DF.DB.clear("cards");await DF.DB.clear("attempts");await DF.DB.setMeta("session",null);await DF.DB.setMeta("profile",{streak:0,lastStudyDate:null,totalXP:0,createdAt:Date.now()});location.reload();
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
    if(e.key==="Enter"&&state.route==="study"&&!state.session?.result&&state.session?.current?.skill==="recall"&&document.activeElement?.id==="answer-input"){e.preventDefault();document.querySelector('[data-action="submit-writing"]')?.click();}
    if(e.key==="Escape"&&document.querySelector(".modal-backdrop"))DF.UI.closeModal();
  });

  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.installPrompt=e;render();});
  matchMedia("(prefers-color-scheme:dark)").addEventListener?.("change",()=>{if(state.settings.theme==="auto")DF.UI.applyTheme(state.settings);});
  window.addEventListener("unhandledrejection",e=>{console.error(e.reason);DF.UI.toast(e.reason?.message||"حدث خطأ في التطبيق.","error");});

  async function boot(){
    try{
      await loadState();DF.UI.applyTheme(state.settings);render();
      if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("sw.js").catch(console.warn);
    }catch(e){console.error(e);document.getElementById("app").innerHTML=`<main class="boot-screen"><div class="brand-mark">!</div><h1>تعذر تشغيل التطبيق</h1><p>${DF.esc(e?.message||e)}</p><button class="primary-btn" onclick="location.reload()">إعادة المحاولة</button></main>`;}
  }
  boot();
})();
