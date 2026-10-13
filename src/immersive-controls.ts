import "./immersive.css";

/** Move existing controls; playback and camera ownership stay with the application. */
export function installImmersiveControls(closePanels: () => void) {
  const app = document.getElementById("app")!;
  const trigger = document.getElementById("focus")!;
  const controls = document.createElement("aside");
  controls.className = "immersive-controls";
  controls.setAttribute("aria-label", "沉浸观看控制");
  controls.innerHTML = `<button id="immersive-expand" aria-expanded="true" aria-controls="immersive-panel">收起控制</button>
    <div id="immersive-panel">
      <div id="immersive-views"></div><div id="immersive-transport"></div>
      <div class="immersive-actions">
        <button id="immersive-subtitles" aria-pressed="false">显示歌词</button>
        <button id="immersive-fullscreen">进入全屏</button>
        <button id="immersive-hide">隐藏全部 · H</button>
        <button id="immersive-exit">退出沉浸</button>
      </div>
      <p>H 隐藏／恢复控件 · 空格播放／暂停 · 1 / 2 / 3 切换视角 · Esc 退出<br>隐藏后也可单击画面恢复；暂停后切换视角可截取同一时刻。</p>
      <span id="immersive-status" role="status"></span>
    </div>`;
  app.append(controls);
  const get = (id: string) => document.getElementById(id)!;
  const parts = [".camera-switch", ".playback", ".timeline", ".volume"].map(
    (selector) => ({
      node: app.querySelector<HTMLElement>(selector)!,
      marker: document.createComment("immersive-control-home"),
    }),
  );
  let active = false;
  let enteredFullscreen = false;
  let generation = 0;
  const collapsed = (value: boolean) => {
    get("immersive-panel").hidden = value;
    get("immersive-expand").textContent = value ? "显示控制" : "收起控制";
    get("immersive-expand").setAttribute("aria-expanded", String(!value));
  };
  const clean = (value: boolean) => {
    document.body.classList.toggle("immersive-clean", value);
    if (value) (document.activeElement as HTMLElement | null)?.blur();
    else collapsed(false);
  };
  const fullscreen = async () => {
    const version = generation;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
        // A late grant must not re-enter fullscreen after the user has exited.
        if (!active || version !== generation) {
          if (document.fullscreenElement) await document.exitFullscreen();
          return;
        }
        enteredFullscreen = true;
      }
    } catch {
      if (active && version === generation)
        get("immersive-status").textContent =
          "当前浏览器未允许全屏；页面沉浸仍可使用。";
    }
  };
  const exit = () => {
    if (!active) return;
    active = false;
    generation++;
    document.body.classList.remove(
      "focus",
      "immersive-clean",
      "immersive-subtitles",
    );
    parts.forEach(({ node, marker }) => marker.replaceWith(node));
    trigger.setAttribute("aria-pressed", "false");
    trigger.focus();
    if (enteredFullscreen && document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    enteredFullscreen = false;
  };
  trigger.setAttribute("aria-pressed", "false");
  trigger.onclick = () => {
    if (active) return exit();
    active = true;
    generation++;
    closePanels();
    parts.forEach(({ node, marker }, index) => {
      node.before(marker);
      get(index === 0 ? "immersive-views" : "immersive-transport").append(node);
    });
    document.body.classList.add("focus");
    trigger.setAttribute("aria-pressed", "true");
    get("immersive-status").textContent = "";
    get("immersive-subtitles").textContent = "显示歌词";
    get("immersive-subtitles").setAttribute("aria-pressed", "false");
    collapsed(false);
    get("immersive-expand").focus();
    if (!document.fullscreenElement) void fullscreen();
  };
  get("immersive-expand").onclick = () =>
    collapsed(!get("immersive-panel").hidden);
  get("immersive-hide").onclick = () => clean(true);
  get("immersive-exit").onclick = exit;
  get("immersive-fullscreen").onclick = () => void fullscreen();
  get("immersive-subtitles").onclick = () => {
    const visible = document.body.classList.toggle("immersive-subtitles");
    get("immersive-subtitles").textContent = visible ? "隐藏歌词" : "显示歌词";
    get("immersive-subtitles").setAttribute("aria-pressed", String(visible));
  };
  document.addEventListener("fullscreenchange", () => {
    get("immersive-fullscreen").textContent = document.fullscreenElement
      ? "退出全屏"
      : "进入全屏";
    // Esc can be consumed by the browser before a keydown reaches the page.
    if (active && enteredFullscreen && !document.fullscreenElement) exit();
  });
  document.addEventListener("click", (event) => {
    if (
      active &&
      document.body.classList.contains("immersive-clean") &&
      event.target instanceof Element &&
      event.target.closest("#scene")
    )
      clean(false);
  });
  document.addEventListener("keydown", (event) => {
    if (
      !active ||
      event.repeat ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.matches(
          'textarea, select, input:not([type="range"]):not([type="checkbox"])',
        ))
    )
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      exit();
    } else if (event.key.toLowerCase() === "h") {
      event.preventDefault();
      clean(!document.body.classList.contains("immersive-clean"));
    } else if (["1", "2", "3"].includes(event.key)) {
      event.preventDefault();
      const view = ["overhead", "first", "auto"][Number(event.key) - 1];
      app.querySelector<HTMLButtonElement>(`[data-view="${view}"]`)!.click();
    } else if (
      event.code === "Space" &&
      !(target instanceof Element && target.closest("button, input"))
    ) {
      event.preventDefault();
      get("play").click();
    }
  });
}
