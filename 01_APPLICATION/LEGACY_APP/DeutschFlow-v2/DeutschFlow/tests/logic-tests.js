const fs=require('fs'),vm=require('vm'),assert=require('assert');
global.window=global;
global.matchMedia=()=>({matches:false,addEventListener(){}});
const elements={app:{innerHTML:''},'toast-root':{appendChild(){}},'modal-root':{innerHTML:''}};
global.document={documentElement:{dataset:{}},getElementById:id=>elements[id]||null,querySelector:()=>null,createElement:()=>({remove(){}})};
for(const f of ['core.js','learning.js','import-export.js','ui.js'])vm.runInThisContext(fs.readFileSync(__dirname+'/../js/'+f,'utf8'),{filename:f});
vm.runInThisContext(fs.readFileSync(__dirname+'/../data.js','utf8'),{filename:'data.js'});
const DF=global.DF;
const memory={meta:{},attempts:[],cards:new Map()};
DF.DB={setMeta:async(k,v)=>memory.meta[k]=JSON.parse(JSON.stringify(v)),getMeta:async(k,f)=>memory.meta[k]??f,put:async(n,v)=>{if(n==='cards')memory.cards.set(v.key,v)},add:async(n,v)=>{if(n==='attempts')memory.attempts.push(v)}};

(async()=>{
  assert.equal(SEED.length,2820,'Seed count');
  const seeded=SEED.map(DF.applyPatchToSeed);
  assert.equal(seeded.find(w=>w.id===17).arabic,'سهل / خفيف');
  assert.equal(seeded.find(w=>w.id===107).arabic,'تركيا');

  const word={id:1,german:'ruhig',arabic:'هادئ',pronunciation:'روهيغ',normalizedGerman:'ruhig',normalizedArabic:'هادئ',itemType:'word',article:null,qualityStatus:'ok',favorite:false,ignored:false,tags:[]};
  const noun={id:2,german:'das Haus',arabic:'البيت',pronunciation:'داس هاوس',normalizedGerman:'das haus',normalizedArabic:'البيت',itemType:'noun',article:'das',qualityStatus:'ok',favorite:false,ignored:false,tags:[]};
  const sentence={id:3,german:'Ich bin hier.',arabic:'أنا هنا',pronunciation:'إش بن هير',normalizedGerman:'ich bin hier',normalizedArabic:'انا هنا',itemType:'sentence',article:null,qualityStatus:'ok',favorite:false,ignored:false,tags:[]};
  assert.equal(DF.validateGermanAnswer('Ich bin hier',sentence,DF.DEFAULT_SETTINGS).isCorrect,true,'Punctuation tolerance');
  assert.equal(DF.validateGermanAnswer('Haus',noun,DF.DEFAULT_SETTINGS).type,'article_missing','Article required');
  assert.equal(DF.validateGermanAnswer('ruhig',word,DF.DEFAULT_SETTINGS).type,'perfect');

  const state={settings:{...DF.DEFAULT_SETTINGS,newPerDay:1,sessionSize:1,retryLimit:2},profile:{},words:[word,noun,sentence],wordsMap:new Map([[1,word],[2,noun],[3,sentence]]),cards:[],cardsMap:new Map(),recentAttempts:[],route:'study',wordView:{query:'',filter:'all',sort:'alpha',limit:200}};
  state.session=await DF.Learning.buildSession(state,'new');
  await DF.Learning.beginCurrent(state);
  assert.equal(state.session.current.kind,'intro');
  assert.equal(DF.Learning.progress(state.session).completed,0,'Intro is not a test attempt');
  await DF.Learning.introduceWord(state,false);
  assert.equal(state.session.current.kind,'test');
  assert.equal(DF.Learning.progress(state.session).completed,0,'Test remains pending after introduction');

  DF.UI.render(state);
  assert.equal(elements.app.innerHTML.includes('روهيغ'),false,'Pronunciation hidden on recall question');
  await DF.Learning.useHint(state);DF.UI.render(state);
  assert.equal(elements.app.innerHTML.includes('روهيغ'),true,'Pronunciation shown after hint');

  await DF.Learning.submitAnswer(state,{text:'wrong'});
  await DF.Learning.finalizeAnswer(state,4); // must be forced to Again because answer is wrong
  let p=DF.Learning.progress(state.session);
  assert.equal(p.completed,1);assert.equal(p.pendingRetries,1);assert.ok(p.percent<100,'Progress stays below 100 while retry remains');
  assert.equal(state.cardsMap.get('1:recall').lastResult,1,'Wrong answer cannot be rated Easy');

  const rows=DF.IO.parseCSV('German,Arabic,Pronunciation\nruhig,هادئ,روهيغ');
  assert.equal(rows.length,2);assert.equal(rows[1][0],'ruhig');
  console.log('All DeutschFlow logic tests passed.');
})().catch(e=>{console.error(e);process.exit(1)});
