import { Color, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial } from "three";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import { NOISE_GLSL } from "./noise.glsl";

const marbleVertex = /* glsl */ `
varying vec3 vObj;
void main() {
  vObj = position;
  float n = fbm(position * 1.25);
  csm_Position = position + normal * (n - 0.48) * 0.055;
}
`;

const marbleFragment = /* glsl */ `
varying vec3 vObj;
void main() {
  vec3 p = vObj;
  float n = fbm(p * 1.35);
  float ridge = abs(fbm(p * 2.4 + n) * 2.0 - 1.0);
  float ink = smoothstep(0.18, 0.02, ridge);
  ink = pow(ink, 1.35);
  vec3 dir = normalize(p);
  float bowls = 0.0;
  bowls += smoothstep(0.22, 0.1, length(dir - normalize(vec3(0.72, 0.32, 0.42))));
  bowls += smoothstep(0.18, 0.08, length(dir - normalize(vec3(-0.42, 0.62, 0.48))));
  bowls += smoothstep(0.16, 0.07, length(dir - normalize(vec3(0.12, -0.74, 0.4))));
  float mark = clamp(ink * 0.72 + bowls * 0.85, 0.0, 1.0);
  vec3 ivory = vec3(0.93, 0.89, 0.82);
  vec3 warm = vec3(0.78, 0.71, 0.62);
  vec3 inkColor = vec3(0.08, 0.075, 0.07);
  vec3 stone = mix(ivory, warm, fbm(p * 0.8));
  csm_DiffuseColor = vec4(mix(stone, inkColor, mark), 1.0);
}
`;

const pearlVertex = /* glsl */ `
varying vec3 vObj;
void main() {
  vObj = position;
  float n = fbm(position * 1.55);
  csm_Position = position + normal * (n - 0.5) * 0.07;
}
`;

const pearlFragment = /* glsl */ `
varying vec3 vObj;
void main() {
  float h = fbm(vObj * 1.65);
  float grain = fbm(vObj * 4.4);
  vec3 deep = vec3(0.20, 0.16, 0.34);
  vec3 pearl = vec3(0.91, 0.76, 0.68);
  vec3 high = vec3(0.98, 0.96, 0.94);
  float shore = smoothstep(0.40, 0.60, h);
  vec3 col = mix(deep, pearl, shore);
  col = mix(col, high, smoothstep(0.60, 0.84, h));
  col *= 0.93 + 0.1 * grain;
  csm_DiffuseColor = vec4(col, 1.0);
}
`;

function withNoise(source: string) {
  return `${NOISE_GLSL}\n${source}`;
}

export type Materials = ReturnType<typeof createMaterials>;

export function createMaterials() {
  const brass = new MeshPhysicalMaterial({
    color: new Color("#c48a4d"),
    metalness: 1,
    roughness: 0.32,
    clearcoat: 0.4,
    clearcoatRoughness: 0.35,
    envMapIntensity: 1.2,
  });
  const bronze = new MeshPhysicalMaterial({
    color: new Color("#3c2b22"),
    metalness: 1,
    roughness: 0.48,
    envMapIntensity: 1.05,
  });
  const glow = new MeshStandardMaterial({
    color: new Color("#3a160c"),
    emissive: new Color("#ff7a32"),
    emissiveIntensity: 2.6,
    roughness: 0.62,
  });
  const glass = new MeshPhysicalMaterial({
    color: new Color("#f7fbff"),
    metalness: 0,
    roughness: 0.12,
    transmission: 0.92,
    thickness: 1.15,
    ior: 1.45,
    attenuationColor: new Color("#d5e4ff"),
    attenuationDistance: 1.4,
    transparent: true,
    envMapIntensity: 2.2,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    iridescence: 0.4,
    iridescenceIOR: 1.2,
    iridescenceThicknessRange: [100, 400],
  });
  const glassGhost = glass.clone();
  glassGhost.color = new Color("#fbf8ff");
  glassGhost.attenuationColor = new Color("#e4d6ff");
  glassGhost.attenuationDistance = 0.85;
  glassGhost.thickness = 1.4;
  glassGhost.roughness = 0.04;
  glassGhost.transmission = 1;
  glassGhost.envMapIntensity = 2.4;
  glassGhost.iridescence = 1;

  const lead = new MeshPhysicalMaterial({
    color: new Color("#8d8578"),
    metalness: 1,
    roughness: 0.28,
    envMapIntensity: 1.2,
  });
  const chrome = new MeshPhysicalMaterial({
    color: new Color("#d7dbe6"),
    metalness: 1,
    roughness: 0.14,
    envMapIntensity: 1.45,
  });
  const gold = new MeshPhysicalMaterial({
    color: new Color("#e2b56a"),
    metalness: 1,
    roughness: 0.24,
    envMapIntensity: 1.3,
  });
  const hit = new MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });

  const marble = new CustomShaderMaterial({
    baseMaterial: MeshPhysicalMaterial,
    vertexShader: withNoise(marbleVertex),
    fragmentShader: withNoise(marbleFragment),
    color: new Color("#f3efe6"),
    roughness: 0.42,
    metalness: 0.02,
    clearcoat: 0.22,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.4,
  });

  const pearl = new CustomShaderMaterial({
    baseMaterial: MeshPhysicalMaterial,
    vertexShader: withNoise(pearlVertex),
    fragmentShader: withNoise(pearlFragment),
    color: new Color("#f4ece6"),
    roughness: 0.2,
    metalness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    iridescence: 1,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [120, 460],
    sheen: 0.55,
    sheenColor: new Color("#ffd0bf"),
    sheenRoughness: 0.35,
    envMapIntensity: 0.85,
  });

  return { brass, bronze, glow, glass, glassGhost, lead, chrome, gold, hit, marble, pearl };
}

let materials: Materials | null = null;

export function getMaterials() {
  if (!materials) materials = createMaterials();
  return materials;
}
