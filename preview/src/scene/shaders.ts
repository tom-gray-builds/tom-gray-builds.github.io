export const NOISE = /* glsl */ `
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return v;
}
vec3 starLight(vec3 n, vec3 world, vec3 starA, vec3 starB, vec3 colorA, vec3 colorB) {
  vec3 light = vec3(0.03, 0.032, 0.045);
  vec3 spos[2];
  spos[0] = starA;
  spos[1] = starB;
  vec3 scol[2];
  scol[0] = colorA;
  scol[1] = colorB;
  for (int i = 0; i < 2; i++) {
    vec3 to = spos[i] - world;
    float dist = length(to);
    vec3 L = to / max(dist, 0.001);
    float ndl = clamp(dot(n, L), 0.0, 1.0);
    float wrap = clamp(dot(n, L) * 0.4 + 0.25, 0.0, 1.0);
    float atten = 5.2 / (1.0 + dist * dist * 0.1);
    light += scol[i] * (ndl * 0.9 + wrap * 0.1) * atten;
  }
  return light;
}
`;

export const PLANET_VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vNormal;
uniform float uDisplace;
${NOISE}
void main() {
  vec3 p = position;
  float h = fbm(p * 2.1);
  p += normal * (h - 0.48) * uDisplace;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vObj = p;
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const OCEAN_FRAG = /* glsl */ `
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vNormal;
uniform vec3 uStarA;
uniform vec3 uStarB;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uCamera;
${NOISE}
void main() {
  vec3 n = normalize(vNormal);
  vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), n));
  vec3 b = cross(n, t);
  float h = fbm(normalize(vObj) * 2.4);
  float hx = fbm(normalize(vObj + t * 0.02) * 2.4);
  float hy = fbm(normalize(vObj + b * 0.02) * 2.4);
  n = normalize(n + t * (hx - h) * 2.4 + b * (hy - h) * 2.4);
  float land = smoothstep(0.5, 0.58, h);
  float shore = smoothstep(0.46, 0.54, h);
  vec3 deep = vec3(0.015, 0.06, 0.13);
  vec3 shoal = vec3(0.05, 0.32, 0.34);
  vec3 sand = vec3(0.72, 0.62, 0.42);
  vec3 green = vec3(0.16, 0.28, 0.13);
  vec3 rock = vec3(0.34, 0.30, 0.26);
  vec3 snow = vec3(0.9, 0.92, 0.94);
  vec3 ground = mix(sand, mix(green, rock, smoothstep(0.62, 0.78, h)), smoothstep(0.55, 0.66, h));
  ground = mix(ground, snow, smoothstep(0.8, 0.92, h));
  float detail = fbm(vObj * 9.0);
  ground *= 0.86 + detail * 0.28;
  vec3 water = mix(deep, shoal, smoothstep(0.32, 0.5, h));
  water *= 0.9 + fbm(vObj * 14.0) * 0.15;
  vec3 albedo = mix(water, ground, land);
  albedo = mix(albedo, sand, shore * (1.0 - land) * 0.65);
  vec3 light = starLight(n, vWorld, uStarA, uStarB, uColorA, uColorB);
  vec3 view = normalize(uCamera - vWorld);
  vec3 spec = vec3(0.0);
  vec3 stars[2];
  stars[0] = uStarA; stars[1] = uStarB;
  vec3 cols[2];
  cols[0] = uColorA; cols[1] = uColorB;
  for (int i = 0; i < 2; i++) {
    vec3 L = normalize(stars[i] - vWorld);
    vec3 H = normalize(L + view);
    float shine = pow(clamp(dot(n, H), 0.0, 1.0), 90.0);
    spec += cols[i] * shine * (1.0 - land) * 0.85;
  }
  vec3 color = albedo * light + spec;
  gl_FragColor = vec4(color, 1.0);
}
`;

export const ROCKY_FRAG = /* glsl */ `
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vNormal;
uniform vec3 uStarA;
uniform vec3 uStarB;
uniform vec3 uColorA;
uniform vec3 uColorB;
${NOISE}
void main() {
  vec3 n = normalize(vNormal);
  vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), n));
  vec3 b = cross(n, t);
  vec3 dir = normalize(vObj);
  float h = fbm(dir * 3.1);
  float hx = fbm(normalize(vObj + t * 0.015) * 3.1);
  float hy = fbm(normalize(vObj + b * 0.015) * 3.1);
  n = normalize(n + t * (hx - h) * 3.2 + b * (hy - h) * 3.2);
  float crater = 0.0;
  crater += smoothstep(0.16, 0.07, length(dir - normalize(vec3(0.6, 0.2, 0.5)))) * smoothstep(0.02, 0.07, length(dir - normalize(vec3(0.6, 0.2, 0.5))));
  crater += smoothstep(0.12, 0.05, length(dir - normalize(vec3(-0.4, 0.55, 0.3))));
  crater += smoothstep(0.1, 0.04, length(dir - normalize(vec3(0.1, -0.7, 0.4))));
  vec3 dust = vec3(0.55, 0.36, 0.22);
  vec3 basalt = vec3(0.16, 0.13, 0.12);
  vec3 highland = vec3(0.62, 0.5, 0.4);
  vec3 albedo = mix(basalt, mix(dust, highland, smoothstep(0.4, 0.75, h)), smoothstep(0.25, 0.6, h));
  albedo = mix(albedo, vec3(0.08, 0.07, 0.07), crater * 0.75);
  albedo *= 0.82 + fbm(vObj * 12.0) * 0.36;
  vec3 light = starLight(n, vWorld, uStarA, uStarB, uColorA, uColorB);
  gl_FragColor = vec4(albedo * light, 1.0);
}
`;

export const GIANT_FRAG = /* glsl */ `
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vNormal;
uniform vec3 uStarA;
uniform vec3 uStarB;
uniform vec3 uColorA;
uniform vec3 uColorB;
${NOISE}
void main() {
  vec3 n = normalize(vNormal);
  float y = n.y;
  float warp = fbm(vec3(n.x * 2.0, y * 6.0, n.z * 2.0));
  float bands = sin((y * 16.0 + warp * 1.6) * 3.14159);
  float slow = sin(y * 6.0 + warp);
  vec3 tan = vec3(0.62, 0.42, 0.24);
  vec3 cream = vec3(0.9, 0.82, 0.68);
  vec3 rust = vec3(0.42, 0.24, 0.14);
  vec3 pale = vec3(0.78, 0.74, 0.7);
  vec3 albedo = mix(rust, mix(tan, cream, bands * 0.5 + 0.5), slow * 0.5 + 0.5);
  albedo = mix(albedo, pale, smoothstep(0.55, 0.9, abs(y)));
  float storm = smoothstep(0.11, 0.02, length(n - normalize(vec3(0.55, 0.28, 0.55))));
  albedo = mix(albedo, vec3(0.93, 0.86, 0.74), storm);
  albedo *= 0.92 + fbm(n * 18.0) * 0.12;
  vec3 light = starLight(n, vWorld, uStarA, uStarB, uColorA, uColorB);
  gl_FragColor = vec4(albedo * light, 1.0);
}
`;

export const CLOUD_FRAG = /* glsl */ `
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vNormal;
uniform vec3 uStarA;
uniform vec3 uStarB;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uTime;
${NOISE}
void main() {
  vec3 n = normalize(vNormal);
  float c = fbm(normalize(vObj) * 3.2 + vec3(uTime * 0.012, 0.0, 0.0));
  float c2 = fbm(normalize(vObj) * 7.0);
  float alpha = smoothstep(0.4, 0.66, c) * 0.82;
  alpha *= 0.65 + c2 * 0.5;
  vec3 light = starLight(n, vWorld, uStarA, uStarB, uColorA, uColorB);
  vec3 col = vec3(0.95, 0.96, 0.98) * light;
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

export const AIR_FRAG = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorld;
uniform vec3 uCamera;
uniform vec3 uTint;
void main() {
  vec3 n = normalize(vNormal);
  vec3 view = normalize(uCamera - vWorld);
  float fres = pow(1.0 - clamp(dot(n, view), 0.0, 1.0), 3.4);
  gl_FragColor = vec4(uTint, fres * 0.38);
}
`;

export const AIR_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const RING_FRAG = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
uniform vec3 uStarA;
uniform vec3 uStarB;
uniform vec3 uColorA;
uniform vec3 uColorB;
${NOISE}
void main() {
  float radial = vUv.y;
  float angle = vUv.x * 6.28318;
  float gap = smoothstep(0.035, 0.0, abs(radial - 0.58));
  float gap2 = smoothstep(0.02, 0.0, abs(radial - 0.78));
  float grain = fbm(vec3(cos(angle) * radial * 8.0, sin(angle) * radial * 8.0, radial * 20.0));
  float alpha = (0.25 + 0.75 * grain) * (1.0 - gap) * (1.0 - gap2 * 0.85);
  alpha *= smoothstep(0.0, 0.04, radial) * smoothstep(1.0, 0.9, radial);
  vec3 albedo = mix(vec3(0.45, 0.38, 0.3), vec3(0.78, 0.7, 0.58), grain);
  vec3 n = vec3(0.0, 1.0, 0.0);
  vec3 light = starLight(n, vWorld, uStarA, uStarB, uColorA, uColorB);
  if (alpha < 0.03) discard;
  gl_FragColor = vec4(albedo * light, alpha * 0.92);
}
`;

export const RING_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const STAR_FRAG = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vObj;
uniform vec3 uColor;
uniform vec3 uCamera;
uniform float uTime;
${NOISE}
void main() {
  vec3 n = normalize(vNormal);
  vec3 view = normalize(uCamera - vWorld);
  float limb = pow(clamp(dot(n, view), 0.0, 1.0), 0.4);
  float gran = fbm(vObj * 10.0 + uTime * 0.04);
  vec3 col = uColor * (0.72 + gran * 0.4) * (0.55 + limb);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const STAR_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vObj;
void main() {
  vObj = position;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const CORONA_FRAG = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorld;
uniform vec3 uColor;
uniform vec3 uCamera;
void main() {
  vec3 n = normalize(vNormal);
  vec3 view = normalize(uCamera - vWorld);
  float fres = pow(1.0 - clamp(dot(n, view), 0.0, 1.0), 1.7);
  gl_FragColor = vec4(uColor, fres * 0.55);
}
`;

export const SKY_FRAG = /* glsl */ `
varying vec3 vDir;
${NOISE}
void main() {
  vec3 dir = normalize(vDir);
  float a = fbm(dir * 1.35);
  float b = fbm(dir * 2.6 + 5.0);
  float c = fbm(dir * 0.65 + 11.0);
  float d = fbm(dir * 4.2);
  vec3 col = vec3(0.012, 0.014, 0.025);
  col += vec3(0.02, 0.22, 0.32) * smoothstep(0.32, 0.82, a) * 1.45;
  col += vec3(0.55, 0.1, 0.22) * smoothstep(0.4, 0.88, b) * 1.15;
  col += vec3(0.62, 0.34, 0.08) * smoothstep(0.48, 0.9, c) * 0.95;
  col += vec3(0.18, 0.1, 0.32) * smoothstep(0.55, 0.9, d) * 0.55;
  float lane = exp(-pow((dir.y * 0.72 + dir.x * 0.18) / 0.11, 2.0));
  col += vec3(0.32, 0.26, 0.42) * lane * (0.35 + a);
  col *= 0.62 + 0.5 * smoothstep(0.15, 0.75, a);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const GALAXY_FRAG = /* glsl */ `
varying vec2 vUv;
${NOISE}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float ang = atan(p.y, p.x);
  float arm = sin(ang * 3.0 - r * 9.0);
  float disk = smoothstep(1.0, 0.15, r);
  float core = smoothstep(0.45, 0.0, r);
  float dust = fbm(vec3(p * 3.0, ang));
  float alpha = disk * (0.25 + 0.55 * smoothstep(0.2, 0.8, arm * 0.5 + 0.5) + core) * (0.55 + dust * 0.5);
  vec3 col = mix(vec3(0.25, 0.32, 0.55), vec3(0.95, 0.86, 0.7), core);
  col = mix(col, vec3(0.7, 0.45, 0.35), dust * disk * 0.35);
  gl_FragColor = vec4(col, alpha * 0.85);
}
`;
