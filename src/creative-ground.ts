import * as T from "three";

/** A world-space material, not extra scene objects. It follows the same light,
 * fog and weather as the rest of the world and owns its GPU resources. */
export class CreativeGround extends T.Mesh<
  T.PlaneGeometry,
  T.MeshStandardMaterial
> {
  private readonly wetness = { value: 0 };
  constructor(seed: number) {
    const material = new T.MeshStandardMaterial({
      color: "#899c87",
      roughness: 1,
    });
    super(new T.PlaneGeometry(12000, 12000), material);
    const seedUniform = { value: (seed % 997) * 0.137 };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uGroundWet = this.wetness;
      shader.uniforms.uGroundSeed = seedUniform;
      shader.vertexShader =
        `varying vec3 vGroundWorld;\n${shader.vertexShader}`.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vGroundWorld=(modelMatrix*vec4(position,1.)).xyz;`,
        );
      shader.fragmentShader = `
        varying vec3 vGroundWorld;
        uniform float uGroundWet,uGroundSeed;
        float groundHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uGroundSeed)*43758.5453);}
        float groundNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(groundHash(i),groundHash(i+vec2(1,0)),f.x),mix(groundHash(i+vec2(0,1)),groundHash(i+vec2(1,1)),f.x),f.y);}
        ${shader.fragmentShader}`
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          vec2 terrain=vGroundWorld.xz;
          float broad=groundNoise(terrain*.065);
          float grain=groundNoise(terrain*2.4);
          float distanceFade=1.-smoothstep(20.,95.,length(vGroundWorld-cameraPosition));
          float variation=.88+broad*.22+(grain-.5)*.11*distanceFade;
          float damp=smoothstep(.37,.65,groundNoise(terrain*.19))*uGroundWet;
          diffuseColor.rgb*=variation*(1.-damp*.17);`,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
          roughnessFactor=mix(roughnessFactor,.34,damp*.8);`,
        );
    };
    material.customProgramCacheKey = () => "creative-ground-v1";
    this.rotation.x = -Math.PI / 2;
    this.position.y = -0.05;
    this.receiveShadow = true;
    this.userData.noBatch = true;
  }
  updateWetness(wet: number) {
    this.wetness.value = T.MathUtils.clamp(wet, 0, 1);
  }
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.removeFromParent();
  }
}
