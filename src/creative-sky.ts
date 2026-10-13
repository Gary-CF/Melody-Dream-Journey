import * as T from "three";
import type { LightFrame } from "./domain/lighting-timeline";

/** One world-space sky shared by both player cameras. Atmosphere values, never song IDs. */
export class CreativeSky {
  readonly mesh: T.Mesh;
  private readonly material: T.ShaderMaterial;
  constructor(root: T.Object3D) {
    this.material = new T.ShaderMaterial({
      depthWrite: false,
      side: T.BackSide,
      fog: false,
      uniforms: {
        uSky: { value: new T.Color() },
        uHorizon: { value: new T.Color() },
        uLight: { value: new T.Color() },
        uNight: { value: 0 },
        uCloud: { value: 0 },
        uTime: { value: 0 },
        uSun: { value: new T.Vector3(-0.3, 0.2, -1).normalize() },
        uMoon: { value: new T.Vector3(0.03, 0.3, -1).normalize() },
        uMoonRadius: { value: 0.036 },
      },
      vertexShader: `varying vec3 vDirection;void main(){vDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
        varying vec3 vDirection;
        uniform vec3 uSky,uHorizon,uLight,uSun,uMoon;
        uniform float uNight,uCloud,uTime,uMoonRadius;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        void main(){
          vec3 d=normalize(vDirection);
          float elevation=smoothstep(-.04,.8,d.y);
          vec3 zenith=uSky*mix(.78,.4,uNight);
          vec3 c=mix(uHorizon,zenith,pow(elevation,.65));
          float glow=pow(max(0.,dot(d,normalize(uSun))),10.);
          c+=uLight*glow*.22*(1.-uNight)*(1.-uCloud);
          vec2 uv=vec2(atan(d.x,d.z)*.1591549+.5,asin(d.y)*.3183099+.5);
          vec2 cloudUV=vec2(uv.x*10.+uTime*.001,uv.y*24.);
          float wisps=noise(cloudUV)*.65+noise(cloudUV*2.7)*.35;
          float band=smoothstep(.03,.22,d.y)*(1.-smoothstep(.55,.9,d.y));
          float clouds=smoothstep(.45,.79,wisps)*band*uCloud*.75;
          c=mix(c,uSky*mix(1.5,.65,uNight),clouds);
          vec2 starGrid=uv*vec2(520.,260.);
          vec2 cell=floor(starGrid),f=fract(starGrid)-.5;
          float star=step(.994,hash(cell))*pow(max(0.,1.-length(f)*2.8),4.);
          star*=smoothstep(.02,.3,d.y)*uNight*(1.-uCloud)*(.75+.25*sin(uTime*.5+hash(cell)*20.));
          c+=vec3(.55,.65,.8)*star;
          // Celestial bodies live at angular infinity: no nearby faceted sphere
          // floats among the landscape, and both player cameras see one sky.
          float sd=length(d-normalize(uSun));
          float sunDisc=1.-smoothstep(.013,.017,sd);
          float sunHalo=exp(-sd*28.)*.12;
          float daylight=(1.-smoothstep(.25,.7,uNight))*(1.-uCloud);
          c+=vec3(1.,.76,.46)*(sunDisc*1.8+sunHalo)*daylight;
          float md=length(d-normalize(uMoon));
          float moonDisc=1.-smoothstep(uMoonRadius*.94,uMoonRadius,md);
          float moonLight=smoothstep(.35,.8,uNight)*(1.-uCloud);
          c=mix(c,vec3(.78,.85,.96),moonDisc*moonLight*.9);
          c+=vec3(.30,.38,.52)*exp(-md*23.)*moonLight*.15;
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new T.Mesh(new T.SphereGeometry(350, 48, 24), this.material);
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
    root.add(this.mesh);
  }
  update(
    time: number,
    center: T.Vector3,
    light: LightFrame,
    cloud: number,
    sunDirection: T.Vector3,
    moonDirection: T.Vector3,
    moonSize: number,
  ) {
    this.mesh.position.copy(center);
    const u = this.material.uniforms;
    u.uSky.value.setRGB(...light.sky);
    u.uHorizon.value
      .setRGB(...light.sky)
      .lerp(new T.Color().setRGB(...light.light), 0.24 * (1 - light.night))
      .multiplyScalar(1.08 - light.night * 0.15);
    u.uLight.value.setRGB(...light.light);
    u.uNight.value = light.night;
    u.uCloud.value = cloud;
    u.uTime.value = time;
    u.uSun.value.copy(sunDirection).normalize();
    u.uMoon.value.copy(moonDirection).normalize();
    u.uMoonRadius.value = moonSize * 0.012;
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
  }
}
