import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Line as ThreeLine,
  LineBasicMaterial,
  MathUtils,
  NormalBlending,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Group,
} from "three";
import type { Piece } from "../data/content";
import {
  clamp,
  focusDistance,
  framedLook,
  homeRadius,
  shortestAngle,
  sphericalOffset,
} from "./framing";
import type { Quality } from "./quality";
import { pointerExceededDrag, pointerGate } from "./pointer";
import {
  AIR_FRAG,
  AIR_VERT,
  CLOUD_FRAG,
  CORONA_FRAG,
  GALAXY_FRAG,
  GIANT_FRAG,
  OCEAN_FRAG,
  PLANET_VERT,
  RING_FRAG,
  RING_VERT,
  ROCKY_FRAG,
  SKY_FRAG,
  SKY_VERT,
  STAR_FRAG,
  STAR_VERT,
} from "./shaders";
import {
  BINARY,
  bodyRadius,
  kindFor,
  orbitFor,
  orbitPosition,
  planetPosition,
  sim,
  starPosition,
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

function makeLitMaterial(fragment: string, displace: number) {
  return new ShaderMaterial({
    vertexShader: PLANET_VERT,
    fragmentShader: fragment,
    uniforms: {
      uDisplace: { value: displace },
      uStarA: { value: new Vector3() },
      uStarB: { value: new Vector3() },
      uColorA: { value: STAR_A },
      uColorB: { value: STAR_B },
      uCamera: { value: new Vector3() },
      uTime: { value: 0 },
    },
  });
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
            gl_PointSize = size * (280.0 / -mv.z);
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

function Clusters({ count }: { count: number }) {
  const geometry = useMemo(() => {
    const centers = [
      { x: 140, y: 90, z: -180 },
      { x: -190, y: 40, z: -120 },
      { x: 60, y: -80, z: -220 },
      { x: -40, y: 130, z: 160 },
    ].slice(0, count);
    const per = 420;
    const positions = new Float32Array(centers.length * per * 3);
    const colors = new Float32Array(centers.length * per * 3);
    let n = 0;
    centers.forEach((center, index) => {
      let seed = 90 + index * 13;
      const rand = () => {
        seed = (seed * 48271) % 2147483647;
        return (seed - 1) / 2147483646;
      };
      for (let i = 0; i < per; i++) {
        const r = Math.pow(rand(), 0.45) * 18;
        const theta = rand() * Math.PI * 2;
        const phi = Math.acos(2 * rand() - 1);
        positions[n] = center.x + r * Math.sin(phi) * Math.cos(theta);
        positions[n + 1] = center.y + r * Math.sin(phi) * Math.sin(theta) * 0.8;
        positions[n + 2] = center.z + r * Math.cos(phi);
        const bright = Math.pow(rand(), 2);
        colors[n] = 0.9;
        colors[n + 1] = 0.92;
        colors[n + 2] = 1;
        colors[n] *= 0.4 + bright;
        colors[n + 1] *= 0.4 + bright;
        colors[n + 2] *= 0.5 + bright;
        n += 3;
      }
    });
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    geo.setAttribute("color", new BufferAttribute(colors, 3));
    return geo;
  }, [count]);
  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={3.1}
        sizeAttenuation
        vertexColors
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        opacity={0.95}
      />
    </points>
  );
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

function OrbitLine({ id, index, segments }: { id: string; index: number; segments: number }) {
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
    return new ThreeLine(geometry, new LineBasicMaterial({ color: "#d9c7a2", transparent: true, opacity: 0.28 }));
  }, [id, index, segments]);
  return <primitive object={line} />;
}

function Stars() {
  const primary = useRef<Group>(null);
  const secondary = useRef<Group>(null);
  const materials = useRef<ShaderMaterial[]>([]);
  useFrame(({ camera }) => {
    const a = starPosition("primary", sim.time);
    const b = starPosition("secondary", sim.time);
    primary.current?.position.set(a.x, a.y, a.z);
    secondary.current?.position.set(b.x, b.y, b.z);
    materials.current.forEach((material) => {
      if (material.uniforms.uCamera) material.uniforms.uCamera.value.copy(camera.position);
      if (material.uniforms.uTime) material.uniforms.uTime.value = sim.time;
    });
  });
  const remember = (material: ShaderMaterial | null) => {
    if (material && !materials.current.includes(material)) materials.current.push(material);
  };
  return (
    <group>
      <group ref={primary}>
        <mesh>
          <sphereGeometry args={[BINARY.primary.radius, 48, 32]} />
          <shaderMaterial
            ref={remember}
            vertexShader={STAR_VERT}
            fragmentShader={STAR_FRAG}
            uniforms={{ uColor: { value: STAR_A }, uCamera: { value: new Vector3() }, uTime: { value: 0 } }}
          />
        </mesh>
        <mesh scale={2.15}>
          <sphereGeometry args={[BINARY.primary.radius, 32, 24]} />
          <shaderMaterial
            ref={remember}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            vertexShader={STAR_VERT}
            fragmentShader={CORONA_FRAG}
            uniforms={{ uColor: { value: STAR_A }, uCamera: { value: new Vector3() } }}
          />
        </mesh>
      </group>
      <group ref={secondary}>
        <mesh>
          <sphereGeometry args={[BINARY.secondary.radius, 40, 28]} />
          <shaderMaterial
            ref={remember}
            vertexShader={STAR_VERT}
            fragmentShader={STAR_FRAG}
            uniforms={{ uColor: { value: STAR_B }, uCamera: { value: new Vector3() }, uTime: { value: 0 } }}
          />
        </mesh>
        <mesh scale={2.05}>
          <sphereGeometry args={[BINARY.secondary.radius, 28, 20]} />
          <shaderMaterial
            ref={remember}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            vertexShader={STAR_VERT}
            fragmentShader={CORONA_FRAG}
            uniforms={{ uColor: { value: STAR_B }, uCamera: { value: new Vector3() } }}
          />
        </mesh>
      </group>
    </group>
  );
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
  const radius = bodyRadius(kind);
  const group = useRef<Group>(null);
  const spin = useRef<Group>(null);
  const { camera, gl } = useThree();
  const surface = useMemo(() => {
    const fragment = kind === "ocean" ? OCEAN_FRAG : kind === "rocky" ? ROCKY_FRAG : GIANT_FRAG;
    const displace = kind === "rocky" ? 0.085 : kind === "ocean" ? 0.035 : 0.012;
    return makeLitMaterial(fragment, displace);
  }, [kind]);
  const clouds = useMemo(() => {
    const material = makeLitMaterial(CLOUD_FRAG, 0);
    material.transparent = true;
    material.depthWrite = false;
    material.blending = NormalBlending;
    return material;
  }, []);
  const air = useMemo(() => {
    const tint = kind === "ocean" ? new Color("#8fd6ff") : kind === "rocky" ? new Color("#e7b089") : new Color("#f2d7b0");
    return new ShaderMaterial({
      vertexShader: AIR_VERT,
      fragmentShader: AIR_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: BackSide,
      uniforms: { uTint: { value: tint }, uCamera: { value: new Vector3() } },
    });
  }, [kind]);
  const rings = useMemo(() => {
    if (kind !== "giant") return null;
    return new ShaderMaterial({
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uStarA: { value: new Vector3() },
        uStarB: { value: new Vector3() },
        uColorA: { value: STAR_A },
        uColorB: { value: STAR_B },
      },
    });
  }, [kind]);

  useFrame((_, delta) => {
    const position = planetPosition(piece.id, index, sim.time);
    group.current?.position.set(position.x, position.y, position.z);
    if (!reduced && spin.current) spin.current.rotation.y += delta * (kind === "giant" ? 0.08 : 0.12);
    pushStars(surface, camera.position);
    if (kind === "ocean") pushStars(clouds, camera.position);
    air.uniforms.uCamera.value.copy(camera.position);
    if (rings) pushStars(rings, camera.position);
  });

  const sphere = useMemo(
    () => new SphereGeometry(1, quality.sphereWidth, quality.sphereHeight),
    [quality.sphereWidth, quality.sphereHeight],
  );

  return (
    <group ref={group}>
      <group ref={spin}>
        <mesh geometry={sphere} material={surface} scale={radius} />
        {kind === "ocean" ? (
          <mesh geometry={sphere} material={clouds} scale={radius * 1.035} />
        ) : null}
        <mesh geometry={sphere} material={air} scale={radius * 1.035} />
      </group>
      {rings ? (
        <mesh material={rings} rotation={[Math.PI / 2.4, 0.2, 0.15]}>
          <ringGeometry args={[radius * 1.38, radius * 1.78, quality.ringSegments]} />
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
      <LabelAnchor id={piece.id} hidden={selected} lift={visualRadius(kind) + 0.15} />
    </group>
  );
}

function LabelAnchor({ id, hidden, lift }: { id: string; hidden: boolean; lift: number }) {
  const anchor = useRef<Group>(null);
  const { camera, size } = useThree();
  const point = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const group = anchor.current;
    const el = document.getElementById(`marker-${id}`);
    if (!group || !el) return;
    if (hidden) {
      el.style.visibility = "hidden";
      return;
    }
    group.getWorldPosition(point);
    point.project(camera);
    const x = (point.x * 0.5 + 0.5) * size.width;
    const y = (-point.y * 0.5 + 0.5) * size.height;
    const nudge = size.width < 800 ? (id.length % 3 - 1) * 42 : 0;
    el.style.transform = `translate3d(${x + nudge}px, ${y}px, 0) translate(-50%, -140%)`;
    el.style.visibility = point.z > 1 ? "hidden" : "visible";
  });
  return <group ref={anchor} position={[0, lift, 0]} />;
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
  useFrame((_, delta) => {
    if (!reduced) elapsed.current += delta;
    sim.time = reduced ? 0 : elapsed.current;
  });
  return (
    <>
      <color attach="background" args={["#070910"]} />
      <Sky />
      <Starfield count={quality.stars} />
      <Clusters count={quality.clusters} />
      <Galaxies count={quality.galaxies} />
      <Stars />
      {pieces.map((piece, index) => (
        <OrbitLine key={`${piece.id}-orbit`} id={piece.id} index={index} segments={quality.ringSegments} />
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
  const spherical = useRef({ radius: initial, phi: 1.02, theta: 0.62 });
  const goal = useRef({ radius: initial, phi: 1.02, theta: 0.62 });
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
    const closest = focusDistance(visualRadius(kind), size.width, size.height);
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
      const look = framedLook(
        { x: bag.eye.x, y: bag.eye.y, z: bag.eye.z },
        { x: pivot.current.x, y: pivot.current.y, z: pivot.current.z },
        size.width,
        size.height,
        current.radius,
      );
      bag.look.set(look.x, look.y, look.z);
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
    goal.current.radius = focusDistance(visualRadius(kind), size.width, size.height);
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
      target.radius = homeRadius(size.width / Math.max(size.height, 1));
      target.phi = 1.02;
      target.theta = 0.62;
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
        target.radius = homeRadius(size.width / Math.max(size.height, 1));
        target.phi = 1.02;
        target.theta = 0.62;
      }
    } else if (command.type === "left" || command.type === "right") {
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
