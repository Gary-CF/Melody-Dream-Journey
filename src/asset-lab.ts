import { createBrowserStorage } from "./adapters/scoped-storage";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Kit } from "./assets";
import { coreAssets as coreCatalog } from "./landmark-kit";
import { createCreativeRepository } from "./creative-repository";
import { generateComponent } from "./domain/creative-generators";
import { refKey, type LibraryEntry } from "./domain/creative-library";
import { builtInRecipes, type Recipe } from "./design";
import { CreativeEffects } from "./creative-effects";
import { WeatherRenderer } from "./weather-renderer";
import { weatherState, type WeatherKind } from "./weather";
import "./asset-lab.css";
const appStorage = createBrowserStorage();
const creativeRepository = createCreativeRepository(appStorage);
interface LabAsset {
  id: string;
  factoryId: string;
  name: string;
  category: string;
  entry?: LibraryEntry;
  recipe?: Recipe;
}
const coreAssets: LabAsset[] = coreCatalog.map((asset) => ({
  id: asset.id,
  factoryId: asset.id,
  name: asset.name,
  category: asset.category,
}));
let inventoryNotice = "";
try {
  const library = creativeRepository.read().library;
  for (const entry of library.entries.filter((e) => e.layer === "component")) {
    if (entry.layer !== "component") continue;
    const factoryId =
      entry.recipe.generator === "existing" ? entry.recipe.assetId : entry.id;
    const old = coreAssets.find((asset) => asset.factoryId === factoryId);
    if (old && entry.origin === "builtin") old.entry = entry;
    else
      coreAssets.push({
        id: entry.origin === "builtin" ? factoryId : refKey(entry),
        factoryId,
        name: entry.name,
        category: entry.origin === "builtin" ? "日常构件" : "生成入库",
        entry,
        recipe: generateComponent(entry),
      });
  }
} catch (error) {
  inventoryNotice = `生成库暂不可读：${(error as Error).message}`;
}
document.querySelector("#lab")!.innerHTML =
  `<header><a href="./help.html">← MVP 使用说明</a><span>ASSET LAB / 24 CORE PROTOTYPES</span><button id="overview">全部构件总览</button><a href="./help.html#library">内容库说明 ↗</a></header><aside><h1>可复用的<br>风景词汇。</h1><p>24 项原创程序化原型。可逐件检查比例、轮廓和光照；审阅结果仅保存在本机。</p><input id="search" placeholder="搜索名称或类别" aria-label="搜索构件"><div id="list"></div></aside><main><div id="viewport"></div><div class="controls"><select id="light" aria-label="光照"><option value="day">白昼</option><option value="dusk">黄昏</option><option value="night">夜晚</option></select><select id="weather" aria-label="天气"><option value="clear">晴朗</option><option value="rain">雨天</option><option value="mist">薄雾</option></select><button data-pose="orbit">自由观察</button><button data-pose="front">正面</button><button data-pose="side">侧面</button><button data-pose="top">俯视</button><label><input type="checkbox" id="cutaway" checked> 剖切</label><label><input type="checkbox" id="turntable">转台</label></div><div class="caption"><small id="asset-id"></small><h2 id="name"></h2><p id="dimensions"></p><p>拖动旋转 · 滚轮缩放 · 白色观察者为比例参照</p></div><section class="review"><div><strong>审阅记录</strong><p>来源：本项目原创几何；未使用商业游戏模型。</p></div><select id="verdict"><option value="pending">等待审阅</option><option value="accepted">审阅可用</option><option value="revise">需要修改</option></select><input id="note" maxlength="300" placeholder="记录轮廓、比例、光照或穿模问题"><button id="save">保存此项</button><button id="export">导出全部记录</button><span id="status"></span></section></main>`;
const $ = <E extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as E;
document.querySelector("header span")!.textContent =
  `ASSET LAB / ${coreAssets.length} EXECUTABLE ASSETS`;
document.querySelector("aside p")!.textContent =
  `${coreAssets.length} 项实际可渲染构件，包含三层后台库沉淀的组件。可逐件检查比例、轮廓、动态与光照。${inventoryNotice}`;
const renderer = new T.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
$("viewport").append(renderer.domElement);
const scene = new T.Scene(),
  root = new T.Group(),
  camera = new T.PerspectiveCamera(45, 1, 0.1, 600);
scene.add(root);
const ambient = new T.HemisphereLight("#fff0d4", "#67798a", 2.1),
  sun = new T.DirectionalLight("#fff1dd", 3);
sun.position.set(-12, 25, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
scene.add(ambient, sun, sun.target);
const ground = new T.Mesh(
  new T.PlaneGeometry(400, 400),
  new T.MeshStandardMaterial({ color: "#bac7ba", roughness: 0.9 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.12;
ground.receiveShadow = true;
scene.add(ground);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
let kit = new Kit(builtInRecipes()),
  model = new T.Group(),
  observer = new T.Group(),
  weatherFX = new WeatherRenderer(root),
  selected = coreAssets[0],
  bounds = new T.Vector3(10, 10, 10),
  angle = 0;
let creativeEffects: CreativeEffects | undefined;
const key = "core-assets-reviews-v1";
let reviews: Record<string, { verdict: string; note: string; date: string }> =
  {};
try {
  reviews = JSON.parse(appStorage.getItem(key) ?? "{}");
} catch {}
const thumbs = new Map<string, string>();
function dispose() {
  creativeEffects?.dispose();
  root.traverse((o) => {
    const g = o as T.Group;
    for (const geo of g.userData.mergedGeometries ?? []) geo.dispose();
    for (const mesh of g.userData.extra ?? []) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  });
  weatherFX.dispose();
  kit.dispose();
  root.clear();
  kit = new Kit(builtInRecipes());
}
function pose(kind: string) {
  const extent = Math.max(bounds.x, bounds.y, bounds.z, 4),
    center = new T.Vector3(0, bounds.y * 0.45, 0);
  controls.target.copy(center);
  const delta =
    kind === "front"
      ? new T.Vector3(0, 0.2, 1)
      : kind === "side"
        ? new T.Vector3(1, 0.2, 0)
        : kind === "top"
          ? new T.Vector3(0.01, 1, 0.01)
          : new T.Vector3(1, 0.65, 1);
  camera.position
    .copy(center)
    .addScaledVector(delta.normalize(), extent * 1.95);
  controls.update();
}
function select(id: string) {
  selected = coreAssets.find((a) => a.id === id) ?? coreAssets[0];
  dispose();
  if (selected.recipe) kit.recipes.push(selected.recipe);
  model = kit.create(selected.factoryId);
  root.add(model);
  const box = new T.Box3().setFromObject(model);
  box.getSize(bounds);
  model.position.sub(box.getCenter(new T.Vector3()).setY(box.min.y));
  observer = kit.observer("#ffffff", 0.85);
  observer.position.set(-bounds.x / 2 - 1, 0, 1);
  root.add(observer);
  creativeEffects = new CreativeEffects(root);
  weatherFX = new WeatherRenderer(root);
  pose("orbit");
  $("asset-id").textContent = selected.id + " / " + selected.category;
  $("name").textContent = selected.name;
  $("dimensions").textContent =
    `包围尺寸 ${bounds.x.toFixed(1)} × ${bounds.y.toFixed(1)} × ${bounds.z.toFixed(1)} · 场景单位`;
  $<HTMLSelectElement>("verdict").value =
    reviews[selected.id]?.verdict ?? "pending";
  $<HTMLInputElement>("note").value = reviews[selected.id]?.note ?? "";
  document
    .querySelectorAll("[data-id]")
    .forEach((b) =>
      b.classList.toggle(
        "active",
        (b as HTMLElement).dataset.id === selected.id,
      ),
    );
  $("status").textContent = "";
  if (selected.entry?.origin === "generated") {
    const entry = selected.entry;
    const review = creativeRepository
      .read()
      .reviews?.filter((r) => refKey(r.ref) === refKey(entry))
      .at(-1);
    $<HTMLSelectElement>("verdict").value =
      entry.state === "stable" ? "accepted" : "pending";
    $<HTMLInputElement>("note").value = review?.note ?? "";
    $("status").textContent =
      entry.state === "retired"
        ? "已退役版本，仅供审视历史"
        : entry.state === "stable"
          ? "已通过人工审阅，可供后续歌曲复用"
          : "生成内容尚需艺术审阅";
  }
  render(0);
}
function render(time: number) {
  creativeEffects?.update(time, controls.target);
  const night = $<HTMLSelectElement>("light").value === "night",
    dusk = $<HTMLSelectElement>("light").value === "dusk";
  scene.background = new T.Color(
    night ? "#27394c" : dusk ? "#d4b4a5" : "#dae1d5",
  );
  ambient.intensity = night ? 0.85 : 1.9;
  sun.intensity = night ? 0.65 : dusk ? 2 : 3;
  sun.color.set(night ? "#a4c9ff" : dusk ? "#ffc791" : "#fff1dd");
  renderer.toneMappingExposure = 1.05;
  const weather = $<HTMLSelectElement>("weather").value as WeatherKind,
    state = weatherState({
      kind: weather,
      intensity: 1,
      context: "unspecified",
      evidence: "",
    });
  const extent = Math.max(bounds.x, bounds.y, bounds.z, 4);
  scene.fog = new T.Fog(
    scene.background,
    Math.max(35, extent * 2.2) - state.fog * 10,
    Math.max(120, extent * 6) - state.fog * 30,
  );
  (ground.material as T.MeshStandardMaterial).roughness = 0.9 - state.wet * 0.7;
  weatherFX.update(time, state, controls.target, night ? 1 : 0.2, [
    new T.Vector3(3, 4, 4),
  ]);
  for (const [id, mat] of kit.materials)
    if (id.endsWith("true")) mat.emissiveIntensity = night ? 1.2 : 0.35;
  model.traverse((o) => {
    if (o.name.startsWith("cutaway-"))
      o.visible = !$<HTMLInputElement>("cutaway").checked;
  });
  renderer.render(scene, camera);
}
function list() {
  const search = $<HTMLInputElement>("search").value.trim();
  $("list").replaceChildren();
  for (const item of coreAssets.filter((a) =>
    (a.name + a.category).includes(search),
  )) {
    const b = document.createElement("button");
    b.dataset.id = item.id;
    const img = thumbs.get(item.id);
    if (img) {
      const el = document.createElement("img");
      el.src = img;
      el.alt = item.name;
      b.append(el);
    }
    const name = document.createElement("span");
    name.textContent = item.name;
    const small = document.createElement("small");
    small.textContent =
      item.category +
      " · " +
      (reviews[item.id]?.verdict === "accepted"
        ? "已审可用"
        : reviews[item.id]?.verdict === "revise"
          ? "待改"
          : "原型");
    b.append(name, small);
    b.onclick = () => select(item.id);
    $("list").append(b);
  }
}
$("overview").onclick = () => {
  document.body.classList.toggle("overview");
  $("overview").textContent = document.body.classList.contains("overview")
    ? "返回单件审阅"
    : "全部构件总览";
};
function resize() {
  const el = $("viewport");
  if (!el.clientWidth || !el.clientHeight) return;
  renderer.setSize(el.clientWidth, el.clientHeight);
  camera.aspect = el.clientWidth / el.clientHeight;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe($("viewport"));
resize();
list();
const params = new URLSearchParams(location.search);
const libraryAsset = coreAssets.find(
  (asset) => asset.entry && refKey(asset.entry) === params.get("library"),
);
select(libraryAsset?.id ?? params.get("asset") ?? coreAssets[0].id);
document
  .querySelectorAll<HTMLButtonElement>("[data-pose]")
  .forEach((b) => (b.onclick = () => pose(b.dataset.pose!)));
$("search").oninput = list;
$("save").onclick = () => {
  try {
    reviews[selected.id] = {
      verdict: $<HTMLSelectElement>("verdict").value,
      note: $<HTMLInputElement>("note").value,
      date: new Date().toISOString(),
    };
    appStorage.setItem(key, JSON.stringify(reviews));
    if (selected.entry?.origin === "generated") {
      const state =
        reviews[selected.id].verdict === "accepted"
          ? "stable"
          : "technical-preview";
      creativeRepository.review(
        selected.entry,
        state,
        reviews[selected.id].note || "在三维构件审阅台检查",
        reviews[selected.id].date,
      );
      selected.entry.state = state;
    }
    list();
    $("status").textContent = "已保存";
  } catch (error) {
    $("status").textContent = (error as Error).message;
  }
};
$("export").onclick = () => {
  const blob = new Blob(
      [JSON.stringify({ version: 1, assets: coreAssets, reviews }, null, 2)],
      { type: "application/json" },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "core-assets-review.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
// Capture actual geometry thumbnails using this renderer, not placeholder artwork.
setTimeout(() => {
  const original = selected.id;
  renderer.setSize(180, 135);
  camera.aspect = 180 / 135;
  camera.updateProjectionMatrix();
  for (const item of coreAssets.slice(0, 64)) {
    select(item.id);
    render(0);
    thumbs.set(item.id, renderer.domElement.toDataURL("image/webp", 0.65));
  }
  resize();
  list();
  select(original);
}, 50);
function tick(now: number) {
  requestAnimationFrame(tick);
  controls.autoRotate = $<HTMLInputElement>("turntable").checked;
  controls.autoRotateSpeed = 0.65;
  controls.update();
  render(now / 1000);
}
requestAnimationFrame(tick);
Object.defineProperty(window, "assetLabDebug", {
  get: () => ({
    selected: selected.id,
    count: coreAssets.length,
    dimensions: bounds.toArray(),
    geometries: renderer.info.memory.geometries,
    drawCalls: renderer.info.render.calls,
  }),
});
