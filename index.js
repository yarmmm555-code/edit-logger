(function (exports) {
  const toast = (t) => { try { vendetta.ui.toasts.showToast(String(t)); } catch (e) {} };
  const MARK = "\n\u200b\n";
  const MAX = 1000;
  const hist = {};
  const clean = {};
  let unpatch = null;
  let timer = null;

  const strip = (s) => (typeof s === "string" ? s.split(MARK)[0] : s);
  const render = (list) => MARK + list.map((h) => String(h) + " (edited)").join("\n");

  const getStorage = () => {
    try { return vendetta.plugin && vendetta.plugin.storage; } catch (e) { return null; }
  };

  const loadSaved = () => {
    try {
      const st = getStorage();
      if (st && st.data) Object.assign(hist, JSON.parse(st.data));
    } catch (e) {}
  };

  const saveNow = () => {
    try {
      const st = getStorage();
      if (!st) return;
      const keys = Object.keys(hist);
      if (keys.length > MAX) keys.slice(0, keys.length - MAX).forEach((k) => delete hist[k]);
      st.data = JSON.stringify(hist);
    } catch (e) {}
  };

  const saveSoon = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(saveNow, 500);
  };

  const applyToLoaded = (list) => {
    if (!Array.isArray(list)) return;
    for (const m of list) {
      try {
        if (m && m.id && typeof m.content === "string" && hist[m.id] && hist[m.id].length) {
          const now = strip(m.content);
          clean[m.id] = now;
          m.content = now + render(hist[m.id]);
        }
      } catch (e) {}
    }
  };

  exports.onLoad = () => {
    try {
      const { findByStoreName } = vendetta.metro;
      const { FluxDispatcher } = vendetta.metro.common;
      const { before } = vendetta.patcher;
      const MessageStore = findByStoreName("MessageStore");
      if (!FluxDispatcher || !MessageStore) return toast("Edit Logger: modules not found");

      loadSaved();

      unpatch = before("dispatch", FluxDispatcher, (args) => {
        try {
          const ev = args[0];
          if (!ev) return;

          if (ev.type === "LOAD_MESSAGES_SUCCESS" || ev.type === "LOAD_MESSAGES_SUCCESS_CACHED") {
            applyToLoaded(ev.messages);
            return;
          }

          if (ev.type !== "MESSAGE_UPDATE") return;
          const m = ev.message;
          if (!m || typeof m.content !== "string" || !m.id) return;

          const now = strip(m.content);
          if (now.endsWith(" (deleted)")) return;

          const old = MessageStore.getMessage(m.channel_id, m.id);
          const prev = clean[m.id] !== undefined ? clean[m.id] : old ? strip(old.content) : undefined;

          if (prev !== undefined && prev !== now && prev !== "") {
            (hist[m.id] = hist[m.id] || []).push(prev);
            saveSoon();
          }
          clean[m.id] = now;

          if (hist[m.id] && hist[m.id].length) {
            m.content = now + render(hist[m.id]);
          }
        } catch (e) {}
      });

      toast(getStorage() ? "Edit Logger ready (saved)" : "Edit Logger ready (no storage)");
    } catch (e) {
      toast("Edit Logger error: " + (e && e.message ? e.message : e));
    }
  };

  exports.onUnload = () => {
    saveNow();
    if (unpatch) { unpatch(); unpatch = null; }
  };
  return exports;
})({});
