(() => {
  const navigatorRef = window.navigator;
  const iOSDevice = /iPad|iPhone|iPod/i.test(navigatorRef.userAgent)
    || (navigatorRef.platform === "MacIntel" && navigatorRef.maxTouchPoints > 1);
  const installed = navigatorRef.standalone === true
    || window.matchMedia("(display-mode: standalone)").matches;

  if (!iOSDevice || installed || sessionStorage.getItem("deutschflow-ios-install-help") === "hidden") return;

  const panel = document.createElement("aside");
  panel.id = "ios-install-help";
  panel.className = "ios-install-help";
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "تثبيت DeutschFlow على الجهاز");
  panel.innerHTML = `
    <button class="ios-install-help__close" type="button" aria-label="إغلاق إرشادات التثبيت">×</button>
    <strong>ثبّت DeutschFlow على الـ iPhone</strong>
    <span>افتح الصفحة في Safari، واضغط «مشاركة»، ثم «إضافة إلى الشاشة الرئيسية».</span>
  `;

  panel.querySelector("button").addEventListener("click", () => {
    sessionStorage.setItem("deutschflow-ios-install-help", "hidden");
    panel.remove();
  });

  document.body.append(panel);
})();
