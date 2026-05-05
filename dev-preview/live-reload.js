(function () {
  if (!("EventSource" in window)) {
    return;
  }

  const events = new EventSource("/__live-reload");
  let reloadTimer = null;

  events.addEventListener("reload", () => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      window.location.reload();
    }, 80);
  });
})();
