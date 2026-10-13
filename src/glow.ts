import * as T from "three";
// A restrained local halo, not a replacement for the PointLight that illuminates surfaces.
export function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!,
    gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,0.8)");
  gradient.addColorStop(0.14, "rgba(255,255,255,0.35)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.09)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(canvas);
}
export function glowSprite(
  texture: T.Texture,
  color: string,
  size: number,
  opacity: number,
) {
  const material = new T.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: T.AdditiveBlending,
    toneMapped: false,
  });
  const sprite = new T.Sprite(material);
  sprite.scale.set(size, size, 1);
  return sprite;
}
