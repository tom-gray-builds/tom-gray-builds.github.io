import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Detailed, Environment, Lightformer } from "@react-three/drei";
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  MathUtils,
  PointsMaterial,
  Spherical,
  SRGBColorSpace,
  Vector3,
  type Group,
} from "three";
import type { Piece } from "../data/content";
import { getKit } from "./geometry";
import { appearanceFor, placementFor } from "./layout";
import { getMaterials } from "./materials";
import { NOISE_GLSL } from "./noise.glsl";
import { pointerGate } from "./pointer";
import type { Quality } from "./quality";
import {
  clampPhi,
  clampRadius,
  focusDistance,
  homeRadius,
  pointerExceededDrag,
  shortestAngle,
  zoomRadius,
  type ViewMode,
} from "./rig";

export type RigCommand = {
  seq: number;
  type: "reset" | "back" | "left" | "right" | "up" | "down" | "in" | "out";
};

const SORTS = [
  { angle: 0.2, radius: 2.62, scale: [0.34, 0.46, 0.22] as const, glass: false, y: 0.08 },
  { angle: 1.15, radius: 2.85, scale: [0.26, 0.36, 0.18] as const, glass: true, y: -0.06 },
  { angle: 2.25, radius: 2.5, scale: [0.42, 0.28, 0.24] as const, glass: false, y: 0.12 },
  { angle: 3.35, radius: 2.78, scale: [0.22, 0.4, 0.2] as const, glass: true, y: 0.02 },
  { angle: 4.45, radius: 2.42, scale: [0.32, 0.24, 0.28] as const, glass: false, y: -0.1 },
  { angle: 5.35, radius: 2.95, scale: [0.2, 0.38, 0.18] as const, glass: true, y: 0.07 },
];

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function circleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw a star sprite");
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.85)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function starGeometry(count: number, seed: number, near: number, far: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const rand = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const radius = near + rand() * (far - near);
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi) * 0.86;
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const tint = rand();
    const color = tint > 0.94 ? [1, 0.84, 0.68] : tint > 0.84 ? [0.72, 0.82, 1] : [0.86, 0.89, 0.95];
    colors[i * 3] = color[0] * (0.55 + rand() * 0.45);
    colors[i * 3 + 1] = color[1] * (0.55 + rand() * 0.45);
    colors[i * 3 + 2] = color[2] * (0.55 + rand() * 0.45);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFragment = /* glsl */ `
varying vec3 vDir;
${NOISE_GLSL}
void main() {
  vec3 dir = normalize(vDir);
  float band = exp(-pow((dir.y * 0.92 + dir.x * 0.22) / 0.16, 2.0));
  float clouds = fbm(dir * 2.4);
  float dust = fbm(dir * 1.5 + 8.0);
  vec3 color = vec3(0.025, 0.03, 0.05);
  color += vec3(0.16, 0.13, 0.24) * band * (0.35 + clouds);
  color += vec3(0.28, 0.14, 0.08) * smoothstep(0.55, 0.9, dust) * 0.4;
  gl_FragColor = vec4(color, 1.0);
}
`;

function Sky() {
  return (
    <mesh frustumCulled={false} renderOrder={-20}>
      <sphereGeometry args={[200, 40, 28]} />
      <shaderMaterial side={BackSide} depthWrite={false} vertexShader={skyVertex} fragmentShader={skyFragment} />
    </mesh>
  );
}

function Stars({ count }: { count: number }) {
  const far = useMemo(() => starGeometry(count, 0x51f00d, 55, 130), [count]);
  const near = useMemo(() => starGeometry(Math.round(count * 0.22), 0x91a, 28, 54), [count]);
  const map = useMemo(() => circleTexture(), []);
  const farMaterial = useMemo(
    () =>
      new PointsMaterial({
        map,
        size: 1.15,
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        vertexColors: true,
        opacity: 0.85,
      }),
    [map],
  );
  const nearMaterial = useMemo(
    () =>
      new PointsMaterial({
        map,
        size: 0.42,
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        vertexColors: true,
        opacity: 0.7,
      }),
    [map],
  );
  return (
    <group>
      <points geometry={far} material={farMaterial} dispose={null} />
      <points geometry={near} material={nearMaterial} dispose={null} />
    </group>
  );
}

function LabelAnchor({ id, hidden }: { id: string; hidden: boolean }) {
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
    el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -130%)`;
    el.style.visibility = point.z > 1 ? "hidden" : "visible";
  });
  return <group ref={anchor} position={[0, 1.92, 0]} />;
}

function Hit({ onSelect, id }: { onSelect: (id: string) => void; id: string }) {
  const { gl } = useThree();
  const kit = getKitSafe();
  const materials = getMaterials();
  return (
    <mesh
      geometry={kit.hit}
      material={materials.hit}
      dispose={null}
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
        onSelect(id);
      }}
    />
  );
}

const qualityRef: { current: Quality | null } = { current: null };

function getKitSafe() {
  if (!qualityRef.current) throw new Error("Quality is not ready");
  return getKit(qualityRef.current);
}

function Blinds({ reduced }: { reduced: boolean }) {
  const kit = getKitSafe();
  const materials = getMaterials();
  const spin = useRef<Group>(null);
  const wheel = useRef<Group>(null);
  useFrame((_, delta) => {
    if (reduced || !spin.current || !wheel.current) return;
    spin.current.rotation.y += delta * 0.05;
    wheel.current.rotation.y -= delta * 0.12;
  });
  return (
    <group ref={spin}>
      <mesh geometry={kit.core} material={materials.glow} dispose={null} />
      <mesh geometry={kit.brassSlats} material={materials.brass} dispose={null} />
      <mesh geometry={kit.bronzeSlats} material={materials.bronze} dispose={null} />
      <mesh geometry={kit.meridian} material={materials.bronze} rotation={[0, 0.4, 0]} dispose={null} />
      <group ref={wheel} rotation={[1.18, 0.25, 0.35]}>
        <mesh geometry={kit.blades} material={materials.brass} dispose={null} />
      </group>
      <pointLight color="#ff8a3c" intensity={8} distance={6.5} decay={2} />
    </group>
  );
}

function Press({ reduced }: { reduced: boolean }) {
  const kit = getKitSafe();
  const materials = getMaterials();
  const spin = useRef<Group>(null);
  const orbit = useRef<Group>(null);
  useFrame((_, delta) => {
    if (reduced || !spin.current || !orbit.current) return;
    spin.current.rotation.y += delta * 0.04;
    orbit.current.rotation.y += delta * 0.18;
  });
  return (
    <group ref={spin}>
      <mesh geometry={kit.sphere} material={materials.marble} dispose={null} />
      <group rotation={[1.08, 0.18, 0.22]}>
        <mesh geometry={kit.glassBand} material={materials.glass} dispose={null} />
        <mesh geometry={kit.ticks} material={materials.gold} dispose={null} />
        <mesh geometry={kit.inkRule} material={materials.lead} rotation={[Math.PI / 2, 0, 0]} dispose={null} />
        <mesh geometry={kit.pearlRing} material={materials.chrome} rotation={[Math.PI / 2, 0, 0]} scale={1.5} dispose={null} />
        <Detailed distances={[0, 48]}>
          <group ref={orbit}>
            {SORTS.map((sort) => (
              <mesh
                key={sort.angle}
                geometry={kit.sortBox}
                material={sort.glass ? materials.glass : materials.lead}
                position={[Math.cos(sort.angle) * sort.radius, sort.y, Math.sin(sort.angle) * sort.radius]}
                scale={sort.scale}
                rotation={[0.2, sort.angle, 0.4]}
                dispose={null}
              />
            ))}
          </group>
          <group />
        </Detailed>
      </group>
    </group>
  );
}

function Twin({ reduced }: { reduced: boolean }) {
  const kit = getKitSafe();
  const materials = getMaterials();
  const spin = useRef<Group>(null);
  const moon = useRef<Group>(null);
  useFrame((_, delta) => {
    if (reduced || !spin.current || !moon.current) return;
    spin.current.rotation.y -= delta * 0.045;
    moon.current.rotation.y += delta * 0.35;
  });
  return (
    <group ref={spin}>
      <mesh geometry={kit.sphere} material={materials.pearl} dispose={null} />
      <mesh geometry={kit.pearlRing} material={materials.gold} rotation={[0.78, 0.3, 0.18]} dispose={null} />
      <mesh
        geometry={kit.sphere}
        material={materials.glassGhost}
        position={[0.68, 0.12, -0.26]}
        scale={1.24}
        dispose={null}
      />
      <mesh geometry={kit.twinRingA} material={materials.chrome} rotation={[0.95, 0.25, 0.5]} dispose={null} />
      <mesh geometry={kit.twinRingB} material={materials.glass} rotation={[1.28, 0.45, 0.12]} dispose={null} />
      <Detailed distances={[0, 48]}>
        <group ref={moon}>
          <mesh geometry={kit.sphere} material={materials.glass} position={[1.95, 0.35, 0.15]} scale={0.2} dispose={null} />
        </group>
        <group />
      </Detailed>
    </group>
  );
}

function Planet({
  piece,
  index,
  total,
  selected,
  reduced,
  onSelect,
}: {
  piece: Piece;
  index: number;
  total: number;
  selected: boolean;
  reduced: boolean;
  onSelect: (id: string) => void;
}) {
  const kind = appearanceFor(piece.id, index);
  const position = placementFor(piece.id, index, total);
  return (
    <group position={position}>
      {kind === "blinds" ? <Blinds reduced={reduced} /> : null}
      {kind === "press" ? <Press reduced={reduced} /> : null}
      {kind === "twin" ? <Twin reduced={reduced} /> : null}
      <Hit id={piece.id} onSelect={onSelect} />
      <LabelAnchor id={piece.id} hidden={selected} />
    </group>
  );
}

function Lighting() {
  return (
    <>
      <hemisphereLight args={["#c9d6ff", "#2a1c14", 0.42]} />
      <ambientLight intensity={0.08} />
      <directionalLight position={[8, 10, 6]} intensity={3.4} color="#fff4e8" />
      <directionalLight position={[-9, 3, -5]} intensity={1.35} color="#9eb6ff" />
      <directionalLight position={[1, -6, -7]} intensity={0.7} color="#ffb089" />
    </>
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
  qualityRef.current = quality;
  return (
    <>
      <color attach="background" args={["#07080e"]} />
      <Sky />
      <Stars count={quality.stars} />
      <Lighting />
      <Environment
        resolution={quality.envResolution}
        frames={1}
        background={false}
        environmentIntensity={1}
      >
        <Lightformer form="circle" intensity={40} color="#fff4e4" position={[5, 6, 6]} scale={1.1} />
        <Lightformer form="circle" intensity={22} color="#c5d4ff" position={[-6, 3, 4]} scale={1.35} />
        <Lightformer form="circle" intensity={18} color="#ffc29a" position={[1, -4, 7]} scale={1.5} />
        <Lightformer form="circle" intensity={28} color="#ffffff" position={[-3, 5, -6]} scale={0.7} />
        <Lightformer form="circle" intensity={12} color="#efe4ff" position={[7, -1, -3]} scale={1.8} />
      </Environment>
      {pieces.map((piece, index) => (
        <Planet
          key={piece.id}
          piece={piece}
          index={index}
          total={pieces.length}
          selected={piece.id === selectedId}
          reduced={reduced}
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
  const initialRadius = homeRadius(aspect);
  const spherical = useRef({ radius: initialRadius, phi: 1.16, theta: 0.5 });
  const goal = useRef({ radius: initialRadius, phi: 1.16, theta: 0.5 });
  const pivot = useRef(new Vector3());
  const goalPivot = useRef(new Vector3());
  const saved = useRef<{ radius: number; phi: number; theta: number } | null>(null);
  const userAdjusted = useRef(false);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  const down = useRef({ x: 0, y: 0 });
  const scratch = useRef({
    spherical: new Spherical(),
    offset: new Vector3(),
    eye: new Vector3(),
    look: new Vector3(),
    right: new Vector3(),
    up: new Vector3(),
    z: new Vector3(),
    upAxis: new Vector3(0, 1, 0),
  });

  const mode = (): ViewMode => (selectedRef.current ? "focus" : "explore");

  const place = (dt: number) => {
    const current = spherical.current;
    const target = goal.current;
    if (reduced || dt === 0) {
      current.radius = target.radius;
      current.phi = target.phi;
      current.theta = target.theta;
      pivot.current.copy(goalPivot.current);
    } else {
      const lambda = 2.7;
      current.radius = MathUtils.damp(current.radius, target.radius, lambda, dt);
      current.phi = MathUtils.damp(current.phi, target.phi, lambda, dt);
      current.theta = MathUtils.damp(current.theta, shortestAngle(current.theta, target.theta), lambda, dt);
      const alpha = 1 - Math.exp(-lambda * dt);
      pivot.current.lerp(goalPivot.current, alpha);
    }

    const bag = scratch.current;
    bag.spherical.set(current.radius, current.phi, current.theta);
    bag.offset.setFromSpherical(bag.spherical);
    bag.eye.copy(pivot.current).add(bag.offset);
    bag.look.copy(pivot.current);
    if (selectedId) {
      bag.z.copy(bag.offset).normalize();
      bag.right.crossVectors(bag.upAxis, bag.z);
      if (bag.right.lengthSq() < 1e-5) bag.right.set(1, 0, 0);
      bag.right.normalize();
      bag.up.crossVectors(bag.z, bag.right).normalize();
      const portrait = size.width / Math.max(size.height, 1) < 0.9;
      const reach = current.radius * 0.24;
      bag.look.addScaledVector(bag.right, portrait ? 0 : -reach);
      bag.look.addScaledVector(bag.up, portrait ? -reach * 0.95 : -reach * 0.08);
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
    if (!saved.current) {
      saved.current = { ...goal.current };
    }
    const index = pieces.findIndex((piece) => piece.id === selectedId);
    const [x, y, z] = placementFor(selectedId, Math.max(index, 0), pieces.length);
    goalPivot.current.set(x, y, z);
    goal.current.radius = focusDistance();
    goal.current.phi = clampPhi(goal.current.phi * 0.62 + 1.02 * 0.38);
    invalidate();
  }, [selectedId, pieces, invalidate]);

  useLayoutEffect(() => {
    if (selectedId || userAdjusted.current) return;
    goal.current.radius = homeRadius(size.width / Math.max(size.height, 1));
    invalidate();
  }, [size.width, size.height, selectedId, invalidate]);

  useLayoutEffect(() => {
    if (!command) return;
    const target = goal.current;
    if (command.type === "reset") {
      saved.current = null;
      userAdjusted.current = false;
      goalPivot.current.set(0, 0, 0);
      target.radius = homeRadius(size.width / Math.max(size.height, 1));
      target.phi = 1.16;
      target.theta = 0.5;
    } else if (command.type === "back") {
      goalPivot.current.set(0, 0, 0);
      if (saved.current) {
        target.radius = saved.current.radius;
        target.phi = saved.current.phi;
        target.theta = saved.current.theta;
        saved.current = null;
      } else {
        target.radius = homeRadius(size.width / Math.max(size.height, 1));
        target.phi = 1.16;
        target.theta = 0.5;
      }
    } else if (command.type === "left" || command.type === "right") {
      userAdjusted.current = true;
      target.theta += command.type === "left" ? 0.2 : -0.2;
    } else if (command.type === "up" || command.type === "down") {
      userAdjusted.current = true;
      target.phi = clampPhi(target.phi + (command.type === "down" ? 0.12 : -0.12));
    } else if (command.type === "in" || command.type === "out") {
      userAdjusted.current = true;
      target.radius = zoomRadius(target.radius, command.type === "out" ? 220 : -220, mode());
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
      if (active.size >= 2) {
        const points = [...active.values()];
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        if (pinch.current > 0) {
          const next = clampRadius(spherical.current.radius * (pinch.current / distance), mode());
          spherical.current.radius = next;
          goal.current.radius = next;
          userAdjusted.current = true;
        }
        pinch.current = distance;
        invalidate();
        return;
      }
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      spherical.current.theta -= dx * 0.0052;
      spherical.current.phi = clampPhi(spherical.current.phi + dy * 0.0042);
      goal.current.theta = spherical.current.theta;
      goal.current.phi = spherical.current.phi;
      userAdjusted.current = true;
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
      goal.current.radius = zoomRadius(goal.current.radius, event.deltaY * scale, mode());
      userAdjusted.current = true;
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
  }, [gl, invalidate]);

  useFrame((_, delta) => {
    place(delta);
    if (!reduced) return;
    const current = spherical.current;
    const target = goal.current;
    const moving =
      Math.abs(current.radius - target.radius) > 0.02 ||
      Math.abs(current.phi - target.phi) > 0.002 ||
      pivot.current.distanceTo(goalPivot.current) > 0.02;
    if (moving) invalidate();
  });

  return null;
}
