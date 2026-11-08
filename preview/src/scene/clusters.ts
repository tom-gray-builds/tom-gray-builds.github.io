/**
 * Two distant globular clusters, placed so the opening camera (desktop and
 * phone, including short landscape) sees both in the sky above the planets.
 * They are fixed in space. The guided camera tracks the planets, so they
 * drift across the sky as the system turns, the way a real background does.
 */
export type Cluster = {
  x: number;
  y: number;
  z: number;
  scale: number;
  seed: number;
};

export const CLUSTERS: Cluster[] = [
  { x: 133.55, y: -39.57, z: -117.65, scale: 11, seed: 1.7 },
  { x: 149.8, y: -34.13, z: -78.4, scale: 8.6, seed: 4.2 },
];

/** Matches the point-size expression in clusterVertexShader. */
export const CLUSTER_SIZE_NEAR = 360;
export const CLUSTER_SIZE_MIN = 0.7;
export const CLUSTER_SIZE_MAX = 2.45;

export function clusterStarSize(luminosity: number, distance: number): number {
  const raw = (0.42 + luminosity * 0.55) * (CLUSTER_SIZE_NEAR / Math.max(distance, 1));
  return Math.min(CLUSTER_SIZE_MAX, Math.max(CLUSTER_SIZE_MIN, raw));
}

export function clusterVertexShader(): string {
  return /* glsl */ `
    attribute float aLum;
    varying vec3 vColor;
    void main() {
      vColor = color * aLum;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float dist = max(-mv.z, 1.0);
      gl_PointSize = clamp((0.42 + aLum * 0.55) * (${CLUSTER_SIZE_NEAR}.0 / dist), ${CLUSTER_SIZE_MIN}, ${CLUSTER_SIZE_MAX});
      gl_Position = projectionMatrix * mv;
    }
  `;
}

export function clusterFragmentShader(): string {
  return /* glsl */ `
    varying vec3 vColor;
    void main() {
      vec2 p = gl_PointCoord - vec2(0.5);
      float d = length(p) * 2.0;
      if (d > 1.0) discard;
      float alpha = exp(-d * d * 2.8);
      gl_FragColor = vec4(vColor * 0.58, alpha * 0.48);
    }
  `;
}
