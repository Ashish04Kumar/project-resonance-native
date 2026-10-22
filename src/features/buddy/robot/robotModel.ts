import { BufferAttribute, Color, type BufferGeometry } from 'three';

/**
 * gg2.glb is a single mesh with positions only: no colours, normals, UVs or separate
 * eye/mouth parts. These helpers give it smooth shading and paint regions by position.
 * The face (screen, eyes, mouth) is drawn as separate overlay shapes in RobotFace.
 *
 * Measurements below are in the model's own units (y up, the face looks toward +z),
 * taken from gg2-mobile.glb (gg2-head.glb is cut from it, so they match).
 */
export const FACE = {
  /**
   * Centre of the face screen. x/y and the size below are a fit to the outer edge of the
   * groove around the screen in the model (where the peach bezel starts), so the panel
   * covers the groove and meets the bezel with no gap, corners included. Each corner is
   * within about 0.004 of the measured edge. z sits just in front of the screen's highest
   * point (0.263), so the panel doesn't appear to slide when the head turns.
   */
  center: { x: 0.15, y: 0.425, z: 0.2645 },
  /** Half size of the screen up to where the bezel starts, and its corner radius. */
  halfWidth: 0.42,
  halfHeight: 0.385,
  radius: 0.24,
} as const;

/** Centre of the head (gg2-head.glb), used to put it in the middle of the view. */
export const MODEL_CENTER = { x: 0.153, y: 0.45, z: 0 } as const;

const SHELL = new Color('#F6CDB6');
const SHELL_SHADE = new Color('#E8AE97');
const SCREEN = new Color('#2B0A12');
const NECK = new Color('#5A2630');
const EAR = new Color('#DE9E90');
const ANTENNA_TIP = new Color('#FF8A7A');

function insideRoundedRect(x: number, y: number, cx: number, cy: number, halfW: number, halfH: number, radius: number): boolean {
  const dx = Math.max(Math.abs(x - cx) - (halfW - radius), 0);
  const dy = Math.max(Math.abs(y - cy) - (halfH - radius), 0);
  return Math.abs(x - cx) <= halfW && Math.abs(y - cy) <= halfH && dx * dx + dy * dy <= radius * radius;
}

function regionColor(x: number, y: number, z: number, normalZ: number): Color {
  const facesFront = z > 0.2 && normalZ > 0.5;
  // Paint the screen maroon only a little inside the panel's edge. Colours blend across
  // each triangle, so painting up to (or past) the edge would leave dark jagged spikes in
  // the groove; this way the blend stays hidden under the panel and the groove reads as
  // a clean peach rim.
  const inset = 0.03;
  if (facesFront && insideRoundedRect(x, y, FACE.center.x, FACE.center.y, FACE.halfWidth - inset, FACE.halfHeight - inset, FACE.radius - inset)) return SCREEN;
  const isEar = (x < -0.4 || x > 0.7) && y > 0.12;
  if (isEar) return y > 0.78 ? ANTENNA_TIP : EAR;
  if (y > -0.13 && y < -0.03 && Math.abs(x - FACE.center.x) < 0.2) return NECK;
  // Slightly deeper peach on the hands and lower body, like soft shading in the reference.
  if (x < -0.62 || x > 0.66 || y < -0.7) return SHELL_SHADE;
  return SHELL;
}

/** Adds smooth normals and region colours to the model geometry (once, after loading). */
export function prepareRobotGeometry(geometry: BufferGeometry): BufferGeometry {
  geometry.computeVertexNormals();
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const colors = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const color = regionColor(position.getX(index), position.getY(index), position.getZ(index), normal.getZ(index));
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}
