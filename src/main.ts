import { createBrowserStorage } from "./adapters/scoped-storage";
import { loadReviewPlan } from "./adapters/review-plan";
import "./style.css";
import { installExperienceReview } from "./experience-review";
import { installSpatialStudio } from "./spatial-studio";
import { sequenceAt, sequenceStage, sequenceNames } from "./sequences";
import type { PlayerView } from "./player-camera";
import { examplePlan } from "./review-examples";
import { weatherNames, type WeatherKind } from "./weather";
import { World } from "./world";
import { Player } from "./audio";
import { planSong, compositionAssets } from "./planner";
import {
  analyzeWindows,
  acousticFallback,
  assembleAutomatic,
  requestInterpretation,
} from "./auto-narrative";
import { audioBinding, inputKey, isStale } from "./narrative";
import { installStudio, withLibrary, saveLibrary } from "./studio";
import { installEvidenceStudio } from "./evidence-studio";
import { installBriefStudio } from "./brief-studio";
import { installCreativeStudio } from "./creative-studio";
import { momentNames } from "./design";
import {
  defaults,
  duration,
  chapterAt,
  lyricTime,
  lyricEnd,
  parseLrc,
  selectTurns,
  validatePlan,
  themeNames,
  themes,
  type Plan,
} from "./model";
const appStorage = createBrowserStorage();
const icons = {
  upload: "↥",
  settings: "☷",
  play: "▶",
  pause: "Ⅱ",
  repeat: "↺",
};
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
<main id="scene" aria-label="三维音乐视觉旅程"></main><div class="grain"></div>
<header><div class="brand"><div class="mark">♮</div><div><strong>乐梦之路</strong><small>MELODIC JOURNEY</small></div></div><nav class="modes" aria-label="预览选择"><button id="city" class="active">城市漫游</button><button id="poem">春江花月夜</button></nav><div class="header-actions"><button id="open-studio" class="ghost">✧ 旅程创作台</button><button id="open-source" class="ghost">${icons.upload} 导入音乐</button><button id="open-settings" class="ghost">${icons.settings} 旅程设置</button></div></header>
<section class="intro"><div class="eyebrow" id="eyebrow">AN EVERYDAY POEM · 001</div><h1 id="hero-title">把日常，<br>走成一首诗。</h1><p id="hero-copy">沿着树影与街灯，让风景慢慢展开。<br>一首歌的时间，去往生活的另一面。</p><span class="preview-tag" id="preview-status">视觉预览 / 尚未接入本地音频</span></section>
<div class="quick"><button id="open-lyrics" title="歌词与场景编排" aria-label="歌词与场景编排">≋</button><button id="gallery" title="构件预览" aria-label="构件预览">▧</button><button id="focus" title="沉浸模式" aria-label="沉浸模式">⛶</button></div>
<div class="chapter-indicator"><span class="chapter-number" id="chapter-number">01</span><div><small id="chapter-label">CHAPTER / 树荫街道</small><strong id="chapter-title">树影里的慢时光</strong></div></div>
<div class="compass"><canvas class="mini-map" id="map" width="212" height="128"></canvas><span>FOLLOW THE MELODY</span></div><div class="subtitle" id="subtitle"></div>
<div class="dock"><div class="dock-top"><div class="track"><div class="cover">♫</div><div><strong id="track-name">城市漫游 · 视觉预览</strong><small id="track-status">静音时间轴 · 120 秒</small></div></div><div class="playback"><button class="icon-btn" id="restart" aria-label="重播">↺</button><button class="play" id="play" aria-label="播放">▶</button></div><div class="timeline"><input class="range" type="range" id="seek" aria-label="播放进度" min="0" max="120" step="0.01" value="0"><div class="times"><span id="current-time">00:00</span><span id="duration">02:00</span></div></div><label class="volume">◖<input class="range" type="range" id="volume" aria-label="音量" min="0" max="1" step="0.01" value="0.6"></label><button class="ghost" id="open-plan">场景编排 ↗</button></div><div class="dock-bottom"><span id="footer-status">音频本地处理 · 语义服务状态见意境分析</span><div class="event-key"><span><i class="dot green"></i>连续旅程</span><span><i class="dot"></i>规则映射</span><span id="fps">正在绘制</span></div></div></div>
<aside class="panel" id="source-panel"><button class="close" aria-label="关闭">×</button><h2>让音乐出发</h2><p class="desc">加载自己的录音和歌词，编排这段旅程。<br>音频在本机解码；语义服务仅接收歌词和音乐特征。</p><button class="upload" id="pick-audio">↥ 选择本地音频<small>MP3 / WAV · 最长 60 分钟 · 最大 160 MB</small></button><input type="file" id="audio-file" accept="audio/mpeg,audio/wav,.mp3,.wav" hidden><div class="note" id="audio-note">尚未选择音频。当前是静音能力预览；上传后根据实际音乐与歌词重新规划。</div><canvas id="wave" width="580" height="98"></canvas><p class="help" id="analysis-info">能量曲线和起音候选将在加载真实音频后显示。</p><h3>播放片段 <span class="pill">整曲秒数</span></h3><div class="row"><label class="field">开始<input type="number" id="clip-start" min="0" value="0" step="0.1"></label><label class="field">结束<input type="number" id="clip-end" min="1" value="120" step="0.1"></label></div><button class="secondary full" id="apply-clip">应用片段并重建旅程</button><h3>歌词是风景的线索</h3><button class="secondary full" id="source-to-lyrics">导入歌词与编辑意象 →</button><p class="help">音乐控制能量和可筛选的转角时机；歌词导入后自动参与分时段意境分析。起音候选不代表准确拍点。</p></aside>
<aside class="panel" id="settings-panel"><button class="close" aria-label="关闭">×</button><h2>旅程的样子</h2><p class="desc">调整光线与视角，找到舒服的观看方式。</p><div id="settings-fields"></div><div class="row"><label class="field">环境色调 <input type="color" id="tone"></label><label class="field">衣服颜色 <input type="color" id="clothes"></label></div><label class="field"><span class="field-top">画质</span><select id="quality"><option value="high">高 · 柔和阴影</option><option value="low">低 · 更轻的远景</option></select></label><div class="section-rule"></div><h3>地图结构 <span class="pill">重新生成后生效</span></h3><div id="structure-fields"></div><label class="field">基础行进速度<input id="travel-speed" type="number" min="0.5" max="6" step="0.1"><span class="help">舒缓 3.2 / 标准 4.2 / 轻快 5.6</span></label><button id="apply-speed" class="secondary full">应用步速，重建路线</button><label class="field"><span class="field-top">固定随机种子</span><input type="number" id="seed" min="0" max="4294967295"></label><button class="primary full" id="regenerate">重新生成旅程</button><p class="help" id="pending">相同种子、音频事件与计划会生成相同布局。</p><div class="row"><button class="secondary" id="save">保存到本机</button><button class="secondary" id="export">导出 JSON</button></div><div class="row spacer"><button class="secondary" id="import">导入 JSON</button><button class="secondary" id="reset">恢复默认</button></div><input type="file" id="plan-file" accept="application/json,.json" hidden><p class="help">本机只保存配置。刷新后需重新选择同一音频；不会保存或上传录音。</p></aside>
<aside class="panel" id="lyrics-panel"><button class="close" aria-label="关闭">×</button><h2>歌词与意象</h2><p class="desc">导入歌词后结合音乐变化自动分析各段意境；可查看依据，再补充你的理解。</p><button class="upload" id="pick-lrc">↥ 导入 LRC 歌词<small>保留原时间戳，不把粗略时间标成精确同步</small></button><input type="file" id="lrc-file" accept=".lrc,.txt" hidden><label class="field">时间基准<select id="lyric-basis"><option value="song">整首歌时间（应用片段起点一次）</option><option value="clip">所选片段时间（从 0 开始）</option></select></label><label class="field">整体偏移 / 秒<input type="number" id="lyric-offset" min="-600" max="600" step="0.1" value="0"></label><label class="field"><input type="checkbox" id="subtitles" checked> 显示当前歌词</label><textarea id="lyric-text" class="textarea" placeholder="粘贴纯文本歌词，每个空行分隔一段。&#10;生成的初始时间是粗略分配，可在下方修改。"></textarea><button class="secondary full spacer" id="apply-text">建立粗略段落时间</button><div id="lyric-rows"></div><button class="primary full spacer" id="map-lyrics">重新分析意境</button><p class="help" id="lyric-info">未导入歌词；当前仅分析可测量的音乐变化。</p></aside>
<aside class="panel" id="plan-panel"><button class="close" aria-label="关闭">×</button><h2>沿途的章节</h2><p class="desc">一个连续空间，几段不同的心情。<br>修改开始秒数和主题即可人工覆盖规则结果。</p><div id="chapter-rows"></div><button class="primary full spacer" id="apply-chapters">应用章节编排</button><h3>音乐事件与转角</h3><p class="help" id="events-info">预览转角来自配置，不代表音乐节拍。</p><label class="field"><span class="field-top">事件强度阈值 <output id="threshold-value"></output></span><input class="range" type="range" id="threshold" min="0" max="1" step="0.01"></label><label class="field"><span class="field-top">最小转弯间隔 / 秒</span><input type="number" id="interval" min="5" max="60" step="1"></label><button class="secondary full" id="use-events">从音乐事件筛选转角</button><label class="field">人工转角时刻 / 片段秒数<textarea id="turns" class="textarea" style="min-height:65px" placeholder="15, 30, 45…"></textarea></label><button class="secondary full" id="apply-turns">应用人工转角</button><p class="help">转角只改变方向，不改变速度。灯光和镜头随平滑能量轻微变化。没有可靠事件时保持直行。</p></aside><div id="toast" role="status"></div>`;
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const evaluationId = new URLSearchParams(location.search).get("evaluation");
const planStorageKey = evaluationId
  ? "melodic-journey:evaluation"
  : new URLSearchParams(location.search).has("example")
    ? "melodic-journey:review-example"
    : "melodic-journey";
let plan = withLibrary(defaults());
let restored = false;
try {
  const saved = appStorage.getItem(planStorageKey);
  if (saved) {
    if (!appStorage.getItem("melodic-journey:before-v1"))
      appStorage.setItem("melodic-journey:before-v1", saved);
    plan = validatePlan(JSON.parse(saved));
    restored = true;
  }
} catch {
  // Preserve unreadable configuration for recovery; use defaults in memory.
}
const player = new Player();
const reviewExample = new URLSearchParams(location.search).get("example");
if (reviewExample) {
  plan = examplePlan(reviewExample);
  restored = false;
}
player.setClip(plan.audio.clipStart, plan.audio.clipEnd);
const world = new World($("scene"));
let startupSpatialFallback = false;
try {
  world.build(plan);
} catch {
  const rejected = world.lastRejected;
  plan = defaults(plan.mode);
  world.build(plan);
  world.lastRejected = rejected;
  player.setClip(plan.audio.clipStart, plan.audio.clipEnd);
  restored = false;
  startupSpatialFallback = true;
}
const cameraControls = document.createElement("div");
cameraControls.className = "camera-switch";
cameraControls.innerHTML =
  '<span>观看方式</span><button data-view="overhead">俯视旅程</button><button data-view="first">第一人称</button><button data-view="auto" title="使用分析中的自动机位">自动导演</button>';
document.getElementById("app")!.append(cameraControls);
const sequenceCaption = document.createElement("div");
sequenceCaption.className = "sequence-caption";
sequenceCaption.setAttribute("aria-live", "polite");
document.getElementById("app")!.append(sequenceCaption);
const chooseView = (view: PlayerView) => {
  world.playerView = view;
  appStorage.setItem("journey-view", view);
  cameraControls
    .querySelectorAll("button")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  document.body.classList.toggle("first-view", view === "first");
  world.update(player.time, player.energy, true);
};
cameraControls
  .querySelectorAll<HTMLButtonElement>("button")
  .forEach((b) => (b.onclick = () => chooseView(b.dataset.view as PlayerView)));
const savedView = appStorage.getItem("journey-view");
chooseView(
  ["first", "auto"].includes(savedView ?? "")
    ? (savedView as PlayerView)
    : "overhead",
);
const compareControl = document.createElement("label");
compareControl.className = "field";
compareControl.innerHTML =
  '<span><input type="checkbox" id="compare-views"> 开发审阅：同一时刻双视角对照</span>';
document.querySelector("#settings-panel h2")!.after(compareControl);
$("compare-views").onchange = () => {
  world.compareViews = $<HTMLInputElement>("compare-views").checked;
  document.body.classList.toggle("compare-views", world.compareViews);
};
const weatherControl = document.createElement("label");
weatherControl.className = "field";
weatherControl.innerHTML = `天气预览<select id="weather-preview"><option value="auto">跟随歌曲分析</option>${Object.entries(
  weatherNames,
)
  .map(([id, name]) => `<option value="${id}">${name}</option>`)
  .join(
    "",
  )}</select><span class="help">临时预览，不修改歌词分析。<a href="./help.html" target="_blank">MVP 使用说明 ↗</a></span>`;
document.querySelector("#settings-panel h2")!.after(weatherControl);
$("weather-preview").onchange = () => {
  const value = $<HTMLSelectElement>("weather-preview").value;
  world.weatherOverride = value === "auto" ? undefined : (value as WeatherKind);
};
let showSubtitles = true,
  gallery = false,
  toastTimer = 0;
let pending: Partial<Plan["visual"]> = {};
let studioRefresh = () => {};
let evidenceRefresh = () => {};
let briefRefresh = () => {};
let experienceRefresh = () => {};
let spatialRefresh = () => {};
function toast(s: string) {
  $("toast").textContent = s;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(
    () => $("toast").classList.remove("show"),
    5000,
  );
}
function panel(name: string) {
  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.toggle("open", p.id === name + "-panel"));
}
function timeLabel(t: number) {
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(t % 60)
    .toString()
    .padStart(2, "0")}`;
}
function rebuild() {
  const time = player.time;
  const wasPlaying = player.playing;
  try {
    world.build(plan, gallery);
  } catch (error) {
    plan = structuredClone(world.plan);
    gallery = world.gallery;
    document.body.classList.toggle("gallery", gallery);
    const mismatchedAudio =
      player.loaded && player.fingerprint !== plan.audio.fingerprint;
    if (mismatchedAudio) player.stopFile();
    player.setClip(plan.audio.clipStart, plan.audio.clipEnd);
    player.seek(time);
    if (wasPlaying && !mismatchedAudio)
      void player.play().catch(() => toast("场景已保留；请点击播放继续。"));
    refresh();
    drawMap();
    toast(`新场景未应用，已保留上一有效版本：${(error as Error).message}`);
    return false;
  }
  world.update(time, player.energy, true);
  refresh();
  drawMap();
  return true;
}
let analysisGeneration = 0;
let analysisAbort: AbortController | undefined;
let automaticUndo: Plan | undefined;
let analysisDebounce: ReturnType<typeof setTimeout> | undefined;
function scheduleAutomatic() {
  clearTimeout(analysisDebounce);
  analysisAbort?.abort();
  creativeStudio.cancel();
  analysisDebounce = setTimeout(() => void runAutomatic(), 700);
}
function analysisStatus(text: string) {
  const status = document.getElementById("auto-status");
  if (status) status.textContent = text;
}
async function runAutomatic(correctionOnly = false) {
  clearTimeout(analysisDebounce);
  const generation = ++analysisGeneration;
  analysisAbort?.abort();
  creativeStudio.cancel();
  analysisAbort = new AbortController();
  const signal = analysisAbort.signal,
    source = structuredClone(withLibrary(plan));
  const correction =
    source.narrative?.automatic?.correction || source.direction.keywords;
  automaticUndo = structuredClone(plan);
  try {
    if (correctionOnly && source.narrative?.provider !== "semantic-model")
      throw Error(
        "尚无语义模型基线，请先完成自动意境分析；文字修正不会伪装为自动理解。",
      );
    if (correctionOnly && isStale(source))
      throw Error("歌词、片段或输入已变化，请先重新自动分析，再应用补充。");
    if (
      correctionOnly &&
      JSON.stringify(
        source.narrative!.segments.map((s) => [s.start, s.end]),
      ) !==
        JSON.stringify(
          source.narrative!.automatic!.windows.map((w) => [w.start, w.end]),
        )
    )
      throw Error(
        "人工分段边界已改变，请先重新分析以保留锁定边界，再应用文字补充。",
      );
    const windows = analyzeWindows(source, player.analysis);
    if (
      !correctionOnly &&
      !(
        source.narrative?.provider === "semantic-model" &&
        source.narrative.binding === audioBinding(source)
      )
    ) {
      const fallback = acousticFallback(source, windows);
      plan = validatePlan(
        assembleAutomatic(
          source,
          windows,
          fallback,
          "acoustic-fallback",
          "语义模型正在分析；先展示声学预编排。",
        ),
      );
      if (!rebuild())
        throw Error("声学预编排未通过场景通行检查，已保留上一版本。");
    }
    const revision = JSON.stringify(plan);
    analysisStatus(
      correctionOnly
        ? "正在理解你的局部修正…"
        : "正在结合整曲上下文与各时段歌词、音乐证据分析意境…",
    );
    const baseline = correctionOnly
      ? source.narrative!.automatic!.baseline
      : undefined;
    const auto = await requestInterpretation(
      source,
      player.analysis,
      signal,
      correctionOnly ? correction : "",
      baseline,
    );
    let result = auto.result;
    if (!correctionOnly && correction.trim())
      result = (
        await requestInterpretation(
          source,
          player.analysis,
          signal,
          correction,
          auto.result,
          auto.windows,
        )
      ).result;
    if (
      signal.aborted ||
      generation !== analysisGeneration ||
      revision !== JSON.stringify(plan)
    )
      return analysisStatus(
        "输入或人工决定已变化，旧分析结果已丢弃，请重新分析。",
      );
    plan = validatePlan(
      assembleAutomatic(
        source,
        auto.windows,
        result,
        "semantic-model",
        "模型根据歌词和声学摘要解释意境，尚未直接聆听原始音频；请试听核对。",
        baseline ?? auto.result,
      ),
    );
    plan.narrative!.automatic!.correction = correction;
    if (!rebuild()) throw Error("自动编排未通过场景通行检查，已保留上一版本。");
    saveLibrary(plan);
    analysisStatus(
      "自动意境分析已应用 · 可逐段查看依据；氛围、光影和机位沿同一时间线演进。",
    );
    await creativeStudio.generate();
  } catch (error) {
    if (signal.aborted || generation !== analysisGeneration) return;
    const message = (error as Error).message;
    if (
      !correctionOnly &&
      inputKey(plan) === inputKey(source) &&
      plan.narrative?.provider === "acoustic-fallback"
    ) {
      plan.narrative.automatic!.warning = message;
      plan.analysis.warnings[0] = message;
      evidenceRefresh();
      briefRefresh();
    }
    analysisStatus(message);
  }
}
function undoAutomatic() {
  analysisGeneration++;
  analysisAbort?.abort();
  if (!automaticUndo || audioBinding(automaticUndo) !== audioBinding(plan))
    return toast("当前录音或片段已改变，没有适用的自动编排撤回版本。");
  plan = automaticUndo;
  if (!rebuild()) return;
  automaticUndo = undefined;
  analysisStatus("已恢复自动编排前的计划。");
}
function refresh() {
  $("city").classList.toggle(
    "active",
    !plan.creativeWorld && plan.mode === "city",
  );
  $("poem").classList.toggle(
    "active",
    !plan.creativeWorld && plan.mode === "poem",
  );
  $("city").textContent = plan.creativeWorld ? "城市样例" : "城市漫游";
  $("poem").textContent = plan.creativeWorld ? "诗意样例" : "春江花月夜";
  $("hero-title").innerHTML = gallery
    ? "每个构件，<br>都有自己的故事。"
    : plan.mode === "city"
      ? "把日常，<br>走成一首诗。"
      : "江月相照，<br>花影随行。";
  $("eyebrow").textContent = gallery
    ? "THE OBJECT LIBRARY"
    : plan.mode === "city"
      ? "AN EVERYDAY POEM · 001"
      : "A MOONLIT REVERIE · 002";
  $("hero-copy").innerHTML = gallery
    ? "可扩充的几何配方，共用尺度与材质。<br>在旅程创作台选择构件，单独查看。"
    : plan.mode === "city"
      ? "沿着树影与街灯，让风景慢慢展开。<br>一首歌的时间，去往生活的另一面。"
      : "月亮落在江面，花树依偎岸线。<br>以主题为线索的诗意空间验证。";
  $("preview-status").textContent =
    plan.mode === "poem"
      ? "诗意视觉验证 / 不与录音同步"
      : player.loaded
        ? "本地录音已接入 / 歌词编排可调整"
        : "视觉预览 / 尚未接入本地音频";
  $("track-name").textContent = player.loaded
    ? plan.audio.name
    : plan.mode === "city"
      ? "城市漫游 · 视觉预览"
      : "春江花月夜 · 意象预览";
  $("track-status").textContent = player.loaded
    ? "本地音频 · 起音与能量驱动"
    : `静音时间轴 · ${Math.round(duration(plan))} 秒`;
  if (!player.loaded && reviewExample)
    $("track-name").textContent =
      "人工能力样段 · " +
      ({
        rain: "分段天气",
        bridge: "江畔樱树",
        tavern: "暖灯酒馆",
        combined: "酒馆与江畔金桂",
        ridge: "山峦破晓",
        neon: "霓虹天际",
        street: "路尾一灯",
      }[reviewExample] ?? "视觉预览");
  if (!player.loaded && evaluationId)
    $("track-name").textContent = "模型实测回放 · 原创测试文本";
  if (!gallery && plan.analysis.method === "local-rules") {
    $("hero-title").innerHTML = "让意境，<br>长出风景。";
    $("eyebrow").textContent = "COMPOSED FROM YOUR INPUTS";
    $("hero-copy").innerHTML =
      "构件、光线与镜头，由当前输入编排。<br>在创作台查看依据，继续调整这段旅程。";
    if (!player.loaded) $("track-name").textContent = "自定义旅程 · 意象预览";
  }
  if (!gallery && plan.creativeWorld) {
    const title = plan.creativeWorld.title ?? "这首歌的旅程";
    $("hero-title").textContent = title;
    $("eyebrow").textContent = "A JOURNEY FROM YOUR SONG";
    $("hero-copy").textContent =
      `${plan.creativeWorld.name ?? "逐曲设计"} · 跟随音乐前行，在值得停留的地方慢下来。`;
    if (!player.loaded) $("track-name").textContent = `${title} · 静音画面预览`;
  }
  $<HTMLInputElement>("seek").max = String(duration(plan));
  $("duration").textContent = timeLabel(duration(plan));
  $<HTMLInputElement>("clip-start").value = String(plan.audio.clipStart);
  $<HTMLInputElement>("clip-end").value = String(plan.audio.clipEnd);
  for (const key of ["tone", "clothes", "quality"] as const)
    $<HTMLInputElement>(key).value = plan.visual[key];
  $<HTMLInputElement>("seed").value = String(plan.seed);
  $<HTMLInputElement>("lyric-offset").value = String(plan.lyrics.offset);
  $<HTMLSelectElement>("lyric-basis").value = plan.lyrics.basis;
  $<HTMLInputElement>("threshold").value = String(plan.path.threshold);
  $("threshold-value").textContent = plan.path.threshold.toFixed(2);
  $<HTMLInputElement>("interval").value = String(plan.path.minInterval);
  $<HTMLTextAreaElement>("turns").value = plan.path.turnTimes
    .map((x) => Number(x.toFixed(2)))
    .join(", ");
  $("events-info").textContent =
    `${plan.events.length} 个起音候选 · ${plan.path.turnTimes.length} 个转角。${plan.events.length ? "起音为能量突增近似检测，可手工覆盖。" : "当前是人工配置的预览时刻。"}`;
  settings();
  chapterRows();
  lyricRows();
  studioRefresh();
  evidenceRefresh();
  experienceRefresh();
  briefRefresh();
  spatialRefresh();
  $<HTMLInputElement>("travel-speed").value = String(plan.path.speed);
}
function range(
  key: keyof Plan["visual"],
  label: string,
  min: number,
  max: number,
  step: number,
  struct = false,
) {
  const value = Number(pending[key] ?? plan.visual[key]);
  return `<label class="field"><span class="field-top">${label}<output id="out-${key}">${value}</output></span><input class="range" data-key="${key}" data-struct="${struct}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
}
function settings() {
  $("settings-fields").innerHTML =
    range("distance", "镜头距离", 15, 45, 1) +
    range("height", "镜头高度", 12, 40, 1) +
    range("smoothing", "自动镜头转向缓和", 0, 0.98, 0.01) +
    range("ambient", "环境亮度", 0.5, 3, 0.1) +
    range("particles", "漂浮物强度", 0, 1, 0.05) +
    range("moonHeight", "月亮高度", 8, 35, 1) +
    range("moonSize", "月亮大小", 1, 6, 0.2);
  $("settings-fields").innerHTML += range(
    "observerScale",
    "观察者比例",
    0.65,
    1.1,
    0.05,
    true,
  );
  $("structure-fields").innerHTML =
    range("density", "沿途构件密度", 0.3, 1.5, 0.1, true) +
    range("roadWidth", "道路宽度", 3, 7, 0.1, true);
  document.querySelectorAll<HTMLInputElement>("[data-key]").forEach(
    (el) =>
      (el.oninput = () => {
        const key = el.dataset.key as "density";
        const v = Number(el.value);
        $("out-" + key).textContent = el.value;
        if (el.dataset.struct === "true") {
          pending[key] = v;
          $("pending").textContent = "地图参数已修改，点击「重新生成」生效。";
          $("pending").classList.add("pending");
        } else {
          plan.visual[key] = v;
          world.plan.visual[key] = v;
        }
      }),
  );
}
function chapterRows() {
  const container = $("chapter-rows");
  container.replaceChildren();
  plan.chapters.forEach((c, i) => {
    const row = document.createElement("div");
    row.className = "chapter-row";
    const time = document.createElement("input");
    time.type = "number";
    time.value = String(Number(c.start.toFixed(2)));
    time.min = "0";
    time.step = ".1";
    time.setAttribute("aria-label", `章节 ${i + 1} 开始秒数`);
    time.dataset.chapterTime = String(i);
    const select = document.createElement("select");
    select.dataset.chapterTheme = String(i);
    for (const t of themes) {
      const option = new Option(themeNames[t], t, t === c.theme, t === c.theme);
      select.add(option);
    }
    const small = document.createElement("small");
    small.textContent = `${c.title} · ${c.source === "rule" ? "规则映射，需核对" : c.source === "manual" ? "人工编排" : "视觉预览"}`;
    row.append(time, select, small);
    const field = (label: string, node: HTMLElement) => {
      const wrapper = document.createElement("label");
      wrapper.className = "chapter-field";
      const caption = document.createElement("span");
      caption.textContent = label;
      wrapper.append(caption, node);
      row.append(wrapper);
    };
    const atmosphere = document.createElement("select");
    atmosphere.dataset.chapterAtmosphere = String(i);
    for (const a of plan.atmospheres)
      atmosphere.add(
        new Option(a.name, a.id, a.id === c.atmosphere, a.id === c.atmosphere),
      );
    field("氛围", atmosphere);
    const moment = document.createElement("select");
    moment.dataset.chapterMoment = String(i);
    for (const [k, name] of Object.entries(momentNames))
      moment.add(
        new Option(name, k, k === c.moment?.kind, k === c.moment?.kind),
      );
    field("重点镜头", moment);
    const seconds = document.createElement("input");
    seconds.type = "number";
    seconds.min = "3";
    seconds.max = "30";
    seconds.step = "1";
    seconds.value = String(c.moment?.duration ?? 12);
    seconds.dataset.chapterDuration = String(i);
    field("镜头秒数", seconds);
    const pace = document.createElement("input");
    pace.type = "number";
    pace.min = ".65";
    pace.max = "1.35";
    pace.step = ".05";
    pace.value = String(Number((c.pace ?? 1).toFixed(2)));
    pace.dataset.chapterPace = String(i);
    field("步速倍率", pace);
    const preview = document.createElement("button");
    preview.className = "secondary";
    preview.textContent = "跳到此段";
    preview.onclick = () => {
      player.seek(
        c.start +
          (c.moment?.kind !== "none" ? (c.moment?.duration ?? 12) / 2 : 0),
      );
      world.update(player.time, player.energy, true);
    };
    row.append(preview);
    container.append(row);
  });
}
function lyricRows() {
  const container = $("lyric-rows");
  container.replaceChildren();
  for (const [i, l] of plan.lyrics.lines.entries()) {
    if (i >= 100) {
      const note = document.createElement("p");
      note.className = "help";
      note.textContent = "面板显示前 100 段；完整歌词可在导出的 JSON 中编辑。";
      container.append(note);
      break;
    }
    const row = document.createElement("div");
    row.className = "lyric-row";
    for (const key of ["start", "end", "text"] as const) {
      const input = document.createElement("input");
      input.type = key === "text" ? "text" : "number";
      input.value = String(l[key]);
      input.title =
        key === "start" ? "开始秒数" : key === "end" ? "结束秒数" : "歌词文本";
      input.onchange = () => {
        const draft = structuredClone(plan);
        if (key === "text") draft.lyrics.lines[i][key] = input.value;
        else draft.lyrics.lines[i][key] = Number(input.value);
        try {
          plan = validatePlan(draft);
          world.plan = plan;
          scheduleAutomatic();
        } catch (e) {
          toast((e as Error).message);
          input.value = String(l[key]);
        }
      };
      row.append(input);
    }
    container.append(row);
  }
  $("lyric-info").textContent =
    plan.lyrics.source === "none"
      ? "未导入歌词；不会自动补写《成都》歌词。"
      : `${plan.lyrics.lines.length} 段 · ${plan.lyrics.source === "lrc" ? "LRC 时间戳，仍需按录音核对" : "粗略分段，非精确同步"} · ${plan.lyrics.basis === "song" ? "整曲" : "片段"}基准`;
}
function drawMap() {
  const c = $<HTMLCanvasElement>("map"),
    ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, c.width, c.height);
  const pts = world.path.flatMap((s) => [s.a, s.b]);
  const xs = pts.map((p) => p.x),
    zs = pts.map((p) => p.z);
  const minX = Math.min(...xs),
    minZ = Math.min(...zs),
    maxX = Math.max(...xs),
    maxZ = Math.max(...zs),
    scale = Math.min(160 / (maxX - minX || 1), 105 / (maxZ - minZ || 1));
  ctx.strokeStyle = "#53786a";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = 26 + (p.x - minX) * scale,
      y = 10 + (p.z - minZ) * scale;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  if (world.hero) {
    ctx.fillStyle = "#d0925f";
    ctx.beginPath();
    ctx.arc(
      26 + (world.hero.position.x - minX) * scale,
      10 + (world.hero.position.z - minZ) * scale,
      5,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}
function drawWave() {
  const c = $<HTMLCanvasElement>("wave"),
    ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, c.width, c.height);
  const values = player.analysis.energy;
  ctx.fillStyle = "#698b73";
  for (let x = 0; x < c.width; x += 3) {
    const v = values[Math.floor((x / c.width) * values.length)] ?? 0;
    ctx.fillRect(x, 48 - v * 39, 2, Math.max(2, v * 78));
  }
  ctx.fillStyle = "#ba8b58";
  for (const e of plan.events) {
    const x = (e.time / plan.audio.duration) * c.width;
    ctx.fillRect(x, 2, 1, 8 + e.strength * 15);
  }
}
document
  .querySelectorAll<HTMLButtonElement>(".close")
  .forEach((b) => (b.onclick = () => panel("none")));
for (const [button, name] of [
  ["open-source", "source"],
  ["open-settings", "settings"],
  ["open-lyrics", "lyrics"],
  ["open-plan", "plan"],
  ["source-to-lyrics", "lyrics"],
])
  $(button).onclick = () => panel(name);
$("play").onclick = async () => {
  try {
    if (player.playing) player.pause();
    else await player.play();
  } catch (e) {
    toast("播放失败：" + (e as Error).message);
  }
};
$("restart").onclick = () => {
  player.seek(0);
  world.update(0, player.energy, true);
};
$<HTMLInputElement>("seek").oninput = (e) => {
  player.seek(Number((e.target as HTMLInputElement).value));
  world.update(player.time, player.energy, true);
};
$<HTMLInputElement>("volume").oninput = (e) =>
  (player.audio.volume = Number((e.target as HTMLInputElement).value));
$("focus").onclick = () => {
  document.body.classList.toggle("focus");
  panel("none");
};
$("gallery").onclick = () => {
  gallery = !gallery;
  world.galleryId = "";
  player.pause();
  document.body.classList.toggle("gallery", gallery);
  if (!rebuild()) return;
  toast(gallery ? "构件预览 · 再次点击构件按钮返回旅程" : "已返回旅程");
};
for (const mode of ["city", "poem"] as const)
  $(mode).onclick = () => {
    player.stopFile();
    plan = withLibrary(defaults(mode));
    pending = {};
    gallery = false;
    document.body.classList.remove("gallery");
    player.setClip(0, 120);
    rebuild();
    drawWave();
    $("audio-note").textContent =
      "独立静音视觉预览；导入本地音频后可按录音重新编排。";
    void player.play();
  };
$("pick-audio").onclick = () => $<HTMLInputElement>("audio-file").click();
$<HTMLInputElement>("audio-file").onchange = async (e) => {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  const old = structuredClone(plan);
  try {
    const info = await player.load(file, (s) => {
      $("audio-note").textContent = s;
      $("track-status").textContent = s;
    });
    if (
      old.audio.fingerprint === info.fingerprint &&
      Math.abs(old.audio.duration - info.duration) < 0.1
    ) {
      plan = old;
      player.setClip(plan.audio.clipStart, plan.audio.clipEnd);
      toast("已重新关联同一音频，保留章节、歌词与转角。");
    } else {
      const ratio = info.duration / duration(plan);
      plan.audio = {
        duration: info.duration,
        clipStart: 0,
        clipEnd: info.duration,
        name: file.name,
        fingerprint: info.fingerprint,
      };
      plan.chapters = plan.chapters.map((c) => ({
        ...c,
        start: c.start * ratio,
      }));
      plan.lyrics = { basis: "song", offset: 0, source: "none", lines: [] };
      plan.events = player.analysis.events;
      plan.path.turnTimes = selectTurns(plan.events, plan);
      delete plan.narrative;
      await runAutomatic();
      if (world.lastRejected)
        throw Error(
          "录音已分析，但场景未通过通行检查；未应用候选已保留在开发检查中。",
        );
    }
    if (!rebuild()) throw Error("场景未通过通行检查，已保留上一有效版本。");
    drawWave();
    $("analysis-info").textContent =
      `已提取 ${player.analysis.energy.length} 个平滑能量采样和 ${player.analysis.events.length} 个起音候选。非拍点或主旋律识别。`;
    toast("音频加载完成，点击播放开始。");
  } catch (e) {
    toast((e as Error).message);
    $("audio-note").textContent = world.lastRejected
      ? "场景未应用；开发检查中可导出候选。重新选择录音后可继续。"
      : "加载未完成，请选择可解码的 MP3 或 WAV。";
    refresh();
  }
  input.value = "";
};
$("apply-clip").onclick = () => {
  const start = Number($<HTMLInputElement>("clip-start").value),
    end = Number($<HTMLInputElement>("clip-end").value);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end > plan.audio.duration ||
    end - start < 1
  ) {
    toast("片段范围须在音频内，且至少为 1 秒");
    return;
  }
  const ratio = (end - start) / duration(plan);
  plan.chapters = plan.chapters.map((c) => ({ ...c, start: c.start * ratio }));
  plan.analysis.sections = [];
  plan.analysis.warnings = ["播放片段已改变，请在创作台重新分析以更新依据。"];
  plan.audio.clipStart = start;
  plan.audio.clipEnd = end;
  plan.path.turnTimes = plan.events.length
    ? selectTurns(plan.events, plan)
    : plan.path.turnTimes
        .map((t) => t * ratio)
        .filter(
          (t, i, a) =>
            t >= 5 && t < end - start - 1 && (i === 0 || t - a[i - 1] >= 5),
        );
  if (plan.lyrics.basis === "clip")
    plan.lyrics.lines = plan.lyrics.lines
      .filter((l) => l.start < end - start)
      .map((l) => ({ ...l, end: Math.min(l.end, end - start) }));
  player.setClip(start, end);
  if (!rebuild()) return;
  void runAutomatic();
  toast("片段已应用，正在重新分析所选时间段。");
};
for (const key of ["tone", "clothes"] as const)
  $<HTMLInputElement>(key).oninput = (e) => {
    plan.visual[key] = (e.target as HTMLInputElement).value;
    if (key === "clothes") rebuild();
    else world.plan.visual[key] = plan.visual[key];
  };
$<HTMLSelectElement>("quality").onchange = (e) => {
  plan.visual.quality = (e.target as HTMLSelectElement).value as "high" | "low";
  rebuild();
};
$("regenerate").onclick = () => {
  const seed = Number($<HTMLInputElement>("seed").value);
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) {
    toast("种子应为 0 至 4294967295 的整数");
    return;
  }
  Object.assign(plan.visual, pending);
  plan.seed = seed;
  pending = {};
  if (!rebuild()) return;
  $("pending").textContent = "地图已重新生成。音频分析缓存保持不变。";
  $("pending").classList.remove("pending");
  toast("旅程已重新生成");
};
$("save").onclick = () => {
  try {
    appStorage.setItem(planStorageKey, JSON.stringify(validatePlan(plan)));
    toast("配置已保存。刷新后请重新选择同一音频。");
  } catch (e) {
    toast("保存失败：" + (e as Error).message);
  }
};
$("export").onclick = () => {
  try {
    const data = validatePlan(plan),
      url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
    const a = document.createElement("a");
    a.href = url;
    a.download = `journey-${plan.mode}-${plan.seed}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("场景计划已导出（不包含音频）");
  } catch (e) {
    toast((e as Error).message);
  }
};
$("import").onclick = () => $<HTMLInputElement>("plan-file").click();
$<HTMLInputElement>("plan-file").onchange = async (e) => {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw Error("配置文件不得超过 2 MB");
    const next = validatePlan(JSON.parse(await file.text()));
    const previousFingerprint = plan.audio.fingerprint;
    plan = next;
    pending = {};
    if (!rebuild()) throw Error("场景通行检查未通过，上一有效计划已保留。");
    if (next.audio.fingerprint !== previousFingerprint) player.stopFile();
    player.setClip(plan.audio.clipStart, plan.audio.clipEnd);
    drawWave();
    toast(
      player.loaded
        ? "场景计划已还原"
        : "计划已还原；如需音乐，请重新选择对应本地录音。",
    );
  } catch (e) {
    toast("导入失败：" + (e as Error).message);
  }
  input.value = "";
};
$("reset").onclick = () => {
  player.stopFile();
  plan = withLibrary(defaults(plan.mode));
  pending = {};
  player.setClip(0, 120);
  appStorage.removeItem(planStorageKey);
  rebuild();
  drawWave();
  toast("已恢复当前预览的默认配置");
};
$("pick-lrc").onclick = () => $<HTMLInputElement>("lrc-file").click();
$<HTMLInputElement>("lrc-file").onchange = async (e) => {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw Error("歌词文件不得超过 1 MB");
    const lines = parseLrc(
      await file.text(),
      plan.lyrics.basis === "song" ? plan.audio.duration : duration(plan),
    );
    if (!lines.length) throw Error("未找到有效 LRC 时间戳，请使用纯文本入口");
    plan.lyrics.source = "lrc";
    plan.lyrics.lines = lines;
    lyricRows();
    void runAutomatic();
    toast("歌词已加载，正在自动更新分段意境。");
  } catch (e) {
    toast((e as Error).message);
  }
  input.value = "";
};
$<HTMLSelectElement>("lyric-basis").onchange = (e) => {
  const basis = (e.target as HTMLSelectElement).value as "song" | "clip";
  const draft = structuredClone(plan);
  draft.lyrics.basis = basis;
  try {
    plan = validatePlan(draft);
    world.plan = plan;
    lyricRows();
    scheduleAutomatic();
  } catch {
    toast("现有歌词超出新时间基准范围，请先调整段落时间");
    $<HTMLSelectElement>("lyric-basis").value = plan.lyrics.basis;
  }
};
$<HTMLInputElement>("lyric-offset").onchange = (e) => {
  const n = Number((e.target as HTMLInputElement).value);
  if (Number.isFinite(n) && Math.abs(n) <= 600) {
    plan.lyrics.offset = n;
    scheduleAutomatic();
  } else toast("偏移范围为 -600 至 600 秒");
};
$<HTMLInputElement>("subtitles").onchange = (e) =>
  (showSubtitles = (e.target as HTMLInputElement).checked);
$("apply-text").onclick = () => {
  const blocks = $<HTMLTextAreaElement>("lyric-text")
    .value.trim()
    .split(/\n\s*\n/)
    .filter(Boolean);
  if (!blocks.length) return toast("请先粘贴歌词文本");
  if (blocks.length > 100 || blocks.some((t) => t.length > 500))
    return toast("最多 100 段，每段最多 500 字");
  const d = duration(plan),
    base = plan.lyrics.basis === "song" ? plan.audio.clipStart : 0;
  plan.lyrics.source = "approximate";
  plan.lyrics.lines = blocks.map((text, i) => ({
    start: base + (i * d) / blocks.length,
    end: base + ((i + 1) * d) / blocks.length,
    text,
  }));
  lyricRows();
  void runAutomatic();
  toast("已建立粗略时间并开始自动分析；请按录音校正歌词时序。");
};
$("map-lyrics").onclick = () => {
  void runAutomatic();
};
$("apply-chapters").onclick = () => {
  try {
    const next = structuredClone(plan);
    next.chapters = next.chapters.map((c, i) => {
      const theme = (
        document.querySelector(
          `[data-chapter-theme="${i}"]`,
        ) as HTMLSelectElement
      ).value as typeof c.theme;
      return {
        ...c,
        start: Number(
          (
            document.querySelector(
              `[data-chapter-time="${i}"]`,
            ) as HTMLInputElement
          ).value,
        ),
        theme,
        assets: theme === c.theme ? c.assets : compositionAssets[theme],
        atmosphere: (
          document.querySelector(
            `[data-chapter-atmosphere="${i}"]`,
          ) as HTMLSelectElement
        ).value,
        pace: Number(
          (
            document.querySelector(
              `[data-chapter-pace="${i}"]`,
            ) as HTMLInputElement
          ).value,
        ),
        moment: {
          kind: (
            document.querySelector(
              `[data-chapter-moment="${i}"]`,
            ) as HTMLSelectElement
          ).value as "none",
          duration: Number(
            (
              document.querySelector(
                `[data-chapter-duration="${i}"]`,
              ) as HTMLInputElement
            ).value,
          ),
          strength: c.moment?.strength ?? 0.75,
        },
        evidence: [...(c.evidence ?? []).slice(-18), "用户已人工覆盖本章节"],
        title: themeNames[theme],
        source: "manual" as const,
      };
    });
    plan = validatePlan(next);
    if (!rebuild()) return;
    toast("人工章节编排已生效");
  } catch (e) {
    toast((e as Error).message);
  }
};
$<HTMLInputElement>("threshold").oninput = (e) => {
  plan.path.threshold = Number((e.target as HTMLInputElement).value);
  $("threshold-value").textContent = plan.path.threshold.toFixed(2);
};
$("use-events").onclick = () => {
  const n = Number($<HTMLInputElement>("interval").value);
  if (!Number.isFinite(n) || n < 5 || n > 60)
    return toast("最小间隔为 5 至 60 秒");
  if (!plan.events.length)
    return toast("请先加载真实音频；或直接编辑人工转角。");
  plan.path.minInterval = n;
  plan.path.turnTimes = selectTurns(plan.events, plan);
  if (!rebuild()) return;
  toast(
    `已筛选 ${plan.path.turnTimes.length} 个转角；未达到阈值的时段平稳直行。`,
  );
};
$("apply-turns").onclick = () => {
  try {
    const draft = structuredClone(plan);
    draft.path.turnTimes = $<HTMLTextAreaElement>("turns").value.trim()
      ? $<HTMLTextAreaElement>("turns")
          .value.split(/[,，\s]+/)
          .filter(Boolean)
          .map(Number)
      : [];
    plan = validatePlan(draft);
    if (!rebuild()) return;
    toast("人工转角已应用");
  } catch (e) {
    toast((e as Error).message);
  }
};
let lastUi = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  player.tick();
  world.update(player.time, player.energy);
  if (now - lastUi < 120) return;
  lastUi = now;
  const moment = sequenceAt(plan, player.time);
  document.body.classList.toggle("sequence-active", Boolean(moment));
  const caption = moment
    ? (moment.composition?.title ?? sequenceNames[moment.kind]) +
      " · " +
      sequenceStage(moment, player.time)
    : "";
  if (sequenceCaption.textContent !== caption)
    sequenceCaption.textContent = caption;
  document.body.classList.toggle("journey-started", player.time > 8);
  if (moment)
    $("preview-status").textContent =
      (moment.composition?.title ?? sequenceNames[moment.kind]) +
      " · " +
      sequenceStage(moment, player.time);
  const t = player.time,
    c = chapterAt(plan, t);
  document.body.classList.toggle(
    "night-ui",
    !gallery &&
      (plan.atmospheres.find((a) => a.id === c.atmosphere)?.night ?? 0) > 0.6,
  );
  $<HTMLInputElement>("seek").value = String(t);
  $("current-time").textContent = timeLabel(t);
  $("play").textContent = player.playing ? icons.pause : icons.play;
  $("play").setAttribute("aria-label", player.playing ? "暂停" : "播放");
  $("chapter-number").textContent = String(
    plan.chapters.indexOf(c) + 1,
  ).padStart(2, "0");
  $("chapter-label").textContent = "CHAPTER / " + themeNames[c.theme];
  $("chapter-title").textContent = c.title;
  const lyric = plan.lyrics.lines
    .filter((l) => lyricTime(l, plan) <= t && lyricEnd(l, plan) > t)
    .at(-1);
  $("subtitle").textContent = showSubtitles ? (lyric?.text ?? "") : "";
  $("fps").textContent = `${world.fps} FPS · ${world.drawCalls} DRAW`;
  drawMap();
}
studioRefresh = installStudio({
  get: () => plan,
  apply: (p) => {
    plan = p;
    gallery = false;
    world.galleryId = "";
    document.body.classList.remove("gallery");
    return rebuild();
  },
  signal: () => player.analysis,
  toast,
  preview: (id) => {
    world.galleryId = id;
    gallery = true;
    player.pause();
    document.body.classList.add("gallery");
    rebuild();
  },
});
evidenceRefresh = installEvidenceStudio({
  analyze: runAutomatic,
  undoAuto: undoAutomatic,
  get: () => plan,
  apply: (p) => {
    plan = p;
    gallery = false;
    world.galleryId = "";
    document.body.classList.remove("gallery");
    return rebuild();
  },
  signal: () => player.analysis,
  seek: (t) => {
    player.seek(t);
    world.update(player.time, player.energy, true);
  },
  toast,
});
briefRefresh = installBriefStudio({
  get: () => ({
    draft: plan.narrative,
    current: { inputKey: inputKey(plan), binding: audioBinding(plan) },
  }),
  seek: (time) => {
    player.pause();
    player.seek(time);
    world.update(player.time, player.energy, true);
  },
});
const creativeStudio = installCreativeStudio({
  get: () => plan,
  prepare: (candidate) => {
    const prepared = world.prepare(candidate, false, "cinematic");
    return {
      discard: prepared.discard,
      commit: () => {
        const time = player.time;
        prepared.commit();
        plan = candidate;
        gallery = false;
        world.galleryId = "";
        document.body.classList.remove("gallery");
        world.update(time, player.energy, true);
        refresh();
        drawMap();
      },
    };
  },
  status: analysisStatus,
  seek: (time) => {
    player.pause();
    player.seek(time);
    world.update(player.time, player.energy, true);
  },
  toast,
});
experienceRefresh = installExperienceReview({
  get: () => plan,
  apply: (p) => {
    plan = validatePlan(p);
    return rebuild();
  },
  seek: (t) => {
    player.seek(t);
    world.update(t, player.energy, true);
  },
});
spatialRefresh = installSpatialStudio({
  seek: (time, view) => {
    if (view)
      cameraControls
        .querySelector<HTMLButtonElement>(`[data-view="${view}"]`)!
        .click();
    player.pause();
    player.seek(time);
    world.update(player.time, player.energy, true);
  },
  get: () => ({
    time: player.time,
    records: world.placement.records,
    reservations: world.placement.reservations,
    proxies: world.placement.proxies,
    views: world.inspectViews(),
    framing: world.inspectFraming(),
    automatic: world.inspectAuto(),
    cameraProgram: world.inspectCameraProgram(),
    composition: world.inspectLayoutRepair(),
    heightAdjustment: world.cameraHeightAdjustment,
    lastRejected: world.lastRejected,
  }),
  overlay: (enabled, point, proxyId) =>
    world.showSpatial(enabled, point, proxyId),
  locate: (issue) => {
    player.seek(world.issueTime(issue));
    world.update(player.time, player.energy, true);
  },
});
$("apply-speed").onclick = () => {
  const speed = Number($<HTMLInputElement>("travel-speed").value);
  if (!Number.isFinite(speed) || speed < 0.5 || speed > 6)
    return toast("步速范围 0.5 至 6");
  plan.path.speed = speed;
  if (!rebuild()) return;
  toast("行进速度已更新，音频速度与转角时间保持不变");
};
refresh();
drawWave();
if (new URLSearchParams(location.search).get("studio") === "narrative")
  document.getElementById("open-evidence")?.click();
if (new URLSearchParams(location.search).get("studio") === "creative")
  creativeStudio.open();
requestAnimationFrame(frame);
void player.play();
if (restored) toast("已还原本机配置；本地音频需重新选择。");
if (startupSpatialFallback)
  toast(
    "已保存计划未通过通行检查，现显示默认预览；原文件未覆盖，可在开发检查导出原候选。",
  );
if (evaluationId) {
  void loadReviewPlan(evaluationId, location.href)
    .then(({ data, entry }) => {
      const candidate = validatePlan(data);
      const prepared = world.prepare(
        candidate,
        false,
        candidate.creativeWorld ? "cinematic" : "compatibility",
      );
      prepared.commit();
      plan = candidate;
      gallery = false;
      document.body.classList.remove("gallery");
      player.stopFile();
      player.setClip(plan.audio.clipStart, plan.audio.clipEnd);
      player.seek(Math.min(entry.previewTime ?? 0, duration(plan)));
      pending = {};
      refresh();
      if (entry.previewTime !== undefined) {
        player.pause();
        chooseView("first");
      }
      world.update(player.time, 0, true);
      drawWave();
      toast(entry.evidence);
    })
    .catch((e) => toast((e as Error).message));
}
// Read-only diagnostics make clock and layout verification inspectable in DevTools.
Object.defineProperty(window, "journeyDebug", {
  get: () => ({
    time: player.time,
    audioTime: player.loaded ? player.audio.currentTime : null,
    playing: player.playing,
    loaded: player.loaded,
    audioFingerprint: player.fingerprint,
    plan: structuredClone(plan),
    hero: world.hero?.position.toArray(),
    path: world.path.map(
      ({ motion, travel, sequences, ...segment }) => segment,
    ),
    camera: world.camera.position.toArray(),
    view: world.playerView,
    sequence: sequenceAt(plan, player.time),
    weather: world.weatherFX?.inspect(),
    sequenceScenes: world.sequenceScenes.map((n) => ({
      id: n.sequence.id,
      kind: n.sequence.kind,
      roofVisible: n.roof?.visible,
      cutaways: n.cutaways.map((w) => w.visible),
    })),
    viewTracks: structuredClone(world.viewTracks),
    fps: world.fps,
    drawCalls: world.drawCalls,
    geometryCount: world.renderer.info.memory.geometries,
    spatial: {
      reservations: world.placement.reservations.length,
      proxies: world.placement.proxies.length,
      accepted: world.placement.records.filter((r) => r.status === "accepted")
        .length,
      relocated: structuredClone(
        world.placement.records.filter((r) => r.status === "relocated"),
      ),
      rejected: structuredClone(
        world.placement.records.filter((r) => r.status === "rejected"),
      ),
      lastRejected: structuredClone(world.lastRejected),
      cameraHeightAdjustment: world.cameraHeightAdjustment,
      views: world.viewTracks ? world.inspectViews() : undefined,
      framing: world.viewTracks ? world.inspectFraming() : undefined,
      automatic: world.autoTrack ? world.inspectAuto() : undefined,
      cameraProgram: world.inspectCameraProgram(),
      composition: world.inspectLayoutRepair(),
    },
    energy: player.energy,
  }),
});
