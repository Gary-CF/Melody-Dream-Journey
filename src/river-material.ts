import * as T from "three";

/** Stylized sky/light reflection on a shared world-space river. This is not
 * screen-space or planar reflection of buildings; no extra render pass. */
export function riverMaterial() {
  return new T.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new T.Color("#6eaaaa") },
      uMoon: { value: new T.Vector2() },
      uNight: { value: 0 },
      uRain: { value: 0 },
      uFog: { value: new T.Color() },
      uSky: { value: new T.Color() },
      uLight: { value: new T.Color() },
      uKeyDirection: { value: new T.Vector3(0, 0.3, -1).normalize() },
      uDarkness: { value: 0 },
      uCloud: { value: 0 },
    },
    vertexShader: `varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
    fragmentShader: `
      uniform float uTime,uNight,uRain,uDarkness,uCloud;
      uniform vec3 uColor,uFog,uSky,uLight,uKeyDirection;
      varying vec3 vWorld;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec3 view=normalize(cameraPosition-vWorld);
        float distanceToEye=length(vWorld.xz-cameraPosition.xz);
        float fineFade=1.-smoothstep(24.,100.,distanceToEye);
        float a=vWorld.x*.83+vWorld.z*.37+uTime*.65;
        float b=vWorld.x*-.24+vWorld.z*1.17-uTime*.46;
        float c=vWorld.x*2.9+vWorld.z*1.53+uTime*1.1;
        vec3 normal=normalize(vec3(cos(a)*.035+cos(c)*.012*fineFade,1.,cos(b)*.053+cos(c)*.009*fineFade));
        float fresnel=pow(1.-clamp(dot(view,normal),0.,1.),4.);
        vec3 sky=mix(uSky*.75,uSky*1.2,clamp(reflect(-view,normal).y,0.,1.));
        vec3 water=uColor*(.73+.09*sin(a)*sin(b));
        vec3 color=mix(water,sky,clamp(.16+fresnel*.55,0.,.82));
        vec3 halfVector=normalize(view+normalize(uKeyDirection));
        float alignment=max(0.,dot(normal,halfVector));
        float fine=pow(alignment,420.);
        float broad=pow(alignment,65.);
        float broken=.42+.58*pow(max(0.,sin(b*2.1+sin(a))),2.);
        vec3 key=mix(uLight,vec3(.65,.77,1.),uDarkness*.7);
        color+=key*(fine*.8+broad*.085)*broken*(1.-uCloud*.85)*(.35+uNight*.8);
        vec2 cell=floor(vWorld.xz*.5),uv=fract(vWorld.xz*.5)-.5;
        float phase=fract(uTime*.67+hash(cell));
        float ring=1.-smoothstep(.015,.043,abs(length(uv)-phase*.65));
        color+=vec3(.08)*ring*(1.-phase)*uRain*fineFade;
        float horizon=smoothstep(48.,190.,distanceToEye);
        color=mix(color,uFog,horizon*.86);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
