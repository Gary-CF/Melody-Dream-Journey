/** Shared physical dimensions for the visible observer and its attached eye.
 * The eye has a minimum height for readability when the character is small.
 * Reserve their union so a low canopy cannot clear the hat but clip the camera.
 */
export const observerCameraRadius = 0.18;
export function observerSpace(scale: number) {
  const groundY = 0.23;
  const eyeHeight = Math.max(1.25, 1.18 * scale);
  return {
    eyeY: groundY + eyeHeight,
    travelEnvelope: {
      groundY,
      radius: Math.max(scale * 0.43 + 0.12, observerCameraRadius),
      height: Math.max(
        scale * 1.95 + 0.12,
        eyeHeight + observerCameraRadius + 0.02,
      ),
    },
  };
}
