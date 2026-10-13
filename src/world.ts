import * as T from "three";
import { walk } from "./assets";
import { WorldContent } from "./world-content";
import { SpatialBuildError, type PlacementRecord } from "./placement";
import {
  inspectSceneViews,
  sceneIntent,
  inspectSceneFraming,
} from "./scene-views";
import type { ShotIntent } from "./domain/shot-intent";
import { SpatialOverlay } from "./spatial-overlay";
import type { SpatialIssue, Vec3 } from "./domain/spatial";
import { chapterAt, duration, type Plan } from "./model";
import { positionAt, speedAt, travelledAt } from "./path";
import { lightProgress, smooth } from "./director";
import { journeyViews } from "./journey-views";
import { inspectView } from "./domain/camera-clearance";
import {
  cameraClip,
  inspectFraming,
  type ShotView,
} from "./domain/shot-intent";
import { observerCameraRadius } from "./domain/observer-space";
import { weatherAt, type WeatherKind } from "./weather";
import { type CameraPair, type PlayerView } from "./player-camera";
import { phaseAt } from "./sequences";
import { compileLighting, lightingAt } from "./domain/lighting-timeline";
export class World {
  private overlay?: SpatialOverlay;
  private overlayEnabled = false;
  showSpatial(enabled: boolean, point?: Vec3, proxyId?: string) {
    this.overlay?.dispose();
    this.overlay = undefined;
    this.overlayEnabled = enabled;
    if (!enabled) return;
    this.overlay = new SpatialOverlay(
      this.placement.reservations,
      point,
      this.placement.proxies.find((p) => p.id === proxyId)?.bounds,
    );
    this.scene.add(this.overlay.group);
  }
  issueTime(issue: SpatialIssue) {
    let best = Infinity,
      time = issue.timeRange[0];
    const end = Math.min(duration(this.plan), issue.timeRange[1]);
    for (let t = Math.max(0, issue.timeRange[0]); t <= end; t += 0.1) {
      const p = positionAt(this.path, t),
        d = Math.hypot(p.x - issue.point[0], p.z - issue.point[2]);
      if (d < best) {
        best = d;
        time = t;
      }
    }
    return time;
  }
  lastRejected:
    | { message: string; records: readonly PlacementRecord[]; candidate: Plan }
    | undefined;
  private content = new WorldContent();
  get petals() {
    return this.content.petals;
  }
  get sequenceScenes() {
    return this.content.sequenceScenes;
  }
  get weatherFX() {
    return this.content.weatherFX;
  }
  get lampPositions() {
    return this.content.lampPositions;
  }
  get kit() {
    return this.content.kit;
  }
  get root() {
    return this.content.root;
  }
  get hero() {
    return this.content.hero;
  }
  get path() {
    return this.content.path;
  }
  get props() {
    return this.content.props;
  }
  get pedestrians() {
    return this.content.pedestrians;
  }
  get celestial() {
    return this.content.celestial;
  }
  get moon() {
    return this.content.moon;
  }
  get sunDisk() {
    return this.content.sunDisk;
  }
  get water() {
    return this.content.water;
  }
  get particles() {
    return this.content.particles;
  }
  get trail() {
    return this.content.trail;
  }
  get gallery() {
    return this.content.gallery;
  }
  get placement() {
    return this.content.placement;
  }
  get plan() {
    return this.content.plan;
  }
  set plan(p: Plan) {
    this.content.plan = structuredClone(p);
    this.content.lighting = compileLighting(
      p.chapters,
      p.atmospheres,
      p.transition.seconds,
    );
  }
  playerView: PlayerView = "overhead";
  private comparingViews = false;
  get compareViews() {
    return this.comparingViews;
  }
  set compareViews(value: boolean) {
    this.comparingViews = value;
    this.content.prepareViews(this.camera.aspect / (value ? 2 : 1));
  }
  get cameraProgram() {
    return this.content.cameraProgram;
  }
  inspectCameraProgram() {
    return {
      aspect: this.cameraProgram.aspect,
      shots: structuredClone([...this.cameraProgram.shots.values()]),
    };
  }
  inspectLayoutRepair() {
    return structuredClone(this.content.layoutRepair);
  }
  viewTracks!: CameraPair;
  cameraHeightAdjustment = 0;
  autoTrack!: ShotView;
  autoHeightAdjustment = 0;
  autoVisibilityView = "overhead";
  autoEyeAttached = false;
  autoTransition: { kind: "cut" | "continuous"; fade: number } = {
    kind: "continuous",
    fade: 0,
  };
  inspectAuto() {
    return {
      body: inspectView(
        this.autoTrack,
        this.placement.proxies,
        observerCameraRadius,
        false,
      ),
      framing: inspectFraming(
        this.autoTrack,
        this.shotIntent,
        this.content.sight,
        this.autoVisibilityView,
        this.camera.aspect,
      ),
      heightAdjustment: this.autoHeightAdjustment,
      eyeAttached: this.autoEyeAttached,
      transition: this.autoTransition,
    };
  }
  private focusSubjects: readonly string[] = [];
  private shotIntent: ShotIntent = sceneIntent(undefined, 0);
  inspectFraming() {
    return inspectSceneFraming(
      this.viewTracks,
      this.shotIntent,
      this.content.sight,
      this.camera.aspect / (this.compareViews ? 2 : 1),
    );
  }
  inspectViews() {
    return inspectSceneViews(
      this.viewTracks,
      this.placement.proxies,
      this.focusSubjects,
    );
  }
  weatherOverride?: WeatherKind;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(48, 1, cameraClip.near, cameraClip.far);
  renderer: T.WebGLRenderer;
  ambient = new T.HemisphereLight("#ffe6c8", "#557c7b", 1.9);
  sun = new T.DirectionalLight("#ffdfb4", 3);
  galleryId = "";
  target = new T.Vector3();
  lastTime = -1;
  frames = 0;
  fps = 0;
  lastPerf = performance.now();
  drawCalls = 0;
  constructor(container: HTMLElement) {
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.append(this.renderer.domElement);
    this.scene.add(
      this.root,
      this.ambient,
      this.sun,
      this.sun.target,
      this.celestial,
    );
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -45;
    this.sun.shadow.camera.right = 45;
    this.sun.shadow.camera.top = 45;
    this.sun.shadow.camera.bottom = -45;
    this.sun.shadow.normalBias = 0.08;
    this.sun.castShadow = true;
    new ResizeObserver(() => this.resize(container)).observe(container);
    this.resize(container);
  }
  resize(el: HTMLElement) {
    this.camera.aspect = el.clientWidth / el.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(el.clientWidth, el.clientHeight);
    this.content.prepareViews(this.camera.aspect / (this.compareViews ? 2 : 1));
  }
  clear() {
    this.showSpatial(false);
    this.content.dispose();
    this.content = new WorldContent();
  }
  build(p: Plan, gallery = false) {
    this.prepare(p, gallery).commit();
  }
  prepare(
    p: Plan,
    gallery = false,
    policy: "compatibility" | "cinematic" = "compatibility",
  ) {
    let candidate: WorldContent;
    try {
      candidate = new WorldContent(
        p,
        gallery,
        this.galleryId,
        this.camera.aspect / (this.compareViews ? 2 : 1),
      );
      if (policy === "cinematic") {
        const failures = candidate.sequenceScenes
          .filter((s) => s.sequence.kind === "composition")
          .flatMap((s) => {
            const shot = candidate.cameraProgram.shots.get(s.sequence.id);
            if (!shot)
              return [`${s.sequence.composition?.title}: 缺少镜头验收结果`];
            return (["first", "overhead"] as const).flatMap((view) => {
              const selection = shot.selections[view];
              return selection.status === "selected" &&
                selection.selected.accepted
                ? []
                : [
                    `${s.sequence.composition?.title} / ${view === "first" ? "第一视角" : "俯视"}: 主体可见性或机位尚未通过`,
                  ];
            });
          });
        if (failures.length) {
          candidate.dispose();
          throw new SpatialBuildError(
            failures.join("；"),
            candidate.placement.records,
          );
        }
      }
    } catch (error) {
      this.lastRejected = {
        message: (error as Error).message,
        records: error instanceof SpatialBuildError ? error.records : [],
        candidate: structuredClone(p),
      };
      throw error;
    }
    let settled = false;
    return {
      discard: () => {
        if (!settled) {
          settled = true;
          candidate.dispose();
        }
      },
      commit: () => {
        if (settled) throw Error("场景准备已结束，不能再次应用");
        settled = true;
        const previous = this.content;
        this.content = candidate;
        this.lastRejected = undefined;
        this.scene.add(candidate.root, candidate.celestial);
        previous.dispose();
        if (this.overlayEnabled) this.showSpatial(true);
        this.renderer.setPixelRatio(
          Math.min(devicePixelRatio, p.visual.quality === "high" ? 1.6 : 1),
        );
        this.renderer.shadowMap.enabled = p.visual.quality === "high";
        this.lastTime = -1;
        if (gallery) this.configureGallery();
        else this.update(0, 0, true);
      },
    };
  }
  configureGallery() {
    this.renderer.domElement.style.filter = "";
    this.camera.position.set(
      ...((this.galleryId ? [14, 12, 20] : [32, 40, 56]) as [
        number,
        number,
        number,
      ]),
    );
    this.camera.lookAt(0, 2, this.galleryId ? 0 : 3);
    this.scene.background = new T.Color("#b5c7bc");
    this.ambient.color.set("#ffe6c8");
    this.ambient.intensity = 1.9;
    this.sun.intensity = 2.6;
    this.renderer.toneMappingExposure = 1.2;
    this.scene.fog = null;
    this.sun.position.set(-20, 40, 20);
    this.sun.target.position.set(0, 0, 0);
  }
  update(time: number, energy: number, _snap = false) {
    if (this.gallery) {
      this.content.creativeEffects?.update(time, this.camera.position);
      this.renderer.render(this.scene, this.camera);
      this.measure();
      return;
    }
    const p = this.plan,
      pos = positionAt(this.path, time);
    this.hero.position.set(pos.x, 0.23, pos.z);
    const before = positionAt(this.path, Math.max(0, time - 0.22)),
      after = positionAt(this.path, Math.min(duration(p), time + 0.22));
    this.hero.rotation.y = Math.atan2(after.x - before.x, after.z - before.z);
    if (Math.hypot(after.x - before.x, after.z - before.z) < 0.001)
      this.hero.rotation.y = pos.heading;
    walk(
      this.hero,
      travelledAt(this.path, time) / 2.8,
      0.7 * Math.min(1, speedAt(p, time) / p.path.speed),
    );
    const transform = new T.Object3D();
    for (let i = 0; i < 32; i++) {
      const a = positionAt(this.path, Math.max(0, time - i * 0.04)),
        b = positionAt(this.path, Math.max(0, time - (i + 1) * 0.04));
      transform.position.set((a.x + b.x) / 2, 0.245, (a.z + b.z) / 2);
      transform.rotation.set(0, Math.atan2(a.x - b.x, a.z - b.z), 0);
      transform.scale.set(
        0.18 * (1 - i / 36),
        0.025,
        Math.max(0.01, Math.hypot(a.x - b.x, a.z - b.z) + 0.02),
      );
      transform.updateMatrix();
      this.trail.setMatrixAt(i, transform.matrix);
    }
    this.trail.instanceMatrix.needsUpdate = true;
    const chapter = chapterAt(p, time),
      idx = p.chapters.indexOf(chapter),
      previous = p.chapters[Math.max(0, idx - 1)],
      mix = T.MathUtils.smoothstep(
        time - chapter.start,
        0,
        chapter.director?.transition ?? p.transition.seconds,
      );
    const light = lightProgress(
      time - chapter.start,
      chapter.director?.transition ?? p.transition.seconds,
    );
    const palette = (id: string | undefined) =>
      p.atmospheres.find((a) => a.id === id) ?? p.atmospheres[0];
    const a = palette(previous.atmosphere),
      b = palette(chapter.atmosphere),
      lighting = p.creativeWorld
        ? lightingAt(this.content.lighting, time)
        : undefined,
      sky = new T.Color(a.sky)
        .lerp(new T.Color(b.sky), mix)
        .lerp(new T.Color(p.visual.tone), 0.04);
    if (lighting)
      sky.setRGB(...lighting.sky).lerp(new T.Color(p.visual.tone), 0.04);
    const weather = weatherAt(
      p,
      time,
      p.features?.weather === false ? "clear" : this.weatherOverride,
    );
    sky.lerp(new T.Color("#526777"), weather.cloud * 0.5);
    this.scene.background = sky;
    if (this.content.creativeGround) {
      (
        this.content.creativeGround.material as T.MeshStandardMaterial
      ).color.setRGB(...lighting!.ground);
      this.content.creativeGround.updateWetness(weather.wet);
    }
    this.scene.fog = new T.Fog(
      sky,
      65 - weather.fog * 48,
      (lighting?.fog ?? T.MathUtils.lerp(a.fog, b.fog, mix)) *
        (1 - weather.fog * 0.57),
    );
    this.ambient.intensity = p.visual.ambient;
    this.sun.position.set(pos.x - 25, 45, pos.z + 22);
    this.sun.target.position.set(pos.x, 0, pos.z);
    const night =
      lighting?.night ?? T.MathUtils.lerp(a.night, b.night, light.lamps);
    this.renderer.toneMappingExposure =
      lighting?.exposure ?? T.MathUtils.lerp(a.exposure, b.exposure, mix);
    this.sun.color.set(a.light).lerp(new T.Color(b.light), light.key);
    if (lighting) this.sun.color.setRGB(...lighting.light);
    this.ambient.color.copy(sky).lerp(new T.Color("#ffffff"), 0.28);
    const uniforms = (this.water.material as T.ShaderMaterial).uniforms;
    uniforms.uTime.value = time;
    uniforms.uRain.value = weather.rain;
    uniforms.uColor.value.set(a.water).lerp(new T.Color(b.water), mix);
    if (lighting) uniforms.uColor.value.setRGB(...lighting.water);
    uniforms.uNight.value =
      lighting?.sparkle ?? T.MathUtils.lerp(a.sparkle, b.sparkle, mix);
    this.water.position.set(pos.x, -0.47, pos.z);
    this.ambient.intensity = p.visual.ambient * (1 - night * 0.52);
    this.sun.intensity =
      (lighting?.sun ?? T.MathUtils.lerp(a.sun, b.sun, light.key)) *
      (1 - weather.cloud * 0.75);
    this.weatherFX?.update(
      time,
      weather,
      this.hero.position,
      night,
      this.lampPositions,
    );
    for (const [key, mat] of this.kit.materials)
      if (["#e2cfb0", "#c2b59e", "#b4c0a6"].some((c) => key.startsWith(c))) {
        mat.roughness = 0.86 - weather.wet * 0.65;
        mat.metalness = weather.wet * 0.22;
      }
    this.moon.position.set(pos.x + 2, p.visual.moonHeight, pos.z - 64);
    this.moon.scale.setScalar(p.visual.moonSize);
    this.sunDisk.position.set(pos.x - 12, 13, pos.z - 72);
    this.moon.visible = night > 0.35 && weather.cloud < 0.8;
    this.moon.scale.multiplyScalar(T.MathUtils.smoothstep(night, 0.35, 0.8));
    this.sunDisk.visible = night < 0.6 && weather.cloud < 0.4;
    this.sunDisk.scale.setScalar(
      4 * (1 - T.MathUtils.smoothstep(night, 0.15, 0.6)),
    );
    if (this.content.creativeSky) {
      this.moon.visible = false;
      this.sunDisk.visible = false;
      if (lighting) {
        const elevation = T.MathUtils.degToRad(lighting.sunElevation),
          azimuth = T.MathUtils.degToRad(lighting.sunAzimuth);
        this.sunDisk.position
          .copy(this.hero.position)
          .add(
            new T.Vector3(
              Math.sin(azimuth) * Math.cos(elevation),
              Math.sin(elevation),
              Math.cos(azimuth) * Math.cos(elevation),
            ).multiplyScalar(100),
          );
        this.moon.position.lerp(
          this.sunDisk.position,
          T.MathUtils.smoothstep(lighting.night, 0.35, 0.8),
        );
      }
      this.sun.position
        .copy(this.hero.position)
        .addScaledVector(
          this.sunDisk.position.clone().sub(this.hero.position).normalize(),
          100,
        );
    }
    if (lighting)
      this.content.creativeSky?.update(
        time,
        this.hero.position,
        lighting,
        weather.cloud,
        this.sunDisk.position.clone().sub(this.hero.position),
        this.moon.position.clone().sub(this.hero.position),
        p.visual.moonSize,
      );
    uniforms.uMoon.value.set(this.moon.position.x, this.moon.position.z);
    uniforms.uFog.value.copy(sky);
    if (uniforms.uKeyDirection) {
      uniforms.uKeyDirection.value
        .copy(this.sunDisk.position)
        .lerp(this.moon.position, T.MathUtils.smoothstep(night, 0.35, 0.8))
        .sub(this.hero.position)
        .normalize();
      uniforms.uLight.value.copy(this.sun.color);
      uniforms.uSky.value.copy(sky);
      uniforms.uDarkness.value = night;
      uniforms.uCloud.value = weather.cloud;
    }
    this.particles.position.set(pos.x + Math.sin(time * 0.08) * 3, 0, pos.z);
    (this.particles.material as T.PointsMaterial).opacity =
      p.visual.particles * (0.25 + night * 0.55);
    for (const g of this.props)
      g.visible =
        g.position.distanceTo(this.hero.position) <
        (g.userData.range ?? (p.visual.quality === "high" ? 155 : 115));
    for (const g of this.pedestrians) {
      g.position
        .copy(g.userData.origin)
        .addScaledVector(
          g.userData.direction,
          Math.sin(time * 0.3 + g.userData.phase) * 1.4,
        );
      walk(g, time * 0.6);
    }
    const views = journeyViews(
      p,
      this.path,
      time,
      energy,
      this.sequenceScenes,
      this.placement.proxies,
      this.content.cameraProgram,
    );
    this.viewTracks = views.pair;
    this.cameraHeightAdjustment = views.heightAdjustment;
    const sceneNode = views.node;
    this.content.creativeEffects?.update(
      time,
      this.hero.position,
      new T.Color("#c0d4f5")
        .lerp(new T.Color("#ffffff"), 1 - night)
        .multiplyScalar(1 - night * 0.5),
    );
    this.focusSubjects = sceneNode?.focusSubjects ?? [];
    this.shotIntent = sceneIntent(sceneNode, time);
    this.petals?.update(
      time,
      sceneNode?.sequence.kind === "bridge" &&
        ["blossom", "osmanthus"].includes(sceneNode.sequence.focus)
        ? sceneNode.focus
        : undefined,
      sceneNode?.sequence.focus === "osmanthus",
    );
    if (sceneNode?.sequence.kind === "bridge") {
      const moon = sceneNode.group.localToWorld(new T.Vector3(25, 33, 82));
      const phase = phaseAt(sceneNode.sequence, time),
        blend =
          smooth((phase - 0.1) / 0.25) * (1 - smooth((phase - 0.76) / 0.24));
      this.moon.position.lerp(moon, blend);
      this.moon.scale.lerp(new T.Vector3(6.5, 6.5, 6.5), blend);
      uniforms.uMoon.value.set(this.moon.position.x, this.moon.position.z);
    }

    for (const node of this.sequenceScenes)
      node.fill.visible = node.focus.distanceTo(this.hero.position) < 100;
    const track =
      this.playerView === "auto"
        ? views.auto
        : this.viewTracks[this.playerView];
    this.camera.position.fromArray(track.position);
    this.target.fromArray(track.target);
    this.camera.fov = track.fov;
    this.camera.updateProjectionMatrix();
    this.hero.visible =
      this.playerView === "auto"
        ? views.autoHeroVisible
        : this.playerView !== "first";
    this.autoTrack = views.auto;
    this.autoHeightAdjustment = views.autoHeightAdjustment;
    this.autoVisibilityView = views.autoVisibilityView;
    this.autoEyeAttached = views.autoEyeAttached;
    this.autoTransition = views.autoTransition;
    const fade =
      this.playerView === "auto" && !this.compareViews
        ? views.autoTransition.fade
        : 0;
    this.renderer.domElement.style.filter =
      fade > 0 ? `brightness(${1 - fade})` : "";
    this.camera.lookAt(this.target);
    const shelter = this.sequenceScenes
      .filter((n) => n.sequence.kind === "tavern" || n.shelter)
      .sort(
        (a, b) =>
          a.anchor.distanceToSquared(this.hero.position) -
          b.anchor.distanceToSquared(this.hero.position),
      )[0];
    if (this.weatherFX) {
      const box = (this.weatherFX.rain.material as T.ShaderMaterial).uniforms
        .shelter.value as T.Vector4;
      if (shelter) {
        const sideways = Math.abs(Math.sin(shelter.heading)) > 0.5;
        const center = shelter.shelter?.center ?? shelter.anchor;
        const width = shelter.shelter?.halfWidth ?? 5;
        const length = shelter.shelter?.halfLength ?? 6;
        box.set(
          center.x,
          center.z,
          sideways ? length : width,
          sideways ? width : length,
        );
      } else box.set(0, 0, 0, 0);
    }
    for (const node of this.sequenceScenes) {
      if (node.roof)
        node.roof.visible =
          this.playerView === "first" ||
          (this.playerView === "auto" && views.autoEyeAttached);
      for (const wall of node.cutaways)
        wall.visible =
          this.playerView === "first" ||
          (this.playerView === "auto" && views.autoEyeAttached);
    }
    this.lastTime = time;
    for (const [key, mat] of this.kit.materials)
      if (key.endsWith("true")) {
        mat.emissiveIntensity = 0.12 + night * 1.8 + energy * 0.14;
        if (key.startsWith("#719a9a")) {
          mat.color.set("#719a9a").lerp(new T.Color("#ffc77f"), night);
          mat.emissive.copy(mat.color);
        }
      }
    for (const key of ["#91ad95", "#8fa99d", "#83968a"])
      this.kit.materials
        .get(key + "false")
        ?.color.set(a.ground)
        .lerp(new T.Color(b.ground), mix);
    const observer = this.kit.materials.get("observer");
    if (observer) observer.emissiveIntensity = 0.18 + night * 0.23;
    for (const g of this.props)
      for (const mesh of g.userData.extra ?? [])
        if (mesh.material instanceof T.MeshBasicMaterial)
          mesh.material.opacity = 0.03 + night * 0.3;
    if (this.compareViews) {
      const size = this.renderer.getSize(new T.Vector2());
      this.renderer.setScissorTest(true);
      for (const [i, view] of (["overhead", "first"] as const).entries()) {
        const track = this.viewTracks[view];
        this.camera.position.fromArray(track.position);
        this.camera.lookAt(new T.Vector3().fromArray(track.target));
        this.camera.fov = track.fov;
        this.camera.aspect = size.x / 2 / size.y;
        this.camera.updateProjectionMatrix();
        this.hero.visible = view !== "first";
        for (const node of this.sequenceScenes) {
          if (node.roof) node.roof.visible = view === "first";
          for (const wall of node.cutaways) wall.visible = view === "first";
        }
        this.renderer.setViewport((i * size.x) / 2, 0, size.x / 2, size.y);
        this.renderer.setScissor((i * size.x) / 2, 0, size.x / 2, size.y);
        this.renderer.render(this.scene, this.camera);
      }
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, size.x, size.y);
      this.camera.aspect = size.x / size.y;
      this.camera.position.fromArray(track.position);
      this.camera.lookAt(this.target);
      this.camera.fov = track.fov;
      this.hero.visible =
        this.playerView === "auto"
          ? views.autoHeroVisible
          : this.playerView !== "first";
      for (const node of this.sequenceScenes) {
        const enclosed =
          this.playerView === "first" ||
          (this.playerView === "auto" && views.autoEyeAttached);
        if (node.roof) node.roof.visible = enclosed;
        for (const wall of node.cutaways) wall.visible = enclosed;
      }
      this.camera.updateProjectionMatrix();
    } else this.renderer.render(this.scene, this.camera);
    this.measure();
  }
  measure() {
    this.frames++;
    const now = performance.now();
    if (now - this.lastPerf > 1000) {
      this.fps = Math.round((this.frames * 1000) / (now - this.lastPerf));
      this.frames = 0;
      this.lastPerf = now;
      this.drawCalls = this.renderer.info.render.calls;
    }
  }
}
