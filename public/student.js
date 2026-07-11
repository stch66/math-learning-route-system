/* Student role entrypoint.
   Keep student-only browser enhancements here as the shared app is split. */
(() => {
  function syncTabletMode() {
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
    const tabletWidth = window.matchMedia?.("(max-width: 1180px)")?.matches;
    document.body.classList.toggle("student-tablet", Boolean(coarse || tabletWidth));
  }

  function setupStudent(app) {
    if (app.state.me?.role !== "student") return;
    document.body.dataset.roleScript = "student";
    syncTabletMode();
    window.matchMedia?.("(pointer: coarse)")?.addEventListener?.("change", syncTabletMode);
    window.matchMedia?.("(max-width: 1180px)")?.addEventListener?.("change", syncTabletMode);
    const focus = app.byId("studentFocus");
    if (focus) focus.dataset.roleOwner = "student";
  }

  if (window.MathApp?.onReady) window.MathApp.onReady(setupStudent);
  else window.addEventListener("math-app-ready", (event) => setupStudent(event.detail));
})();
