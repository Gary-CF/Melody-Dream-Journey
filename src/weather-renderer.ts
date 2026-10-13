import * as T from "three";
import type { WeatherState } from "./weather";
import { glowTexture, glowSprite } from "./glow";
export class WeatherRenderer {
  rain: T.LineSegments;
  glowMap = glowTexture();
  halos = Array.from({ length: 4 }, () =>
    glowSprite(this.glowMap, "#ffd7a1", 3.8, 0),
  );
  lights = Array.from(
    { length: 4 },
    () => new T.PointLight("#ffbd78", 0, 16, 2),
  );
  constructor(root: T.Group) {
    const positions: number[] = [],
      seeds: number[] = [];
    for (let i = 0; i < 1800; i++)
      for (const y of [0, 1]) {
        positions.push(0, y, 0);
        seeds.push(
          (i * 0.61803398875) % 1,
          (i * 0.754877666) % 1,
          (i * 0.569840291) % 1,
        );
      }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    geo.setAttribute("seed", new T.Float32BufferAttribute(seeds, 3));
    const mat = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        time: { value: 0 },
        strength: { value: 0 },
        center: { value: new T.Vector3() },
        shelter: { value: new T.Vector4(0, 0, 0, 0) },
      },
      vertexShader: `attribute vec3 seed;uniform float time;uniform vec3 center;varying float fade;varying vec3 world;void main(){vec3 p=vec3(seed.x*70.-35.,mod(seed.y*28.-time*(10.+seed.z*7.),28.),seed.z*70.-35.);p.x+=p.y*.12;p+=vec3(floor(center.x/5.)*5.,0.,floor(center.z/5.)*5.);p.y+=position.y*.5;fade=.35+seed.y*.5;world=p;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
      fragmentShader: `uniform float strength;uniform vec4 shelter;varying float fade;varying vec3 world;void main(){if(shelter.z>0.&&abs(world.x-shelter.x)<shelter.z&&abs(world.z-shelter.y)<shelter.w)discard;gl_FragColor=vec4(.73,.84,.94,fade*strength*.52);}`,
    });
    this.rain = new T.LineSegments(geo, mat);
    this.rain.frustumCulled = false;
    root.add(this.rain, ...this.lights);
    this.lights.forEach((light, i) => light.add(this.halos[i]));
  }
  update(
    time: number,
    state: WeatherState,
    pos: T.Vector3,
    night: number,
    lamps: T.Vector3[],
  ) {
    const mat = this.rain.material as T.ShaderMaterial;
    mat.uniforms.time.value = time;
    mat.uniforms.strength.value = state.rain;
    mat.uniforms.center.value.copy(pos);
    this.rain.visible = state.rain > 0.015;
    const near = [...lamps].sort(
      (a, b) => a.distanceToSquared(pos) - b.distanceToSquared(pos),
    );
    this.lights.forEach((light, i) => {
      const p = near[i];
      light.visible = !!p;
      if (p) light.position.copy(p);
      light.intensity = (night * 0.9 + state.cloud * 0.35) * 45;
      this.halos[i].material.opacity = night * 0.4 + state.fog * 0.1;
    });
  }
  dispose() {
    this.rain.geometry.dispose();
    (this.rain.material as T.Material).dispose();
    this.halos.forEach((s) => s.material.dispose());
    this.glowMap.dispose();
  }
  inspect() {
    const uniforms = (this.rain.material as T.ShaderMaterial).uniforms;
    return {
      rainVisible: this.rain.visible,
      strength: uniforms.strength.value,
      shelter: uniforms.shelter.value.toArray(),
      litLamps: this.lights.filter((l) => l.visible && l.intensity > 0).length,
    };
  }
}
