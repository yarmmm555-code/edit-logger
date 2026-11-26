(function (exports) {
  const toast = (t) => { try { vendetta.ui.toasts.showToast(String(t)); } catch (e) {} };
  const MARK = "\n\u200b\n";
  const hist = {};
  const clean = {};
  let unpatch = null;

  const strip = (s) => (typeof s === "string" ? s.split(MARK)[0] : s);

  const render = (list) =>
    MARK + "```diff\n" +
    list
      .map((h) =>
        String(h).replace(/```/g, "'''").split("\n").map((l, i, a) =>
          "- " + l + (i === a.length - 1 ? " (edited)" : "")
        ).join("\n")
      )
      .join("\n") +
    "\n```";

  exports.onLoad = () => {
    try {
      const { findByStoreName } = vendetta.metro;
      const { FluxDispatcher } = vendetta.metro.common;
      const { before } = vendetta.patcher;
      const MessageStore = findByStoreName("MessageStore");
      if (!FluxDispatcher || !MessageStore) return toast("Edit Logger: modules not found");

      unpatch = before("dispatch", FluxDispatcher, (args) => {
        try {
          const ev = args[0];
          if (!ev || ev.type !== "MESSAGE_UPDATE") return;
          const m = ev.message;
          if (!m || typeof m.content !== "string" || !m.id) return;

          const old = MessageStore.getMessage(m.channel_id, m.id);
          const prev = clean[m.id] !== undefined ? clean[m.id] : old ? strip(old.content) : undefined;
          const now = strip(m.content);

          if (prev !== undefined && prev !== now && prev !== "") {
            (hist[m.id] = hist[m.id] || []).push(prev);
          }
          clean[m.id] = now;

          if (hist[m.id] && hist[m.id].length) {
            m.content = now + render(hist[m.id]);
          }
        } catch (e) {}
      });
      toast("Edit Logger ready");
    } catch (e) {
      toast("Edit Logger error: " + (e && e.message ? e.message : e));
    }
  };

  exports.onUnload = () => { if (unpatch) { unpatch(); unpatch = null; } };
  return exports;
})({});
