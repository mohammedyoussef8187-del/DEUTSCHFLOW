window.addEventListener("load",()=>{if("serviceWorker" in navigator&&location.protocol==="https:")setTimeout(()=>navigator.serviceWorker.register("/sw.js").catch(console.error),1800);});
