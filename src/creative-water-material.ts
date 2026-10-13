import * as T from "three";
import type { VisualEffect } from "./domain/visual-effects";

/** Render-only water treatment. Geometry, placement and archived recipes stay independent. */
export function creativeWaterMaterial(spec: VisualEffect) {
  return new T.ShaderMaterial({
    transparent: true,
    side: T.DoubleSide,
    depthWrite: false,
    fog: true,
    uniforms: {
      uTime: { value: 0 },
      uMist: { value: spec.kind === "water-mist" ? 1 : 0 },
      uSeed: { value: (spec.seed % 65521) / 997 },
      uColor: { value: new T.Color(spec.color) },
      uIllumination: { value: new T.Color(1, 1, 1) },
      ...T.UniformsUtils.clone(T.UniformsLib.fog),
    },
    vertexShader: `varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `varying vec2 vUv;
      uniform float uTime;uniform float uMist;uniform float uSeed;
      uniform vec3 uColor;uniform vec3 uIllumination;
      #include <fog_pars_fragment>
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uSeed)*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
      float turbulence(vec2 p){return noise(p)*.57+noise(p*2.07)*.28+noise(p*4.13)*.15;}
      void main(){
        float descent=1.-vUv.y;
        float edgeNoise=turbulence(vec2(vUv.y*5.-uTime*.37,uSeed));
        float drift=sin(vUv.y*9.+uTime*.4+uSeed)*.017*descent;
        float x=vUv.x+drift;
        float width=.34+descent*.10+(edgeNoise-.5)*.055;
        float edge=1.-smoothstep(width-.05,width,abs(x-.5));
        float ribbons=turbulence(vec2(x*36.,vUv.y*3.+uTime*2.3));
        float fine=noise(vec2(x*110.,vUv.y*18.+uTime*7.));
        float flow=turbulence(vec2(x*7.,vUv.y*24.+uTime*5.8));
        float channels=smoothstep(.24,.64,ribbons);
        float foam=smoothstep(.57,.9,flow)*(.2+descent*.45)+pow(descent,5.)*.4;
        vec3 deep=mix(uColor,vec3(.18,.39,.44),.22);
        vec3 highlight=mix(uColor,vec3(.90,.98,1.),.66);
        vec3 color=mix(deep,highlight,clamp(channels*.55+fine*.13+foam,0.,1.));
        float alpha=edge*(.19+channels*.52+foam*.27);
        alpha*=smoothstep(0.,.07,vUv.y)*smoothstep(0.,.015,1.-vUv.y);
        if(uMist>.5){
          vec2 p=(vUv-.5)*2.;
          p.x+=sin(uTime*.35+p.y*3.)*.06;
          float shape=max(0.,1.-dot(p,p));
          float wisps=turbulence(vec2(p.x*3.-uTime*.18,p.y*3.-uTime*.23));
          alpha=shape*shape*smoothstep(.23,.7,wisps)*.4;
          color=mix(uColor,vec3(.93,.98,1.),.7);
        }
        gl_FragColor=vec4(color*uIllumination,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}
