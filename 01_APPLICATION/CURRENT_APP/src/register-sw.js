window.addEventListener("load",()=>{
  const localHost=["localhost","127.0.0.1","[::1]"].includes(location.hostname);
  const secureWebOrigin=location.protocol==="https:"||localHost;
  if("serviceWorker" in navigator&&secureWebOrigin){
    setTimeout(()=>navigator.serviceWorker.register("./sw.js",{scope:"./"}).catch(console.error),1800);
  }
});
