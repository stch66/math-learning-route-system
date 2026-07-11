/* Compatibility shim. The maintained app code lives in /public/shared.js. */
(() => {
  if (window.MathApp) return;
  const script = document.createElement("script");
  script.src = "/public/shared.js";
  script.defer = true;
  document.head.appendChild(script);
})();
