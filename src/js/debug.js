/**
 * Debug
 *
 * Provides debugging utilities, primarily for mobile devices
 * where development tools may be less accessible.
 *
 * All css should be isolated to the `debug` functions, to avoid bloating
 * the main css file `theme.scss`.
 */

function isDebugEnabled() {
  // Checks if the root stylesheet has `:root { --yl-debug: true }`.
  try {
    const val = getComputedStyle(document.documentElement).getPropertyValue(
      "--yl-debug",
    );
    return val && val.trim() === "true";
  } catch (e) {
    return false;
  }
}

function renderDebugButtons() {
  if (!isDebugEnabled()) return;

  if (document.getElementById("yl-debug-btns")) return;

  const btns = document.createElement("div");
  btns.id = "yl-debug-btns";
  btns.style.cssText = [
    "position:fixed",
    "bottom:12px",
    "left:12px",
    "z-index:999999",
    "display:flex",
    "gap:8px",
    "pointer-events:auto",
  ].join(";");

  // Button styles
  const btnStyle = [
    "width:52px",
    "height:28px",
    "border-radius:8px",
    "background:#181818",
    "color:#fff",
    "border:1px solid #444",
    "font:15px/1.2 Menlo,monospace",
    "font-weight:bold",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "box-shadow:0 2px 8px rgba(0,0,0,0.18)",
    "cursor:pointer",
    "opacity:0.85",
    "transition:background 0.2s,opacity 0.2s",
    "outline:none",
    "padding:0",
    "user-select:none",
  ].join(";");

  // Console button (C)
  const btnC = document.createElement("button");
  btnC.type = "button";
  btnC.textContent = "C";
  btnC.title = "Show console logs";
  btnC.style.cssText = btnStyle;
  btnC.addEventListener("click", function () {
    try {
      localStorage.setItem("ylDebugConsoleLogsOpen", "true");
    } catch (e) {}
    renderConsoleLogs();
  });

  // LocalStorage button (L)
  const btnL = document.createElement("button");
  btnL.type = "button";
  btnL.textContent = "L";
  btnL.title = "Show localStorage state";
  btnL.style.cssText = btnStyle;
  btnL.addEventListener("click", function () {
    try {
      localStorage.setItem("ylDebugLocalStorageOpen", "true");
    } catch (e) {}
    renderLocalStorageStates();
  });

  btns.appendChild(btnC);
  btns.appendChild(btnL);
  document.body.appendChild(btns);
}

function renderDebugPanel({ id, title, top, bottom }) {
  let panel = document.getElementById(id);
  if (panel) return panel;

  panel = document.createElement("section");
  panel.id = id;
  panel.style.cssText = [
    "position:fixed",
    "left:1rem",
    "right:5rem",
    top ? `top:${top}` : "",
    bottom ? `bottom:${bottom}` : "",
    "max-height:40vh",
    "display:flex",
    "flex-direction:column",
    "background:rgba(10,10,10,0.92)",
    "color:#f2f2f2",
    "border:1px solid rgba(255,255,255,0.18)",
    "border-radius:8px",
    "z-index:999999",
    "font:12px/1.45 Menlo,Monaco,Consolas,monospace",
    "box-shadow:0 8px 24px rgba(0,0,0,0.35)",
  ]
    .filter(Boolean)
    .join(";");

  const header = document.createElement("div");
  header.style.cssText = [
    "display:flex",
    "justify-content:space-between",
    "align-items:center",
    "padding:8px 10px",
    "border-bottom:1px solid rgba(255,255,255,0.14)",
    "font-weight:600",
  ].join(";");

  const titleEl = document.createElement("span");
  titleEl.textContent = title;

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.style.cssText = [
    "background:#222",
    "color:#fff",
    "border:1px solid #555",
    "border-radius:6px",
    "padding:2px 8px",
    "font-size:11px",
  ].join(";");
  closeBtn.addEventListener("click", () => panel.remove());

  const body = document.createElement("pre");
  body.className = "yl-debug-panel-body";
  body.style.cssText = [
    "margin:0",
    "padding:10px",
    "overflow:auto",
    "white-space:pre-wrap",
    "word-break:break-word",
  ].join(";");

  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  panel.appendChild(header);
  panel.appendChild(body);
  document.body.appendChild(panel);

  return panel;
}

function renderConsoleLogs() {
  if (!isDebugEnabled()) return;
  const panel = renderDebugPanel({
    id: "yl-debug-console",
    title: "Youlag Console",
    bottom: "42px",
  });
  const closeBtn = panel.querySelector("button");
  if (closeBtn) {
    closeBtn.addEventListener(
      "click",
      function () {
        try {
          localStorage.setItem("ylDebugConsoleLogsOpen", "false");
        } catch (e) {}
      },
      { once: true },
    );
  }
  const body = panel.querySelector(".yl-debug-panel-body");

  if (!window.__ylConsoleDebugState) {
    const maxLines = 200;
    const logs = [];
    const methods = ["log", "info", "warn", "error"];
    const original = {};

    function formatArg(arg) {
      if (arg instanceof Error) return arg.stack || arg.message;
      if (typeof arg === "object" && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return "[Unserializable object]";
        }
      }
      return String(arg);
    }

    function render() {
      const liveBody = document
        .getElementById("yl-debug-console")
        ?.querySelector(".yl-debug-panel-body");
      if (!liveBody) return;
      liveBody.textContent = logs.join("\n");
      liveBody.scrollTop = liveBody.scrollHeight;
    }

    methods.forEach((name) => {
      original[name] = console[name].bind(console);
      console[name] = function (...args) {
        original[name](...args);
        const time = new Date().toLocaleTimeString();
        const line = `[${time}] ${name.toUpperCase()} ${args.map(formatArg).join(" ")}`;
        logs.push(line);
        if (logs.length > maxLines) logs.shift();
        render();
      };
    });

    window.__ylConsoleDebugState = { logs, render };
  }

  const state = window.__ylConsoleDebugState;
  body.textContent = state.logs.join("\n");
}

function renderLocalStorageStates() {
  if (!isDebugEnabled()) return;
  const panel = renderDebugPanel({
    id: "yl-debug-localstorage",
    title: "Youlag localStorage",
    top: "80px",
  });
  const closeBtn = panel.querySelector("button");
  if (closeBtn) {
    closeBtn.addEventListener(
      "click",
      function () {
        try {
          localStorage.setItem("ylDebugLocalStorageOpen", "false");
        } catch (e) {}
        if (window.__ylLocalStorageDebugInterval) {
          clearInterval(window.__ylLocalStorageDebugInterval);
          window.__ylLocalStorageDebugInterval = null;
        }
      },
      { once: true },
    );
  }

  const body = panel.querySelector(".yl-debug-panel-body");

  function parseValue(raw) {
    try {
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (e) {
      return raw;
    }
  }

  function render() {
    const prevScroll = body.scrollTop;
    // Summary
    let summary = "";
    let queue = null;
    let activeIndex = null;
    let activeVideo = null;
    let playbackTime = null;
    let playerState = null;
    let videoDuration = null;
    let isMiniplayer = null;

    try {
      queue = parseValue(localStorage.getItem("youlagVideoQueue"));
      if (queue && typeof queue === "object") {
        activeIndex = queue.queue_active_index;
        isMiniplayer = queue.isMiniplayer ?? null;
        if (
          Array.isArray(queue.queue) &&
          typeof activeIndex === "number" &&
          queue.queue[activeIndex]
        ) {
          activeVideo = queue.queue[activeIndex];
          playbackTime = activeVideo.playbackTime;
          playerState = activeVideo.playerState;
          videoDuration = activeVideo.videoDuration;
        }
      }
    } catch (e) {}

    if (activeVideo) {
      const badgeClass = (isSuccess) =>
        "inline-block yl-badge " +
        (isSuccess ? "yl-badge--success" : "yl-badge--warning");
      const iframeSrc = document.querySelector("#ylVideoIframe")?.src || "";
      const iframePath = iframeSrc
        ? iframeSrc.replace(/^https?:\/\/[^\/]+/, "")
        : null;

      summary += '<div class="yl-mb-md"><b>Active video:</b><br>';
      if (activeVideo.title) summary += activeVideo.title + "<br>";
      summary +=
        'isMiniplayer: <div class="' +
        badgeClass(isMiniplayer) +
        '">' +
        isMiniplayer +
        "</div><br>";
      summary +=
        'playbackTime: <div class="' +
        badgeClass(playbackTime > 0) +
        '">' +
        playbackTime +
        "</div><br>";
      summary +=
        'playerState: <div class="' +
        badgeClass(playerState === "playing") +
        '">' +
        playerState +
        "</div><br>";
      summary +=
        'videoDuration: <div class="' +
        badgeClass(videoDuration > 0) +
        '">' +
        videoDuration +
        "</div><br>";
      if (iframePath) {
        summary +=
          'iframe: <div class="' +
          badgeClass(iframeSrc.includes("autoplay=1")) +
          '">' +
          iframePath +
          "</div><br>";
      }

      summary +=
        'iOS: <div class="' +
        badgeClass(isIOS()) +
        '">' +
        isIOS() +
        "</div><br>";

      // iOS autoplay workaround state
      try {
        const ios = parseValue(localStorage.getItem("ylIOSDebug"));
        if (ios && typeof ios === "object") {
          const badge =
            "inline-block yl-badge " +
            (ios.interactionTriggered && ios.success
              ? "yl-badge--success"
              : "yl-badge--warning");
          const text = ios.interactionTriggered
            ? (ios.success
                ? "✓ triggered & success"
                : "✗ triggered but failed") +
              " (" +
              (ios.interactionType || "unknown") +
              ")"
            : "waiting for interaction";
          summary +=
            'iOS autoplay: <div class="' + badge + '">' + text + "</div>";
        }
      } catch (e) {}

      summary += "</div>";
    }

    // All localStorage keys
    const keys = Object.keys(localStorage)
      .filter((k) => k.startsWith("yl") || k.startsWith("youlag"))
      .sort();

    if (keys.length === 0) {
      body.innerHTML = summary + "Youlag: No localStorage keys found.";
      return;
    }

    const out = [];
    keys.forEach((key) => {
      let val = localStorage.getItem(key);
      let parsed = parseValue(val);
      let display =
        typeof parsed === "object"
          ? JSON.stringify(parsed, null, 2)
          : String(parsed);
      out.push(`[${key}]`);
      out.push(display);
      out.push("");
    });

    body.innerHTML = "";
    if (summary) {
      const summaryDiv = document.createElement("div");
      summaryDiv.innerHTML = summary;
      body.appendChild(summaryDiv.firstElementChild);
    }
    const pre = document.createElement("pre");
    pre.style.margin = "0";
    pre.style.padding = "0";
    pre.style.background = "none";
    pre.style.border = "none";
    pre.style.boxShadow = "none";
    pre.textContent = out.join("\n");
    body.appendChild(pre);
    const ptGreen = body.querySelector(".yl-pt-green");
    body.scrollTop = prevScroll;
  }

  render();

  if (!window.__ylLocalStorageDebugInterval) {
    window.__ylLocalStorageDebugInterval = window.setInterval(render, 1500);
  }
}

function autoOpenDebugPanels() {
  if (!isDebugEnabled()) return;
  try {
    if (localStorage.getItem("ylDebugConsoleLogsOpen") === "true")
      renderConsoleLogs();
    if (localStorage.getItem("ylDebugLocalStorageOpen") === "true")
      renderLocalStorageStates();
  } catch (e) {}
}
