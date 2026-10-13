import * as T from "three";
import { riverMaterial } from "./river-material";
import { Kit } from "./assets";
import { coreAssets } from "./core-catalog";
import { chapterAt, duration, rng, type Plan } from "./model";
import { makePath, basePositionAt, positionAt, type Segment } from "./path";
import { WeatherRenderer } from "./weather-renderer";
import { buildSequence, type SequenceScene } from "./sequence-scene";
import { Petals } from "./petals";
import { glowTexture, glowSprite } from "./glow";
import { physical, releaseCandidate } from "./spatial-adapter";
import { PlacementSession } from "./placement";
import { reserveRoute } from "./domain/route-reservation";
import { observerSpace } from "./domain/observer-space";
import { SightIndex } from "./sight-index";
import { compileCameraProgram, type CameraProgram } from "./camera-program";
import type { Vec3 } from "./domain/spatial";
import { repairLayouts, type LayoutRepairReport } from "./layout-repair";
import { compileLighting, type LightingCue } from "./domain/lighting-timeline";
import { CreativeSky } from "./creative-sky";
import { CreativeGround } from "./creative-ground";
import { buildCreativeRoad } from "./creative-road";
import { buildCreativeLandscape } from "./creative-landscape";
import { CreativeEffects } from "./creative-effects";
import { sequenceStop } from "./sequences";
import { scatterCreativeDecorations } from "./creative-scatter";

/** Candidate-owned scene content. It allocates no renderer and never touches the active scene. */
export class WorldContent {
  petals?: Petals;
  sequenceScenes: SequenceScene[] = [];
  private sequenceEntities = new Map<string, SequenceScene>();
  weatherFX?: WeatherRenderer;
  lampPositions: T.Vector3[] = [];
  kit = new Kit();
  root = new T.Group();
  hero!: T.Group;
  path: Segment[] = [];
  props: T.Group[] = [];
  pedestrians: T.Group[] = [];
  celestial = new T.Group();
  moon!: T.Mesh;
  sunDisk!: T.Mesh;
  water!: T.Mesh;
  creativeGround?: CreativeGround;
  lighting: LightingCue[] = [];
  creativeSky?: CreativeSky;
  creativeEffects?: CreativeEffects;
  particles!: T.Points;
  trail!: T.InstancedMesh;
  plan!: Plan;
  gallery = false;
  placement = new PlacementSession([]);
  sight = new SightIndex([]);
  cameraProgram: CameraProgram = { aspect: 16 / 9, shots: new Map() };
  layoutRepair: LayoutRepairReport = { version: 1, aspects: [], records: [] };
  private viewsPrepared = false;
  prepareViews(aspect: number) {
    if (!this.plan || this.gallery || !Number.isFinite(aspect) || aspect <= 0)
      return;
    if (
      this.viewsPrepared &&
      Math.abs(this.cameraProgram.aspect - aspect) < 1e-6
    )
      return;
    const next = compileCameraProgram(
      this.path,
      this.plan.visual.observerScale,
      this.sequenceScenes,
      this.placement.proxies,
      this.sight,
      aspect,
    );
    this.cameraProgram = next;
    this.viewsPrepared = true;
  }
  private nextInstance = 0;

  private placeProp(g: T.Group, id: string, offsets?: Vec3[]) {
    const moving = g.userData.kind === "person";
    const motion: Vec3 = moving
      ? [
          Math.abs(g.userData.direction.x) * 1.4 + 0.35,
          0.15,
          Math.abs(g.userData.direction.z) * 1.4 + 0.35,
        ]
      : [0, 0, 0];
    const result = this.placement.place(
      `${id}/${this.nextInstance++}`,
      g,
      offsets,
      motion,
    );
    if (result.status === "rejected") return false;
    this.root.add(g);
    this.props.push(g);
    return true;
  }

  constructor(
    p?: Plan,
    gallery = false,
    readonly galleryId = "",
    aspect = 16 / 9,
  ) {
    if (!p) return;
    try {
      this.build(structuredClone(p), gallery);
      this.prepareViews(aspect);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  dispose() {
    this.cameraProgram = {
      aspect: this.cameraProgram.aspect,
      shots: new Map(),
    };
    this.viewsPrepared = false;
    this.sight.dispose();
    this.layoutRepair = { version: 1, aspects: [], records: [] };
    this.placement.sightSurfaces.length = 0;
    this.weatherFX?.dispose();
    this.petals?.dispose();
    this.creativeSky?.dispose();
    this.creativeGround?.dispose();
    this.creativeEffects?.dispose();
    releaseCandidate(this.root);
    this.root.clear();
    this.celestial.traverse((o) => {
      if (o instanceof T.Sprite) o.material.dispose();
    });
    this.celestial.removeFromParent();
    this.celestial.clear();
    this.kit.dispose();
  }
  private build(p: Plan, gallery = false) {
    this.plan = p;
    this.lighting = compileLighting(
      p.chapters,
      p.atmospheres,
      p.transition.seconds,
    );
    this.kit.recipes = p.library;
    this.gallery = gallery;
    this.path = makePath(p);
    this.placement = new PlacementSession(
      reserveRoute(
        this.path,
        observerSpace(p.visual.observerScale).travelEnvelope,
      ),
    );
    this.sight = new SightIndex(this.placement.sightSurfaces);
    const k = this.kit,
      r = rng(p.seed);
    if (p.creativeWorld && p.creativeWorld.recipe.terrain !== "waterfront") {
      this.creativeGround = new CreativeGround(p.seed);
      this.root.add(this.creativeGround);
    }
    const waterMat = new T.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new T.Color("#6eaaaa") },
        uMoon: { value: new T.Vector2() },
        uNight: { value: 0 },
        uRain: { value: 0 },
      },
      vertexShader:
        "varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);}",
      fragmentShader:
        "uniform float uRain;uniform float uTime;uniform vec3 uColor;uniform vec2 uMoon;uniform float uNight;varying vec3 vWorld;void main(){float a=sin(vWorld.x*2.1+vWorld.z*.72+uTime*.8);float b=sin(vWorld.z*3.3+uTime*.45);float rip=pow(max(0.0,a*b),8.0)*.08;float reflection=exp(-pow((vWorld.x-uMoon.x)/5.0,2.0))*exp(-abs(vWorld.z-uMoon.y)/42.0)*uNight;float rainRip=pow(max(0.,sin(length(fract(vWorld.xz*.43)-.5)*32.-uTime*6.)),12.)*uRain*.018/(1.+length(vWorld.xz-cameraPosition.xz)*.15);vec3 c=uColor+vec3(rip+rainRip)+vec3(.24,.21,.16)*reflection*(.6+.4*b);gl_FragColor=vec4(c,1.0);#include <tonemapping_fragment>\n#include <colorspace_fragment>}",
    });
    waterMat.uniforms.uFog = { value: new T.Color("#c6d3ca") };
    waterMat.fragmentShader = waterMat.fragmentShader
      .replace("uniform float uTime;", "uniform vec3 uFog;uniform float uTime;")
      .replace(")*.08;", ")*.018;")
      .replace(";#include", ";\n#include")
      .replace(
        "#include <colorspace_fragment>}",
        "#include <colorspace_fragment>\nfloat fog=smoothstep(45.0,155.0,length(vWorld.xz-cameraPosition.xz));gl_FragColor.rgb=mix(gl_FragColor.rgb,pow(uFog,vec3(1.0/2.2)),fog);}",
      );
    const activeWater = p.creativeWorld ? riverMaterial() : waterMat;
    if (activeWater !== waterMat) waterMat.dispose();
    this.water = new T.Mesh(new T.PlaneGeometry(1500, 1500), activeWater);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, -0.47, -300);
    this.root.add(this.water);
    this.root.userData.extra = [this.water];
    if (gallery) {
      this.buildGallery();
      this.creativeEffects = new CreativeEffects(this.root);
      return;
    }
    if (p.creativeWorld) this.creativeSky = new CreativeSky(this.celestial);
    // Cinematic subjects reserve their clear volumes before ambient scattering.
    // Movable volumes follow later layout trials; routes stay authoritative.
    if (p.features?.sequences !== false)
      for (const seq of (p.sequences ?? []).filter(
        (s) => s.kind === "composition",
      )) {
        const node = buildSequence(
          k,
          p,
          this.path,
          seq,
          this.placement,
          this.sequenceEntities,
        );
        this.root.add(node.group);
        this.sequenceScenes.push(node);
        this.lampPositions.push(...node.lamps);
      }
    const reserves = (
      p.features?.sequences === false ? [] : (p.sequences ?? [])
    ).map((s) => positionAt(this.path, sequenceStop(s)));
    const reserved = (x: number, z: number, radius = 30) =>
      reserves.some((a) => Math.hypot(a.x - x, a.z - z) < radius);
    const occupied: { x: number; z: number }[] = [];
    // Spacing is an aesthetic policy; physical safety is enforced by placeProp.
    const spaced = (x: number, z: number) => {
      if (reserved(x, z)) return false;
      return occupied.every((o) => Math.hypot(o.x - x, o.z - z) > 5.2);
    };
    // Scene boundaries can divide a straight segment without adding a turn or changing speed.
    const layout = this.path.flatMap((s) => {
      const cuts = [
        s.start,
        ...p.chapters
          .map((c) => c.start)
          .filter((t) => t > s.start && t < s.end),
        s.end,
      ];
      return cuts.slice(0, -1).map((start, i) => {
        const end = cuts[i + 1],
          a = basePositionAt(this.path, start),
          b = basePositionAt(this.path, end);
        return {
          ...s,
          start,
          end,
          a,
          b,
          length: Math.hypot(b.x - a.x, b.z - a.z),
        };
      });
    });
    for (let index = 0; index < layout.length; index++) {
      const s = layout[index],
        mid = (s.start + s.end) / 2,
        chapter = chapterAt(p, mid),
        river = chapter.theme === "river",
        w = p.visual.roadWidth;
      const worldRules = p.creativeWorld?.recipe;
      const roadPalette = worldRules
        ? (
            {
              paving: ["#cfbfa8", "#ddd0b9"],
              stone: ["#8b969a", "#c0c6bf"],
              earth: ["#a58b70", "#c4ad88"],
              timber: ["#a57965", "#c6967d"],
            } as const
          )[worldRules.road]
        : undefined;
      const road = new T.Group();
      road.position.set(s.a.x, 0, s.a.z);
      road.rotation.y = Math.atan2(s.dx, s.dz);
      this.root.add(road);
      if (worldRules) {
        buildCreativeRoad(k, road, {
          length: s.length,
          width: w,
          road: worldRules.road,
          waterfront: worldRules.terrain === "waterfront",
          seed: p.seed + index * 31,
          budget: Math.max(
            8,
            Math.ceil((s.length / (duration(p) * p.path.speed)) * 1200),
          ),
        });
      } else {
        if (!river) {
          k.box(
            road,
            "#91ad95",
            0,
            -0.43,
            s.length / 2,
            29,
            0.65,
            s.length + 5,
          );
          k.box(
            road,
            "#b4c0a6",
            0,
            -0.065,
            s.length / 2,
            w + 3.8,
            0.16,
            s.length + w,
          );
        } else {
          k.box(
            road,
            "#8fa99d",
            w / 2 + 4.3,
            -0.37,
            s.length / 2,
            4.8,
            0.52,
            Math.max(1, s.length - 6),
          );
        }
        k.box(
          road,
          roadPalette?.[0] ?? (river ? "#c2b59e" : "#e2cfb0"),
          0,
          0.06,
          s.length / 2,
          w,
          0.32,
          s.length + w,
        );
        for (const side of [-1, 1]) {
          k.box(
            road,
            roadPalette?.[1] ?? (river ? "#817b68" : "#eee0c7"),
            side * (w / 2 + 0.08),
            0.16,
            s.length / 2,
            0.17,
            0.26,
            Math.max(0.1, s.length - w),
          );
          if (river) {
            k.box(
              road,
              "#8a6f60",
              side * (w / 2 + 0.08),
              0.92,
              s.length / 2,
              0.12,
              0.12,
              Math.max(0.1, s.length - w),
            );
            for (
              let a = w / 2;
              a < s.length - w / 2;
              a += Math.max(3, duration(p) / 100)
            ) {
              k.box(
                road,
                "#a2876d",
                side * (w / 2 + 0.08),
                0.6,
                a,
                0.15,
                0.94,
                0.15,
              );
              k.mesh(
                road,
                "sphere",
                "#d4bc92",
                side * (w / 2 + 0.08),
                1.15,
                a,
                0.16,
                0.16,
                0.16,
              );
            }
            for (let a = 3; a < s.length; a += Math.max(7, duration(p) / 80))
              k.box(
                road,
                "#686e67",
                side * (w / 2 - 0.2),
                -1,
                a,
                0.55,
                2.2,
                0.55,
              );
          }
        }
        for (
          let a = 1;
          a < s.length;
          a += Math.max(river ? 1.1 : 2.2, duration(p) / 100)
        )
          physical(
            k.box(
              road,
              river ? "#a69b89" : "#c7bca6",
              0,
              0.225,
              a,
              w - 0.14,
              0.012,
              0.026,
            ),
            "support",
          );
      }
      // Placement uses each road's local frame, and rejects footprints near any other road.
      for (
        let a = 4;
        a < s.length - 3;
        a += Math.max(
          7.6 / (p.visual.density * (worldRules?.density ?? 1)),
          (duration(p) * p.path.speed) / 250,
        )
      ) {
        const t = s.start + (a / s.length) * (s.end - s.start),
          c = chapterAt(p, t);
        for (const side of [-1, 1]) {
          const nx = s.dz * side,
            nz = -s.dx * side,
            baseX = s.a.x + s.dx * a,
            baseZ = s.a.z + s.dz * a;
          const variant = Math.floor(r() * 12),
            offset = w / 2 + 5.3 + r() * 1.7;
          const x = baseX + nx * offset,
            z = baseZ + nz * offset;
          const buildings = c.assets.filter((a) =>
            ["shop", "home", "tower"].includes(a),
          );
          if ((!river || worldRules) && buildings.length && spaced(x, z)) {
            let kind = buildings[variant % buildings.length];
            const near = nx * 0.65 + nz * 0.9 > 0;
            if (near) kind = "shop";
            const g = k.create(kind, variant);
            if (!near && kind === "home") g.scale.y = 0.85;
            if (near) g.scale.y = 0.72;
            g.position.set(x, -0.1, z);
            g.rotation.y = Math.atan2(-nx, -nz);
            if (worldRules?.terrain === "waterfront") {
              const bounds = new T.Box3().setFromObject(g),
                size = bounds.getSize(new T.Vector3());
              // Built waterfront settlements need actual shoreline support.
              // It belongs to the building and passes the same route gate.
              physical(
                k.box(
                  g,
                  "#83968a",
                  0,
                  -0.16,
                  0,
                  Math.max(5, size.x + 1.2),
                  0.45,
                  Math.max(5, size.z + 1.2),
                ),
                "support",
              );
            }
            if (this.placeProp(g, `building/${kind}`)) occupied.push({ x, z });
          }
          const edge = river ? w / 2 - 0.3 : w / 2 + 1.15,
            tx = baseX + nx * edge,
            tz = baseZ + nz * edge;
          const treeType = c.assets.includes("flowerTree")
            ? "flowerTree"
            : "tree";
          const treeOffset = river ? w / 2 + 4.2 : w / 2 + 1.7;
          if (
            !reserved(baseX, baseZ, 42) &&
            c.assets.includes(treeType) &&
            (!river || side === 1) &&
            a > 6 &&
            a < s.length - 6
          ) {
            const g = k.create(treeType, variant);
            g.position.set(
              baseX + nx * treeOffset + s.dx * 2.5,
              river ? -0.1 : 0,
              baseZ + nz * treeOffset + s.dz * 2.5,
            );
            if (river)
              k.mesh(g, "cylinder", "#819a88", 0, -0.3, 0, 2.6, 0.5, 2.6);
            else g.scale.multiplyScalar(nx * 0.65 + nz * 0.9 > 0 ? 0.6 : 0.9);
            this.placeProp(g, `tree/${treeType}`);
          }
          if (
            c.assets.includes("lamp") &&
            side === 1 &&
            !reserved(tx, tz, 45)
          ) {
            const g = k.lamp();
            g.position.set(tx, 0.24, tz);
            g.rotation.y = Math.atan2(-nx, -nz);
            if (this.placeProp(g, "lamp"))
              this.lampPositions.push(new T.Vector3(tx, 3.5, tz));
          }
          if (
            (c.assets.includes("person") ||
              (worldRules?.population ?? 0) > 0) &&
            r() > (worldRules ? 1 - worldRules.population * 0.35 : 0.72)
          ) {
            const g = k.person(
              ["#d69573", "#80a5a2", "#d9c585"][variant % 3],
              0.8,
            );
            g.position.set(
              baseX + nx * (w / 2 - 0.65),
              0.23,
              baseZ + nz * (w / 2 - 0.65),
            );
            g.rotation.y = Math.atan2(s.dx, s.dz) + Math.PI;
            g.userData.origin = g.position.clone();
            g.userData.direction = new T.Vector3(s.dx, 0, s.dz);
            g.userData.phase = r() * 6;
            if (this.placeProp(g, "pedestrian")) this.pedestrians.push(g);
          }
          if (c.assets.includes("bench") && side === -1 && variant % 3 === 0) {
            const g = k.bench();
            g.position.set(tx, river ? 0.24 : 0, tz);
            g.rotation.y = Math.atan2(-nx, -nz);
            if (river) k.box(g, "#c2b59e", 0, -0.15, 0, 2.5, 0.3, 1.7);
            this.placeProp(g, "bench");
          }
        }
      }
      // Fence pieces that cross an actual detour are omitted individually;
      // their supporting road remains. This uses the same continuous check.
      for (const [part, child] of [...road.children].entries()) {
        this.placement.place(`road/${index}/${part}`, child);
      }
      k.batch(road);
      if (chapter.assets.includes("bus") && !river) {
        const g = k.bus();
        g.position.set(
          s.a.x + s.dx * s.length * 0.52 + s.dz * (w / 2 + 10),
          0.04,
          s.a.z + s.dz * s.length * 0.52 - s.dx * (w / 2 + 10),
        );
        g.rotation.y = Math.atan2(s.dx, s.dz);
        k.box(g, "#84988b", 0, -0.2, 0, 3.1, 0.2, 8);
        this.placeProp(g, "bus");
        const stop = k.stop();
        stop.position.set(
          g.position.x + s.dx * 3 + s.dz * 1.7,
          0.1,
          g.position.z + s.dz * 3 - s.dx * 1.7,
        );
        this.placeProp(stop, "bus-stop");
      }
    }
    // The initial bay is conditional on the plan's requested assets.
    if (p.chapters[0].assets.includes("bus")) {
      const g = k.bus();
      g.position.set(-12, 0, -6);
      g.rotation.y = Math.PI;
      k.box(g, "#84988b", 0, -0.2, 0, 3.1, 0.2, 8);
      this.placeProp(g, "initial-bus");
      const stop = k.stop();
      stop.position.set(-10.4, 0, -4);
      this.placeProp(stop, "initial-stop");
    }
    this.placeRecipes(p, r);
    if (p.creativeWorld)
      this.props.push(
        ...buildCreativeLandscape(
          k,
          p.creativeWorld.recipe,
          this.path,
          this.placement,
          this.root,
          p.seed,
        ),
      );
    this.props.forEach((g) => k.batch(g));
    if (p.features?.sequences !== false)
      for (const seq of p.sequences ?? []) {
        if (this.sequenceScenes.some((n) => n.sequence.id === seq.id)) continue;
        const node = buildSequence(
          k,
          p,
          this.path,
          seq,
          this.placement,
          this.sequenceEntities,
        );
        this.root.add(node.group);
        this.sequenceScenes.push(node);
        this.lampPositions.push(...node.lamps);
      }
    this.layoutRepair = repairLayouts(
      p.visual.observerScale,
      this.path,
      this.sequenceScenes,
      this.placement,
    );
    this.sight.dispose();
    for (const node of this.sequenceScenes) if (!node.roof) k.batch(node.group);
    this.creativeEffects = new CreativeEffects(this.root);

    this.weatherFX = new WeatherRenderer(this.root);
    this.petals = new Petals(this.root);
    this.hero = k.observer(p.visual.clothes, p.visual.observerScale);
    this.root.add(this.hero);
    const halo = new T.Mesh(
      new T.RingGeometry(0.5, 0.53, 32),
      new T.MeshBasicMaterial({
        color: "#fff1b8",
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.006;
    this.hero.add(halo);
    this.hero.userData.extra = [halo];
    this.trail = new T.InstancedMesh(k.geo("box"), k.mat("#f5ffff", true), 32);
    this.trail.frustumCulled = false;
    this.root.add(this.trail);
    this.moon = k.mesh(
      this.celestial,
      "sphere",
      "#fff1cf",
      0,
      30,
      0,
      3,
      3,
      3,
      true,
    );
    this.sunDisk = k.mesh(
      this.celestial,
      "sphere",
      "#ffd6a1",
      0,
      28,
      0,
      4,
      4,
      4,
      true,
    );
    const haloTexture = glowTexture();
    k.textures.push(haloTexture);
    for (const body of [this.moon, this.sunDisk]) {
      const halo = glowSprite(
        haloTexture,
        body === this.moon ? "#d8deff" : "#ffd4a3",
        5.2,
        0.3,
      );
      body.add(halo);
    }
    const vertices = [];
    for (let i = 0; i < 180; i++)
      vertices.push((r() - 0.5) * 120, 3 + r() * 32, (r() - 0.5) * 120);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(vertices, 3),
    );
    const pm = new T.PointsMaterial({
      color: "#fff3dc",
      size: 0.08,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    this.particles = new T.Points(geometry, pm);
    this.root.add(this.particles);
    this.root.userData.extra.push(this.particles);
  }
  private buildGallery() {
    const names: string[] = this.galleryId
      ? [this.galleryId]
      : [
          "tree",
          "flowerTree",
          "shop",
          "home",
          "tower",
          "lamp",
          "bus",
          "person",
          "bench",
          "stop",
          ...this.plan.library.map((r) => r.id),
        ];
    for (let i = 0; i < names.length; i++) {
      const x = this.galleryId ? 0 : ((i % 6) - 2.5) * 8,
        z = this.galleryId ? 0 : Math.floor(i / 6) * 10 - 10;
      const g = this.kit.create(names[i], i);
      this.kit.batch(g);
      const recipe = this.plan.library.find((r) => r.id === names[i]);
      if (recipe?.placement === "backdrop") g.scale.setScalar(0.16);
      g.position.set(x, 0.2, z);
      this.kit.box(this.root, "#c5ceb9", x, -0.1, z, 7, 0.5, 8);
      this.root.add(g);
      this.kit.label(
        this.root,
        (this.galleryId ? recipe?.name : undefined) ??
          [
            "圆冠 / 尖冠",
            "花树",
            "沿街门面",
            "住宅",
            "高层",
            "路灯",
            "巴士",
            "行人",
            "长椅",
            "站牌",
          ][i] ??
          recipe?.name ??
          names[i],
        x,
        0.8,
        z + 3.6,
        4,
        0.55,
      );
    }
  }
  private placeRecipes(p: Plan, random: () => number) {
    if (p.creativeWorld) {
      this.props.push(
        ...scatterCreativeDecorations(
          this.kit,
          p,
          this.path,
          this.placement,
          this.root,
        ),
      );
      return;
    }
    const reserved = (x: number, z: number) =>
      p.features?.sequences !== false &&
      (p.sequences ?? []).some((s) => {
        const a = positionAt(this.path, sequenceStop(s));
        return Math.hypot(x - a.x, z - a.z) < 35;
      });
    let total = 0;
    for (let i = 0; i < p.chapters.length; i++) {
      const c = p.chapters[i],
        end = p.chapters[i + 1]?.start ?? duration(p);
      const list = (c.recipes ?? [])
        .map(
          (id) =>
            (p.library.find((r) => r.id === id) ??
              coreAssets.find((r) => r.id === id))!,
        )
        .filter(Boolean);
      if (!list.length) continue;
      const count = Math.max(
        list.length,
        Math.min(14, Math.ceil((end - c.start) / 2.5)),
      );
      for (let j = 0; j < count && total < 180; j++) {
        const recipe = list[j % list.length],
          t = c.start + ((j + 0.5) / count) * (end - c.start),
          point = positionAt(this.path, t),
          s = point.segment;
        let side = s.dz * 0.65 - s.dx * 0.9 > 0 ? -1 : 1;
        if (recipe.placement === "water") side = -side;
        const nx = s.dz * side,
          nz = -s.dx * side;
        const base =
          recipe.placement === "backdrop"
            ? 42
            : recipe.placement === "water"
              ? 12
              : recipe.placement === "landmark"
                ? 13
                : 6;
        let x = 0,
          z = 0,
          found = false;
        for (let attempt = 0; attempt < 4; attempt++) {
          const offset = base + attempt * 3.5;
          x = point.x + nx * offset;
          z = point.z + nz * offset;
          if (recipe.placement === "backdrop") {
            x = point.x - 32 - (j % 3) * 8 - attempt * 8;
            z = point.z - 95 - attempt * 14;
          }
          if (reserved(x, z)) continue;
          if (
            recipe.placement !== "backdrop" &&
            this.props.some(
              (g) =>
                Math.hypot(g.position.x - x, g.position.z - z) <
                recipe.footprint + 1.9,
            )
          )
            continue;
          found = true;
          break;
        }
        if (!found) continue;
        const g = this.kit.create(recipe.id);
        g.position.set(x, recipe.placement === "water" ? -0.28 : 0, z);
        g.rotation.y = Math.atan2(-nx, -nz);
        g.userData.range = recipe.placement === "backdrop" ? 235 : 165;
        if (recipe.placement !== "water") {
          const radius =
            recipe.placement === "backdrop"
              ? recipe.footprint
              : recipe.footprint + 1;
          this.kit.mesh(
            g,
            "cylinder",
            "#83968a",
            0,
            -0.36,
            0,
            radius,
            0.55,
            radius * 0.85,
          );
        }
        if (recipe.placement === "backdrop") {
          g.rotation.y = 0;
          g.scale.multiplyScalar(0.72 + random() * 0.12);
        }
        const offsets: Vec3[] = [
          [0, 0, 0],
          [nx * 12, 0, nz * 12],
          [nx * 30, 0, nz * 30],
          [nx * 60, 0, nz * 60],
        ];
        if (this.placeProp(g, `recipe/${recipe.id}`, offsets)) total++;
      }
    }
  }
}
