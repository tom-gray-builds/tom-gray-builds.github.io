import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  Line as ThreeLine,
  LineBasicMaterial,
  MathUtils,
  Object3D,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type Group,
} from "three";
import type { Piece } from "../data/content";
import { openLinkedIn } from "../data/links";
import {
  clamp,
  clearEye,
  focusClearance,
  framedLook,
  minimumFocusRadius,
  homeRadius,
  shortestAngle,
  sphericalOffset,
} from "./framing";
import {
  CLUSTERS,
  clusterFragmentShader,
  clusterVertexShader,
  type Cluster,
} from "./clusters";
import type { Quality } from "./quality";
import { pointerExceededDrag, pointerGate } from "./pointer";
import { beltRocks, type Rock } from "./belt";
import {
  AIR_FRAG,
  AIR_VERT,
  EYE_FRAG,
  GALAXY_FRAG,
  ICE_FRAG,
  LAVA_FRAG,
  PROMINENCE_FRAG,
  PROMINENCE_VERT,
  RELIEF_VERT,
  RING_FRAG,
  RING_VERT,
  ROCK_FRAG,
  ROCK_VERT,
  SKY_FRAG,
  SKY_VERT,
  STAR_FRAG,
  STAR_VERT,
} from "./shaders";
import {
  STAR_ACTIVITY,
  activeFlare,
  flareDirection,
  flareEnvelope,
  stellarBrightness,
} from "./stellar";
import {
  BINARY,
  bodyRadius,
  kindFor,
  litOverviewTheta,
  orbitFor,
  orbitPosition,
  planetPosition,
  sim,
  starPosition,
  surfaceFor,
  visualRadius,
} from "./system";

export type RigCommand = {
  seq: number;
  type: "reset" | "back" | "left" | "right" | "up" | "down" | "in" | "out";
};

const STAR_A = new Color(BINARY.primary.color);
const STAR_B = new Color(BINARY.secondary.color);

function clampPhi(phi: number) {
  return clamp(phi, 0.32, Math.PI - 0.32);
}

function softGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw the star glow");
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  // Transparent across the disc itself. A thin falloff sits just outside the limb.
  gradient.addColorStop(0, "rgba(255,220,160,0)");
  gradient.addColorStop(0.56, "rgba(255,210,150,0)");
  gradient.addColorStop(0.64, "rgba(255,196,120,0.55)");
  gradient.addColorStop(0.78, "rgba(255,150,70,0.1)");
  gradient.addColorStop(1, "rgba(255,140,60,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function pushStars(material: ShaderMaterial, camera: Vector3) {
  const a = starPosition("primary", sim.time);
  const b = starPosition("secondary", sim.time);
  material.uniforms.uStarA.value.set(a.x, a.y, a.z);
  material.uniforms.uStarB.value.set(b.x, b.y, b.z);
  if (material.uniforms.uCamera) material.uniforms.uCamera.value.copy(camera);
  if (material.uniforms.uTime) material.uniforms.uTime.value = sim.time;
}

function Sky() {
  return (
    <mesh frustumCulled={false} renderOrder={-20}>
      <sphereGeometry args={[420, 48, 32]} />
      <shaderMaterial side={BackSide} depthWrite={false} vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} />
    </mesh>
  );
}

function Starfield({ count }: { count: number }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    let seed = 17;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < count; i++) {
      const radius = 80 + rand() * 260;
      const theta = rand() * Math.PI * 2;
      const zBias = Math.pow(rand(), 0.35) * 2 - 1;
      const phi = Math.acos(clamp(zBias * 0.85, -1, 1));
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi) * 0.55;
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      const mag = Math.pow(rand(), 4);
      const warm = rand();
      colors[i * 3] = warm > 0.85 ? 1 : 0.82;
      colors[i * 3 + 1] = warm > 0.85 ? 0.86 : 0.88;
      colors[i * 3 + 2] = warm > 0.92 ? 0.7 : 1;
      sizes[i] = 0.8 + mag * 3.4;
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    geo.setAttribute("color", new BufferAttribute(colors, 3));
    geo.setAttribute("size", new BufferAttribute(sizes, 1));
    return geo;
  }, [count]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        vertexColors: true,
        uniforms: {},
        vertexShader: /* glsl */ `
          attribute float size;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = clamp(size * (110.0 / -mv.z), 0.6, 2.1);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vColor;
          void main() {
            vec2 p = gl_PointCoord * 2.0 - 1.0;
            float d = dot(p, p);
            if (d > 1.0) discard;
            float alpha = smoothstep(1.0, 0.15, d);
            gl_FragColor = vec4(vColor, alpha);
          }
        `,
      }),
    [],
  );
  return <points geometry={geometry} material={material} />;
}

function clusterStars(center: Cluster, per: number) {
  const positions = new Float32Array(per * 3);
  const colors = new Float32Array(per * 3);
  const lums = new Float32Array(per);
  let seed = Math.round(center.seed * 1000) + 17;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < per; i++) {
    const halo = rand() > 0.72;
    const u = Math.max(rand(), 1e-4);
    const radius = halo ? (0.28 + Math.pow(u, 0.55) * 0.72) * center.scale : Math.pow(u, 2.15) * center.scale * 0.62;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const o = i * 3;
    positions[o] = center.x + radius * Math.sin(phi) * Math.cos(theta);
    positions[o + 1] = center.y + radius * Math.sin(phi) * Math.sin(theta) * 0.92;
    positions[o + 2] = center.z + radius * Math.cos(phi);
    const roll = rand();
    const hue = roll > 0.94 ? [1, 0.62, 0.38] : roll > 0.84 ? [0.7, 0.8, 1] : [0.98, 0.95, 0.88];
    colors[o] = hue[0];
    colors[o + 1] = hue[1];
    colors[o + 2] = hue[2];
    lums[i] = halo ? 0.28 + Math.pow(rand(), 2.8) * 1.15 : 0.45 + Math.pow(rand(), 2.2) * 1.35;
  }
  return { positions, colors, lums };
}

function Clusters() {
  const geometry = useMemo(() => {
    const per = 4600;
    const positions = new Float32Array(CLUSTERS.length * per * 3);
    const colors = new Float32Array(CLUSTERS.length * per * 3);
    const lums = new Float32Array(CLUSTERS.length * per);
    CLUSTERS.forEach((center, index) => {
      const stars = clusterStars(center, per);
      positions.set(stars.positions, index * per * 3);
      colors.set(stars.colors, index * per * 3);
      lums.set(stars.lums, index * per);
    });
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    geo.setAttribute("color", new BufferAttribute(colors, 3));
    geo.setAttribute("aLum", new BufferAttribute(lums, 1));
    return geo;
  }, []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        vertexColors: true,
        uniforms: {},
        vertexShader: clusterVertexShader(),
        fragmentShader: clusterFragmentShader(),
      }),
    [],
  );
  return <points geometry={geometry} material={material} />;
}

function Galaxies({ count }: { count: number }) {
  const spots = [
    { position: [150, 40, -210] as const, rotation: [1.1, 0.2, 0.4] as const, scale: 52 },
    { position: [-170, -10, -180] as const, rotation: [0.7, 1.1, 0.3] as const, scale: 40 },
    { position: [30, 80, 200] as const, rotation: [1.3, 0.4, 0.9] as const, scale: 34 },
  ].slice(0, count);
  return (
    <group>
      {spots.map((spot) => (
        <mesh key={spot.position.join(",")} position={spot.position} rotation={spot.rotation} scale={spot.scale}>
          <circleGeometry args={[1, 48]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            vertexShader={/* glsl */ `
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={GALAXY_FRAG}
          />
        </mesh>
      ))}
    </group>
  );
}

function OrbitLine({ id, index, segments, hidden }: { id: string; index: number; segments: number; hidden: boolean }) {
  const line = useMemo(() => {
    const orbit = orbitFor(id, index);
    const positions = new Float32Array((segments + 1) * 3);
    for (let i = 0; i <= segments; i++) {
      const sample = orbitPosition({ ...orbit, phase: (i / segments) * Math.PI * 2, period: 1 }, 0);
      positions[i * 3] = sample.x;
      positions[i * 3 + 1] = sample.y;
      positions[i * 3 + 2] = sample.z;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    return new ThreeLine(
      geometry,
      new LineBasicMaterial({ color: "#d9c7a2", transparent: true, opacity: 0.28, depthWrite: false }),
    );
  }, [id, index, segments]);
  line.visible = !hidden;
  return <primitive object={line} />;
}

function prominenceGeometry(radius: number) {
  const segments = 28;
  const sides = 7;
  const height = radius * 1.45;
  const tube = radius * 0.085;
  const foot = 0.46;
  const center: { x: number; y: number; z: number; t: number }[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const ang = (t - 0.5) * foot * 2;
    const lift = Math.sin(Math.PI * t) * height;
    const radial = radius + lift;
    center.push({ x: Math.sin(ang) * radial, y: Math.cos(ang) * radial, z: 0, t });
  }
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  center.forEach((curr, i) => {
    const prev = center[Math.max(i - 1, 0)];
    const next = center[Math.min(i + 1, center.length - 1)];
    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    let tz = next.z - prev.z;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    let px = 0;
    let py = tz;
    let pz = -ty;
    if (Math.abs(ty) < 0.85) {
      px = ty;
      py = -tx;
      pz = 0;
    }
    const pl = Math.hypot(px, py, pz) || 1;
    px /= pl;
    py /= pl;
    pz /= pl;
    const qx = ty * pz - tz * py;
    const qy = tz * px - tx * pz;
    const qz = tx * py - ty * px;
    for (let s = 0; s < sides; s += 1) {
      const a = (s / sides) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const along = Math.sin(Math.PI * curr.t);
      const localTube = tube * (0.18 + Math.pow(along, 0.72) * 1.05);
      positions.push(
        curr.x + (px * c + qx * sn) * localTube,
        curr.y + (py * c + qy * sn) * localTube,
        curr.z + (pz * c + qz * sn) * localTube,
      );
      uvs.push(curr.t, s / sides);
    }
  });
  for (let i = 0; i < segments; i += 1) {
    for (let s = 0; s < sides; s += 1) {
      const a = i * sides + s;
      const b = i * sides + ((s + 1) % sides);
      const c = (i + 1) * sides + s;
      const d = (i + 1) * sides + ((s + 1) % sides);
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function Stars({ glow, reduced }: { glow: ReturnType<typeof softGlowTexture>; reduced: boolean }) {
  const primary = useRef<Group>(null);
  const secondary = useRef<Group>(null);
  const loopA = useRef<Group>(null);
  const loopB = useRef<Group>(null);
  const up = useMemo(() => new Vector3(0, 1, 0), []);
  const { gl } = useThree();
  const materials = useMemo(() => {
    const make = (color: Color, seed: number) =>
      new ShaderMaterial({
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
        uniforms: {
          uColor: { value: color },
          uCamera: { value: new Vector3() },
          uTime: { value: 0 },
          uSeed: { value: seed },
          uFlareDir: { value: new Vector3(0, 1, 0) },
          uFlareAmt: { value: 0 },
          uRadiance: { value: 1 },
        },
      });
    const loop = (color: Color, radius: number) =>
      new ShaderMaterial({
        vertexShader: PROMINENCE_VERT,
        fragmentShader: PROMINENCE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        uniforms: {
          uCamera: { value: new Vector3() },
          uCenter: { value: new Vector3() },
          uColor: { value: color },
          uAmt: { value: 0 },
          uRadius: { value: radius },
        },
      });
    return {
      primary: make(STAR_A, STAR_ACTIVITY.primary),
      secondary: make(STAR_B, STAR_ACTIVITY.secondary),
      loopA: loop(STAR_A, BINARY.primary.radius),
      loopB: loop(STAR_B, BINARY.secondary.radius),
    };
  }, []);
  const arches = useMemo(
    () => ({
      primary: prominenceGeometry(BINARY.primary.radius),
      secondary: prominenceGeometry(BINARY.secondary.radius),
    }),
    [],
  );
  useFrame(({ camera }) => {
    const place = (
      group: Group | null,
      loop: Group | null,
      body: ShaderMaterial,
      ribbon: ShaderMaterial,
      which: "primary" | "secondary",
      seed: number,
    ) => {
      const at = starPosition(which, sim.time);
      group?.position.set(at.x, at.y, at.z);
      body.uniforms.uCamera.value.copy(camera.position);
      body.uniforms.uTime.value = sim.sunTime;
      body.uniforms.uRadiance.value = stellarBrightness(seed, sim.sunTime);
      const flare = reduced ? null : activeFlare(seed, sim.time);
      const amount = flare ? flareEnvelope(sim.time, flare) * flare.strength : 0;
      const dir = flare ? flareDirection(flare) : { x: 0, y: 1, z: 0 };
      body.uniforms.uFlareAmt.value = amount;
      body.uniforms.uFlareDir.value.set(dir.x, dir.y, dir.z);
      ribbon.uniforms.uCamera.value.copy(camera.position);
      ribbon.uniforms.uCenter.value.set(at.x, at.y, at.z);
      ribbon.uniforms.uAmt.value = amount;
      if (loop) {
        loop.visible = amount > 0.04;
        loop.quaternion.setFromUnitVectors(up, body.uniforms.uFlareDir.value);
        const grow = 0.62 + 0.38 * (flare ? flareEnvelope(sim.time, flare) : 0);
        loop.scale.setScalar(grow);
      }
    };
    place(primary.current, loopA.current, materials.primary, materials.loopA, "primary", STAR_ACTIVITY.primary);
    place(secondary.current, loopB.current, materials.secondary, materials.loopB, "secondary", STAR_ACTIVITY.secondary);
  });
  const star = (radius: number, material: ShaderMaterial, color: Color) => (
    <>
      <mesh
        onPointerOver={(event) => {
          event.stopPropagation();
          gl.domElement.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          gl.domElement.style.cursor = "grab";
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (pointerGate.dragged) return;
          openLinkedIn();
        }}
      >
        <sphereGeometry args={[radius, 72, 56]} />
        <primitive object={material} attach="material" />
      </mesh>
      <sprite scale={[radius * 3.2, radius * 3.2, 1]} raycast={() => null}>
        <spriteMaterial
          map={glow}
          color={color}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          opacity={0.5}
          depthTest
        />
      </sprite>
    </>
  );
  return (
    <group>
      <group ref={primary}>
        {star(BINARY.primary.radius, materials.primary, STAR_A)}
        <ScreenAnchor elementId="sun-primary" />
        <group ref={loopA}>
          <mesh geometry={arches.primary} material={materials.loopA} frustumCulled={false} />
        </group>
      </group>
      <group ref={secondary}>
        {star(BINARY.secondary.radius, materials.secondary, STAR_B)}
        <ScreenAnchor elementId="sun-secondary" />
        <group ref={loopB}>
          <mesh geometry={arches.secondary} material={materials.loopB} frustumCulled={false} />
        </group>
      </group>
    </group>
  );
}

function starUniforms() {
  return {
    uStarA: { value: new Vector3() },
    uStarB: { value: new Vector3() },
    uColorA: { value: STAR_A },
    uColorB: { value: STAR_B },
  };
}

function PlanetBody({
  piece,
  index,
  quality,
  reduced,
  selected,
  onSelect,
}: {
  piece: Piece;
  index: number;
  quality: Quality;
  reduced: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const kind = kindFor(piece.id, index);
  const surfaceName = surfaceFor(piece.id, index);
  const radius = bodyRadius(kind);
  const group = useRef<Group>(null);
  const spin = useRef<Group>(null);
  const { camera, gl } = useThree();
  const surface = useMemo(() => {
    if (surfaceName === "lava") {
      return new ShaderMaterial({
        vertexShader: RELIEF_VERT,
        fragmentShader: LAVA_FRAG,
        uniforms: { ...starUniforms(), uDisplace: { value: 0.06 } },
      });
    }
    if (surfaceName === "ice-giant") {
      return new ShaderMaterial({
        vertexShader: RELIEF_VERT,
        fragmentShader: ICE_FRAG,
        uniforms: { ...starUniforms(), uTime: { value: 0 }, uDisplace: { value: 0.018 } },
      });
    }
    return new ShaderMaterial({
      vertexShader: RELIEF_VERT,
      fragmentShader: EYE_FRAG,
      uniforms: {
        ...starUniforms(),
        uPlanet: { value: new Vector3() },
        uCamera: { value: new Vector3() },
        uTime: { value: 0 },
        uDisplace: { value: 0.04 },
      },
    });
  }, [surfaceName]);
  const air = useMemo(() => {
    const tint =
      surfaceName === "eyeball" ? new Color("#c5e9f6") : surfaceName === "lava" ? new Color("#c4623a") : new Color("#b7efe4");
    const gain = surfaceName === "eyeball" ? 0.46 : surfaceName === "lava" ? 0.14 : 0.34;
    return new ShaderMaterial({
      vertexShader: AIR_VERT,
      fragmentShader: AIR_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: BackSide,
      uniforms: { uTint: { value: tint }, uGain: { value: gain }, uCamera: { value: new Vector3() } },
    });
  }, [surfaceName]);
  const rings = useMemo(() => {
    if (surfaceName !== "ice-giant") return null;
    const inner = radius * 1.18;
    const outer = visualRadius(kind) * 0.98;
    return new ShaderMaterial({
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        ...starUniforms(),
        uPlanet: { value: new Vector3() },
        uInner: { value: inner },
        uOuter: { value: outer },
        uBody: { value: radius },
      },
    });
  }, [surfaceName, kind, radius]);

  useFrame((_, delta) => {
    const position = planetPosition(piece.id, index, sim.time);
    group.current?.position.set(position.x, position.y, position.z);
    if (!reduced && spin.current && surfaceName !== "eyeball") {
      spin.current.rotation.y += delta * (surfaceName === "ice-giant" ? 0.045 : 0.07);
    }
    pushStars(surface, camera.position);
    if (surface.uniforms.uPlanet) surface.uniforms.uPlanet.value.set(position.x, position.y, position.z);
    air.uniforms.uCamera.value.copy(camera.position);
    if (rings) {
      pushStars(rings, camera.position);
      rings.uniforms.uPlanet.value.set(position.x, position.y, position.z);
    }
  });

  const sphere = useMemo(
    () => new SphereGeometry(1, quality.sphereWidth, quality.sphereHeight),
    [quality.sphereWidth, quality.sphereHeight],
  );

  return (
    <group ref={group}>
      <group ref={spin}>
        <mesh geometry={sphere} material={surface} scale={radius} />
        <mesh geometry={sphere} material={air} scale={radius * 1.02} />
      </group>
      {rings ? (
        <mesh material={rings} rotation={[0.42, 0.18, 0.28]}>
          <ringGeometry args={[radius * 1.18, visualRadius(kind) * 0.98, Math.max(quality.ringSegments, 128), 72]} />
        </mesh>
      ) : null}
      <mesh
        scale={visualRadius(kind)}
        onPointerOver={(event) => {
          event.stopPropagation();
          gl.domElement.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          gl.domElement.style.cursor = "grab";
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (pointerGate.dragged) return;
          onSelect(piece.id);
        }}
      >
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      <ScreenAnchor elementId={`marker-${piece.id}`} hidden={selected} />
    </group>
  );
}

function ScreenAnchor({ elementId, hidden = false }: { elementId: string; hidden?: boolean }) {
  const anchor = useRef<Group>(null);
  const { camera, size } = useThree();
  const point = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const group = anchor.current;
    const el = document.getElementById(elementId);
    if (!group || !el) return;
    if (hidden) {
      el.style.visibility = "hidden";
      return;
    }
    group.getWorldPosition(point);
    point.project(camera);
    const x = (point.x * 0.5 + 0.5) * size.width;
    const y = (-point.y * 0.5 + 0.5) * size.height;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    el.style.visibility = point.z > 1 ? "hidden" : "visible";
  });
  return <group ref={anchor} />;
}

function rockGeometry(seed: number, detail: number) {
  const geo = new IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let n = Math.imul(Math.round((x + 3) * 19 + (y + 3) * 29 + (z + 3) * 7) + seed * 13, 747796405);
    n = Math.imul(n ^ (n >>> 13), 2246822519);
    const unit = ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    const stretch = 0.62 + unit * 0.85;
    pos.setXYZ(i, x * stretch, y * (0.7 + unit * 0.5), z * stretch);
  }
  geo.computeVertexNormals();
  return geo;
}

function Belt({ count, pieces, selectedId }: { count: number; pieces: Piece[]; selectedId: string | null }) {
  const rocks = useMemo(() => beltRocks(count), [count]);
  const geometries = useMemo(() => [rockGeometry(3, 2), rockGeometry(17, 2), rockGeometry(41, 2)], []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: ROCK_VERT,
        fragmentShader: ROCK_FRAG,
        uniforms: {
          uStarA: { value: new Vector3() },
          uStarB: { value: new Vector3() },
          uColorA: { value: STAR_A },
          uColorB: { value: STAR_B },
          uCamera: { value: new Vector3() },
          uFocus: { value: new Vector3() },
          uHasFocus: { value: 0 },
          uFocusRadius: { value: 1 },
        },
      }),
    [],
  );
  const meshes = useMemo(() => {
    const dummy = new Object3D();
    const color = new Color();
    return [0, 1, 2].map((shape) => {
      const batch = rocks.filter((rock: Rock) => rock.shape === shape);
      const mesh = new InstancedMesh(geometries[shape], material, Math.max(batch.length, 1));
      mesh.count = batch.length;
      mesh.frustumCulled = false;
      batch.forEach((rock, index) => {
        dummy.position.set(rock.x, rock.y, rock.z);
        dummy.rotation.set(rock.rx, rock.ry, rock.rz);
        dummy.scale.setScalar(rock.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        color.setHSL(0.06 + rock.shade * 0.05, 0.22 + rock.shade * 0.15, 0.16 + rock.shade * 0.24);
        mesh.setColorAt(index, color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.raycast = () => {};
      return mesh;
    });
  }, [rocks, geometries, material]);
  useFrame(({ camera }) => {
    pushStars(material, camera.position);
    material.uniforms.uCamera.value.copy(camera.position);
    if (!selectedId) {
      material.uniforms.uHasFocus.value = 0;
      return;
    }
    const index = pieces.findIndex((piece) => piece.id === selectedId);
    const at = planetPosition(selectedId, Math.max(index, 0), sim.time);
    material.uniforms.uFocus.value.set(at.x, at.y, at.z);
    material.uniforms.uHasFocus.value = 1;
    material.uniforms.uFocusRadius.value = visualRadius(kindFor(selectedId, Math.max(index, 0)));
  });
  return (
    <group>
      {meshes.map((mesh, index) => (
        <primitive key={index} object={mesh} />
      ))}
    </group>
  );
}

export function Universe({
  pieces,
  quality,
  reduced,
  selectedId,
  command,
  onSelect,
}: {
  pieces: Piece[];
  quality: Quality;
  reduced: boolean;
  selectedId: string | null;
  command: RigCommand | null;
  onSelect: (id: string) => void;
}) {
  const elapsed = useRef(0);
  const sunClock = useRef(0);
  const glow = useMemo(() => softGlowTexture(), []);
  useFrame((_, delta) => {
    if (!reduced) {
      elapsed.current += delta;
      sim.time = elapsed.current;
      sim.sunTime = elapsed.current;
    } else {
      sunClock.current += delta * 0.2;
      sim.time = 0;
      sim.sunTime = sunClock.current;
    }
  });
  return (
    <>
      <color attach="background" args={["#070910"]} />
      <Sky />
      <Starfield count={quality.stars} />
      <Clusters />
      <Galaxies count={quality.galaxies} />
      <Stars glow={glow} reduced={reduced} />
      <Belt count={quality.rocks} pieces={pieces} selectedId={selectedId} />
      {pieces.map((piece, index) => (
        <OrbitLine
          key={`${piece.id}-orbit`}
          id={piece.id}
          index={index}
          segments={quality.ringSegments}
          hidden={piece.id === selectedId}
        />
      ))}
      {pieces.map((piece, index) => (
        <PlanetBody
          key={piece.id}
          piece={piece}
          index={index}
          quality={quality}
          reduced={reduced}
          selected={piece.id === selectedId}
          onSelect={onSelect}
        />
      ))}
      <Rig pieces={pieces} reduced={reduced} selectedId={selectedId} command={command} />
    </>
  );
}

function Rig({
  pieces,
  reduced,
  selectedId,
  command,
}: {
  pieces: Piece[];
  reduced: boolean;
  selectedId: string | null;
  command: RigCommand | null;
}) {
  const { camera, gl, size, invalidate } = useThree();
  const aspect = size.width / Math.max(size.height, 1);
  const initial = homeRadius(aspect);
  const opening = litOverviewTheta(0);
  const spherical = useRef({ radius: initial, phi: 1.04, theta: opening });
  const goal = useRef({ radius: initial, phi: 1.04, theta: opening });
  const exploreGuided = useRef(true);
  const pivot = useRef(new Vector3());
  const goalPivot = useRef(new Vector3());
  const saved = useRef<{ radius: number; phi: number; theta: number } | null>(null);
  const focusZoomed = useRef(false);
  const userAimed = useRef(false);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  const down = useRef({ x: 0, y: 0 });
  const scratch = useRef({
    offset: new Vector3(),
    eye: new Vector3(),
    look: new Vector3(),
    right: new Vector3(),
    up: new Vector3(),
    planet: new Vector3(),
  });

  const limits = () => {
    if (!selectedRef.current) return { min: 8, max: 160 };
    const index = pieces.findIndex((piece) => piece.id === selectedRef.current);
    const kind = kindFor(selectedRef.current, Math.max(index, 0));
    const closest = minimumFocusRadius(visualRadius(kind), size.width, size.height);
    return { min: closest, max: closest * 1.7 };
  };

  const place = (dt: number) => {
    if (selectedRef.current) {
      const index = pieces.findIndex((piece) => piece.id === selectedRef.current);
      const position = planetPosition(selectedRef.current, Math.max(index, 0), sim.time);
      goalPivot.current.set(position.x, position.y, position.z);
      const star = starPosition("primary", sim.time);
      if (!userAimed.current) {
        goal.current.theta = Math.atan2(star.x - position.x, star.z - position.z);
        goal.current.phi = 1.12;
      }
      const bound = limits();
      goal.current.radius = focusZoomed.current
        ? clamp(goal.current.radius, bound.min, bound.max)
        : bound.min;
    }
    if (!selectedRef.current && exploreGuided.current) {
      goal.current.theta = litOverviewTheta(sim.time);
      goal.current.phi = 1.04;
    }
    const current = spherical.current;
    const target = goal.current;
    const lambda = selectedRef.current ? 6.5 : 2.6;
    if (reduced || dt === 0) {
      current.radius = target.radius;
      current.phi = target.phi;
      current.theta = target.theta;
      pivot.current.copy(goalPivot.current);
    } else {
      current.radius = MathUtils.damp(current.radius, target.radius, lambda, dt);
      current.phi = MathUtils.damp(current.phi, target.phi, lambda, dt);
      current.theta = MathUtils.damp(current.theta, shortestAngle(current.theta, target.theta), lambda, dt);
      pivot.current.lerp(goalPivot.current, 1 - Math.exp(-lambda * dt));
    }
    const bag = scratch.current;
    const offset = sphericalOffset(current.radius, current.phi, current.theta);
    bag.offset.set(offset.x, offset.y, offset.z);
    bag.eye.copy(pivot.current).add(bag.offset);
    bag.look.copy(pivot.current);
    if (selectedRef.current) {
      const index = pieces.findIndex((piece) => piece.id === selectedRef.current);
      const kind = kindFor(selectedRef.current, Math.max(index, 0));
      const planet = planetPosition(selectedRef.current, Math.max(index, 0), sim.time);
      const minDist = focusClearance(visualRadius(kind));
      const cleared = clearEye(
        { x: bag.eye.x, y: bag.eye.y, z: bag.eye.z },
        planet,
        minDist,
      );
      bag.eye.set(cleared.x, cleared.y, cleared.z);
      const kept = Math.hypot(cleared.x - planet.x, cleared.y - planet.y, cleared.z - planet.z);
      current.radius = Math.max(current.radius, kept);
      goal.current.radius = Math.max(goal.current.radius, kept);
      const look = framedLook(
        { x: bag.eye.x, y: bag.eye.y, z: bag.eye.z },
        planet,
        size.width,
        size.height,
        kept,
      );
      bag.look.set(look.x, look.y, look.z);
      const gap = Math.max(0.25, kept - visualRadius(kind));
      const near = Math.min(0.12, Math.max(0.02, gap * 0.18));
      if (Math.abs(camera.near - near) > 0.004) {
        camera.near = near;
        camera.updateProjectionMatrix();
      }
    } else if (Math.abs(camera.near - 0.05) > 0.004) {
      camera.near = 0.05;
      camera.updateProjectionMatrix();
    }
    camera.position.copy(bag.eye);
    camera.lookAt(bag.look);
  };

  useLayoutEffect(() => {
    place(0);
    gl.domElement.style.cursor = "grab";
  }, []);

  useLayoutEffect(() => {
    if (!selectedId) return;
    if (!saved.current) saved.current = { ...goal.current };
    focusZoomed.current = false;
    userAimed.current = false;
    const index = pieces.findIndex((piece) => piece.id === selectedId);
    const kind = kindFor(selectedId, Math.max(index, 0));
    goal.current.radius = minimumFocusRadius(visualRadius(kind), size.width, size.height);
    goal.current.phi = clampPhi(goal.current.phi * 0.55 + 1.08 * 0.45);
    invalidate();
  }, [selectedId, pieces, invalidate, size.width, size.height]);

  useLayoutEffect(() => {
    if (selectedId) return;
    if (saved.current) return;
    goal.current.radius = homeRadius(size.width / Math.max(size.height, 1));
    invalidate();
  }, [size.width, size.height, selectedId, invalidate]);

  useLayoutEffect(() => {
    if (!command) return;
    const target = goal.current;
    if (command.type === "reset") {
      saved.current = null;
      focusZoomed.current = false;
      userAimed.current = false;
      goalPivot.current.set(0, 0, 0);
      exploreGuided.current = true;
      target.radius = homeRadius(size.width / Math.max(size.height, 1));
      target.phi = 1.04;
      target.theta = litOverviewTheta(sim.time);
    } else if (command.type === "back") {
      goalPivot.current.set(0, 0, 0);
      focusZoomed.current = false;
      userAimed.current = false;
      if (saved.current) {
        target.radius = saved.current.radius;
        target.phi = saved.current.phi;
        target.theta = saved.current.theta;
        saved.current = null;
      } else {
        exploreGuided.current = true;
        target.radius = homeRadius(size.width / Math.max(size.height, 1));
        target.phi = 1.04;
        target.theta = litOverviewTheta(sim.time);
      }
    } else if (command.type === "left" || command.type === "right") {
      if (!selectedRef.current) exploreGuided.current = false;
      target.theta += command.type === "left" ? 0.18 : -0.18;
    } else if (command.type === "up" || command.type === "down") {
      target.phi = clampPhi(target.phi + (command.type === "down" ? 0.1 : -0.1));
    } else if (command.type === "in" || command.type === "out") {
      const bound = limits();
      if (selectedRef.current) focusZoomed.current = true;
      target.radius = clamp(
        target.radius * (command.type === "out" ? 1.12 : 0.9),
        bound.min,
        bound.max,
      );
    }
    invalidate();
  }, [command, invalidate, size.width, size.height]);

  useLayoutEffect(() => {
    const element = gl.domElement;
    const active = pointers.current;
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      pointerGate.dragged = false;
      active.set(event.pointerId, { x: event.clientX, y: event.clientY });
      down.current = { x: event.clientX, y: event.clientY };
      pinch.current = 0;
      element.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      const previous = active.get(event.pointerId);
      if (!previous) return;
      active.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointerExceededDrag(event.clientX - down.current.x, event.clientY - down.current.y)) {
        pointerGate.dragged = true;
        element.style.cursor = "grabbing";
      }
      const bound = limits();
      if (active.size >= 2) {
        const points = [...active.values()];
        const span = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        if (pinch.current > 0) {
          const next = clamp(spherical.current.radius * (pinch.current / span), bound.min, bound.max);
          spherical.current.radius = next;
          goal.current.radius = next;
          if (selectedRef.current) focusZoomed.current = true;
        }
        pinch.current = span;
        invalidate();
        return;
      }
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      spherical.current.theta -= dx * 0.005;
      spherical.current.phi = clampPhi(spherical.current.phi + dy * 0.004);
      goal.current.theta = spherical.current.theta;
      goal.current.phi = spherical.current.phi;
      if (selectedRef.current) userAimed.current = true;
      else exploreGuided.current = false;
      invalidate();
    };
    const onUp = (event: PointerEvent) => {
      active.delete(event.pointerId);
      pinch.current = 0;
      if (active.size === 0) element.style.cursor = "grab";
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 160 : 1;
      const bound = limits();
      goal.current.radius = clamp(
        goal.current.radius * Math.exp(event.deltaY * scale * 0.00115),
        bound.min,
        bound.max,
      );
      if (selectedRef.current) focusZoomed.current = true;
      invalidate();
    };
    const onContext = (event: Event) => event.preventDefault();
    element.addEventListener("pointerdown", onDown);
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointercancel", onUp);
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("contextmenu", onContext);
    return () => {
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onUp);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("contextmenu", onContext);
    };
  }, [gl, invalidate, size.width, size.height, pieces]);

  useFrame((_, delta) => {
    place(delta);
    if (!reduced) return;
    const moving =
      Math.abs(spherical.current.radius - goal.current.radius) > 0.03 ||
      pivot.current.distanceTo(goalPivot.current) > 0.04;
    if (moving) invalidate();
  });

  return null;
}
