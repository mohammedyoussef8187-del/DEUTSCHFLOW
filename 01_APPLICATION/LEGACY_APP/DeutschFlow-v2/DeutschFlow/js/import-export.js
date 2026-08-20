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
      const word={id:++maxId,german:g,arabic:a,pronunciation:p,normalizedGerman:DF.normalizeGerman(g),normalizedArabic:DF.normalizeArabic(a),itemType,article:split.article,plural:plural>=0?String(r[plural]??"").trim():"",level:level>=0?String(r[level]??"").trim():"",tags:tags>=0?String(r[tags]??"").split(/[;,|]/).map(x=>x.trim()).filter(Boolean):[],acceptedAnswers:[],sourceRow:i+1,favorite:false,ignored:false,createdAt:Date.now(),updatedAt:Date.now(),qualityStatus:"ok",qualityIssues:[],qualityNote:"مستورد بواسطة المستخدم"};
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
    if(!preview?.items?.length)return 0;await DF.DB.bulkPut("words",preview.items);
    state.words.push(...preview.items);for(const w of preview.items)state.wordsMap.set(w.id,w);return preview.items.length;
  }

  async function exportBackup(state){
    const attempts=await DF.DB.getAll("attempts");
    const payload={app:"DeutschFlow",schemaVersion:2,exportedAt:Date.now(),words:state.words,cards:state.cards,attempts,settings:state.settings,profile:state.profile};
    DF.downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),`DeutschFlow-backup-${DF.localDateKey()}.json`);
  }
  async function restoreBackup(file){
    if(!file)throw new Error("لم يتم اختيار ملف.");let payload;
    try{payload=JSON.parse(await file.text());}catch{throw new Error("ملف النسخة الاحتياطية غير صالح.");}
    if(payload.app!=="DeutschFlow"||!Array.isArray(payload.words)||!Array.isArray(payload.cards))throw new Error("هذا الملف ليس نسخة DeutschFlow صحيحة.");
    await DF.DB.replaceAll(payload);return payload;
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
