/* Teacher/admin role entrypoint.
   Keep teacher-only browser enhancements here as the shared app is split. */
(() => {
  function setupAdmin(app) {
    if (app.state.me?.role !== "teacher") return;
    document.body.dataset.roleScript = "admin";
    const teacherTools = app.byId("teacherTools");
    if (teacherTools) teacherTools.dataset.roleOwner = "admin";
  }

  if (window.MathApp?.onReady) window.MathApp.onReady(setupAdmin);
  else window.addEventListener("math-app-ready", (event) => setupAdmin(event.detail));
})();
