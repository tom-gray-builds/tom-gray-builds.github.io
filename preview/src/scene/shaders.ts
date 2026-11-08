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
uniform float uGain;
void main() {
  vec3 n = normalize(vNormal);
  vec3 view = normalize(uCamera - vWorld);
  float fres = pow(1.0 - clamp(dot(n, view), 0.0, 1.0), 3.4);
  gl_FragColor = vec4(uTint, fres * uGain);
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
varying float vRadius;
varying vec3 vWorld;
varying vec3 vNormal;
uniform vec3 uStarA;
uniform vec3 uStarB;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uPlanet;
uniform float uInner;
uniform float uOuter;
uniform float uBody;
${NOISE}
void main() {
  float radial = clamp((vRadius - uInner) / max(uOuter - uInner, 0.001), 0.0, 1.0);
  float grain = fbm(vec3(radial * 46.0, vWorld.x * 0.15, 2.0));
  float gap = smoothstep(0.018, 0.0, abs(radial - 0.36));
  gap = max(gap, smoothstep(0.012, 0.0, abs(radial - 0.71)));
  float dust = smoothstep(0.02, 0.08, radial) * smoothstep(0.98, 0.9, radial);
  dust *= 1.0 - gap;
  if (dust < 0.08) discard;
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 light = starLight(n, vWorld, uStarA, uStarB, uColorA, uColorB);
  vec3 albedo = mix(vec3(0.55, 0.72, 0.74), vec3(0.32, 0.28, 0.24), grain);
  albedo = mix(albedo, vec3(0.72, 0.7, 0.62), smoothstep(0.62, 0.8, grain) * 0.35);
  vec3 color = albedo * dust * (0.55 + light);
  vec3 toSun = normalize(uStarA - uPlanet);
  vec3 rel = vWorld - uPlanet;
  float along = dot(rel, toSun);
  if (along < 0.0) {
    float occ = 1.0 - smoothstep(uBody * 0.92, uBody * 1.2, length(rel - toSun * along));
    color *= 1.0 - occ * 0.78;
  }
  gl_FragColor = vec4(color, 0.55 + grain * 0.35);
}
`;

export const RING_VERT = /* glsl */ `
varying float vRadius;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vRadius = length(position.xy);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const STAR_FRAG = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vObj;
uniform vec3 uColor;
uniform vec3 uCamera;
uniform vec3 uFlareDir;
uniform float uTime;
uniform float uSeed;
uniform float uFlareAmt;
uniform float uRadiance;
${NOISE}
void main() {
  vec3 n = normalize(vNormal);
  vec3 view = normalize(uCamera - vWorld);
  vec3 p = normalize(vObj);
  vec3 flow = vec3(
    fbm(p * 1.7 + vec3(uTime * 0.033, uSeed, 0.4)),
    fbm(p * 1.7 + vec3(2.2, uTime * 0.027, uSeed)),
    fbm(p * 1.9 + vec3(uSeed * 0.5, 3.1, -uTime * 0.024))
  );
  vec3 q = p + (flow - 0.5) * 0.62;
  float gran = fbm(q * 8.0 + vec3(uTime * 0.045, uSeed, 0.0));
  float fine = fbm(q * 20.0 + vec3(1.4, uTime * 0.07, uSeed));
  float large = fbm(q * 3.1 + vec3(uTime * 0.011, 2.0, uSeed));
  float spot = smoothstep(0.64, 0.8, fbm(q * 1.8 + vec3(uSeed * 2.0, 1.0, 0.0)));
  vec3 cool = vec3(0.62, 0.12, 0.02);
  vec3 mid = vec3(1.0, 0.48, 0.12);
  vec3 hot = vec3(1.0, 0.9, 0.62);
  vec3 col = mix(cool, mid, smoothstep(0.32, 0.66, gran));
  col = mix(col, hot, smoothstep(0.5, 0.84, fine) * 0.62);
  col = mix(col, col * 0.72 + hot * 0.4, smoothstep(0.45, 0.75, large) * 0.4);
  col = mix(col, col * vec3(0.32, 0.16, 0.07), spot * 0.62);
  float foot = 1.0 - smoothstep(0.0, 0.42, length(p - normalize(uFlareDir)));
  col += vec3(1.0, 0.96, 0.75) * foot * uFlareAmt * 1.15;
  float limb = pow(clamp(dot(n, view), 0.0, 1.0), 0.42);
  col *= uColor * uRadiance * (0.3 + 0.7 * limb);
  gl_FragColor = vec4(col, 1.0);
}
`;

export const STAR_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vObj;
varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
${NOISE}
void main() {
  vUv = uv;
  vec3 p = position;
  float swell = fbm(p * 2.4 + vec3(uSeed, uTime * 0.05, 0.2));
  p += normal * (swell - 0.5) * 0.02;
  vObj = p;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const PROMINENCE_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const PROMINENCE_FRAG = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
uniform vec3 uCamera;
uniform vec3 uCenter;
uniform vec3 uColor;
uniform float uAmt;
uniform float uRadius;
${NOISE}
void main() {
  vec3 fromStar = vWorld - uCenter;
  vec3 view = normalize(uCamera - uCenter);
  float side = length(fromStar - view * dot(fromStar, view));
  float limb = smoothstep(uRadius * 0.62, uRadius * 1.08, side);
  float along = vUv.x;
  float ends = smoothstep(0.0, 0.07, along) * smoothstep(1.0, 0.9, along);
  float turb = 0.65 + 0.35 * fbm(vec3(vUv * vec2(6.0, 3.0), uAmt * 3.0));
  float alpha = ends * turb * uAmt * (0.72 + 0.55 * limb);
  if (alpha < 0.03) discard;
  vec3 col = mix(uColor * vec3(1.0, 0.45, 0.12), vec3(1.0, 0.92, 0.62), turb);
  col *= 0.75 + limb * 0.5;
  gl_FragColor = vec4(col, alpha * (0.55 + turb * 0.45));
}
`;

export const RELIEF_VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vNormal;
uniform float uDisplace;
${NOISE}
void main() {
  vec3 p = position;
  float h = fbm(p * 3.3);
  float fine = fbm(p * 8.0);
  p += normal * ((h - 0.48) * uDisplace + (fine - 0.5) * uDisplace * 0.28);
  vec4 world = modelMatrix * vec4(p, 1.0);
  vObj = position;
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const LAVA_FRAG = /* glsl */ `
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
  vec3 p = normalize(vObj);
  float n1 = fbm(p * 2.7);
  float n2 = fbm(p * 6.8 + 4.0);
  float n3 = fbm(p * 15.0 + 1.5);
  float rock = fbm(p * 10.0);
  float veins = smoothstep(0.045, 0.0, abs(n1 - 0.5));
  veins = max(veins, smoothstep(0.028, 0.0, abs(n2 - 0.48)) * 0.8);
  veins = max(veins, smoothstep(0.016, 0.0, abs(n3 - 0.52)) * 0.45);
  vec3 crust = vec3(0.012, 0.011, 0.012) * (0.55 + rock * 0.9);
  crust = mix(crust, vec3(0.05, 0.03, 0.025), smoothstep(0.6, 0.85, rock) * 0.4);
  vec3 magma = mix(vec3(0.55, 0.05, 0.01), vec3(1.0, 0.62, 0.18), smoothstep(0.2, 0.85, veins));
  vec3 light = starLight(n, vWorld, uStarA, uStarB, uColorA, uColorB);
  vec3 color = crust * light + magma * veins * (0.42 + light * 0.35);
  gl_FragColor = vec4(color, 1.0);
}
`;

export const ICE_FRAG = /* glsl */ `
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
  vec3 p = normalize(vObj);
  float y = p.y;
  float drift = fbm(p * 1.6 + vec3(uTime * 0.012, 0.4, 0.2));
  float lat = y * 0.85 + (drift - 0.5) * 0.55;
  float band = fbm(vec3(lat * 5.5, p.x * 1.4, p.z * 1.1));
  float streak = fbm(vec3(lat * 11.0, p.x * 0.6 + uTime * 0.01, p.z * 0.6));
  float fine = fbm(p * 9.0 + vec3(0.0, uTime * 0.015, 1.0));
  vec3 deep = vec3(0.07, 0.28, 0.34);
  vec3 pale = vec3(0.62, 0.9, 0.88);
  vec3 cream = vec3(0.8, 0.88, 0.8);
  vec3 albedo = mix(deep, pale, smoothstep(0.32, 0.74, band));
  albedo = mix(albedo, cream, smoothstep(0.58, 0.86, fine) * 0.28);
  albedo = mix(albedo, deep * 0.75, smoothstep(0.62, 0.84, streak) * 0.22);
  vec3 stormP = p - normalize(vec3(0.62, 0.18, 0.42));
  float storm = smoothstep(0.62, 0.08, length(stormP));
  float arm = sin(atan(stormP.z, stormP.x) * 3.0 - length(stormP) * 16.0);
  albedo = mix(albedo, vec3(0.03, 0.1, 0.14), storm * (0.65 + 0.35 * smoothstep(0.0, 1.0, arm)));
  vec3 storm2 = p - normalize(vec3(-0.4, -0.35, 0.55));
  albedo = mix(albedo, vec3(0.08, 0.2, 0.26), smoothstep(0.42, 0.08, length(storm2)) * 0.7);
  vec3 light = starLight(n, vWorld, uStarA, uStarB, uColorA, uColorB);
  gl_FragColor = vec4(albedo * light, 1.0);
}
`;

export const EYE_FRAG = /* glsl */ `
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vNormal;
uniform vec3 uStarA;
uniform vec3 uStarB;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uPlanet;
uniform vec3 uCamera;
uniform float uTime;
${NOISE}
void main() {
  vec3 n = normalize(vNormal);
  vec3 p = normalize(vObj);
  vec3 bary = (uStarA + uStarB) * 0.5;
  vec3 sub = normalize(bary - uPlanet);
  float heat = dot(n, sub);
  float warp = fbm(p * 2.6) - 0.5;
  float field = heat + warp * 0.7 + (fbm(p * 6.5) - 0.5) * 0.28;
  float ocean = smoothstep(0.28, 0.72, field);
  float shore = smoothstep(0.05, 0.35, ocean) * smoothstep(0.92, 0.4, ocean);
  float cracks = smoothstep(0.028, 0.0, abs(fbm(p * 4.2) - 0.5));
  cracks = max(cracks, smoothstep(0.018, 0.0, abs(fbm(p * 9.0 + 2.0) - 0.47)) * 0.75);
  float pack = fbm(p * 3.4);
  vec3 ice = mix(vec3(0.78, 0.88, 0.93), vec3(0.5, 0.68, 0.76), pack);
  ice = mix(ice, vec3(0.18, 0.28, 0.34), cracks * (1.0 - ocean * 0.85));
  vec3 water = vec3(0.015, 0.04, 0.07);
  vec3 slush = vec3(0.55, 0.7, 0.74);
  vec3 albedo = mix(ice, water, ocean);
  albedo = mix(albedo, slush, shore * 0.8);
  float cloud = smoothstep(0.52, 0.74, fbm(p * 2.4 + vec3(uTime * 0.012, 0.4, 0.0)));
  cloud *= 0.35 + 0.65 * (1.0 - ocean);
  vec3 light = starLight(n, vWorld, uStarA, uStarB, uColorA, uColorB);
  vec3 view = normalize(uCamera - vWorld);
  vec3 spec = vec3(0.0);
  vec3 stars[2];
  stars[0] = uStarA;
  stars[1] = uStarB;
  vec3 cols[2];
  cols[0] = uColorA;
  cols[1] = uColorB;
  for (int i = 0; i < 2; i++) {
    vec3 L = normalize(stars[i] - vWorld);
    vec3 H = normalize(L + view);
    spec += cols[i] * pow(clamp(dot(n, H), 0.0, 1.0), 90.0);
  }
  vec3 color = albedo * light + spec * ocean * 0.1;
  color = mix(color, vec3(0.9, 0.95, 0.97) * light, cloud * 0.55);
  gl_FragColor = vec4(color, 1.0);
}
`;

export const ROCK_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
uniform vec3 uCamera;
uniform vec3 uFocus;
uniform float uHasFocus;
uniform float uFocusRadius;
float clearance(vec3 world) {
  float dist = distance(world, uCamera);
  float fade = smoothstep(0.45, 1.75, dist);
  if (uHasFocus > 0.5) {
    vec3 toP = uFocus - uCamera;
    float plen2 = dot(toP, toP);
    float along = plen2 > 0.001 ? dot(world - uCamera, toP) / plen2 : 0.0;
    if (along > 0.02 && along < 0.98) {
      float lateral = distance(world, uCamera + toP * along);
      fade *= smoothstep(0.25, 1.45, lateral);
    }
    fade *= smoothstep(0.15, 1.35, distance(world, uFocus) - uFocusRadius);
  }
  return fade;
}
void main() {
  vColor = instanceColor;
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  float fade = clearance(world.xyz);
  vec3 scaled = position * fade;
  world = modelMatrix * instanceMatrix * vec4(scaled, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const ROCK_FRAG = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
uniform vec3 uStarA;
uniform vec3 uStarB;
uniform vec3 uColorA;
uniform vec3 uColorB;
${NOISE}
void main() {
  vec3 n = normalize(vNormal);
  float grit = fbm(vWorld * 3.4);
  float chip = fbm(vWorld * 9.0);
  vec3 albedo = vColor * (0.7 + grit * 0.85);
  albedo = mix(albedo, albedo * vec3(1.15, 1.05, 0.9), chip * 0.35);
  vec3 light = starLight(n, vWorld, uStarA, uStarB, uColorA, uColorB) + vec3(0.14, 0.12, 0.1);
  gl_FragColor = vec4(albedo * light, 1.0);
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
  vec3 col = vec3(0.012, 0.014, 0.028);
  col += vec3(0.02, 0.18, 0.28) * smoothstep(0.32, 0.82, a) * 1.05;
  col += vec3(0.42, 0.08, 0.18) * smoothstep(0.4, 0.88, b) * 0.85;
  col += vec3(0.48, 0.26, 0.08) * smoothstep(0.48, 0.9, c) * 0.7;
  col += vec3(0.14, 0.08, 0.26) * smoothstep(0.55, 0.9, d) * 0.4;
  float ridge = 1.0 - abs(fbm(dir * 3.6 + 2.0) * 2.0 - 1.0);
  float filament = pow(ridge, 2.6) * smoothstep(0.25, 0.7, a);
  col += vec3(0.45, 0.28, 0.42) * filament * 0.28;
  float lane = exp(-pow((dir.y * 0.72 + dir.x * 0.18) / 0.16, 2.0));
  col += vec3(0.22, 0.18, 0.3) * lane * (0.22 + a * 0.45);
  col *= 0.7 + 0.4 * smoothstep(0.15, 0.75, a);
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

export const MAP_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const MAP_FRAG = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
uniform vec3 uStarA;
uniform vec3 uStarB;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uCamera;
uniform float uTime;
uniform float uHasNormal;
uniform float uHasSpec;
uniform float uHasClouds;
uniform sampler2D uMap;
uniform sampler2D uNormal;
uniform sampler2D uSpec;
uniform sampler2D uClouds;
${NOISE}
void main() {
  vec2 uv = vUv;
  vec3 albedo = texture2D(uMap, uv).rgb;
  vec3 n = normalize(vNormal);
  vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), n));
  if (dot(t, t) < 0.001) t = vec3(1.0, 0.0, 0.0);
  vec3 b = cross(n, t);
  if (uHasNormal > 0.5) {
    vec3 nm = texture2D(uNormal, uv).xyz * 2.0 - 1.0;
    n = normalize(t * nm.x + b * nm.y + n * nm.z);
  } else {
    float h = dot(albedo, vec3(0.3, 0.5, 0.2));
    float hx = dot(texture2D(uMap, uv + vec2(0.0015, 0.0)).rgb, vec3(0.3, 0.5, 0.2));
    float hy = dot(texture2D(uMap, uv + vec2(0.0, 0.0015)).rgb, vec3(0.3, 0.5, 0.2));
    n = normalize(n + t * (hx - h) * 4.0 + b * (hy - h) * 4.0);
  }
  float specMask = uHasSpec > 0.5 ? texture2D(uSpec, uv).r : 0.08;
  vec3 light = starLight(n, vWorld, uStarA, uStarB, uColorA, uColorB);
  vec3 view = normalize(uCamera - vWorld);
  vec3 spec = vec3(0.0);
  vec3 stars[2];
  stars[0] = uStarA;
  stars[1] = uStarB;
  vec3 cols[2];
  cols[0] = uColorA;
  cols[1] = uColorB;
  for (int i = 0; i < 2; i++) {
    vec3 L = normalize(stars[i] - vWorld);
    vec3 H = normalize(L + view);
    spec += cols[i] * pow(clamp(dot(n, H), 0.0, 1.0), 140.0);
  }
  vec3 color = albedo * light + spec * specMask * 0.22;
  if (uHasClouds > 0.5) {
    vec3 clouds = texture2D(uClouds, uv + vec2(uTime * 0.003, 0.0)).rgb;
    float cover = smoothstep(0.18, 0.78, clouds.g);
    color = mix(color, vec3(0.93, 0.95, 0.97) * light, cover * 0.78);
  }
  gl_FragColor = vec4(color, 1.0);
}
`;

export const GALAXY_FRAG = /* glsl */ `
varying vec2 vUv;
${NOISE}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  vec2 e = vec2(p.x, p.y * 1.7);
  float r = length(e);
  float ang = atan(e.y, e.x);
  float arm = sin(ang * 2.0 - r * 7.0);
  float disk = exp(-r * r * 2.4);
  float core = exp(-r * r * 18.0);
  float dust = fbm(vec3(e * 4.0, ang));
  float lane = exp(-pow(e.y / 0.08, 2.0)) * smoothstep(0.85, 0.15, r);
  float alpha = disk * (0.18 + 0.45 * smoothstep(0.15, 0.85, arm * 0.5 + 0.5) + core * 1.4);
  alpha *= 0.45 + dust * 0.4;
  alpha *= 1.0 - lane * 0.55;
  vec3 col = mix(vec3(0.35, 0.42, 0.62), vec3(0.98, 0.9, 0.75), core);
  col = mix(col, vec3(0.72, 0.5, 0.38), dust * disk * 0.4);
  gl_FragColor = vec4(col, alpha * 0.55);
}
`;
