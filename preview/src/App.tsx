import { Component, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping } from "three";
import { pieces } from "./data/content";
import { openLinkedIn } from "./data/links";
import { accentFor } from "./scene/system";
import { FOV_DEG } from "./scene/framing";
import { detectQuality } from "./scene/quality";
import { Universe, type RigCommand } from "./scene/Scene";
import { Chrome, Fallback, Hint, Panel } from "./ui/Interface";

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function idFromHash() {
  const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  return pieces.some((piece) => piece.id === id) ? id : null;
}

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function App() {
  const catalog = useMemo(() => pieces, []);
  const quality = useMemo(() => detectQuality(), []);
  const [selectedId, setSelectedId] = useState<string | null>(() => idFromHash());
  const [failed, setFailed] = useState(() => !webglAvailable());
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [touch, setTouch] = useState(
    () => window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0,
  );
  const [command, setCommand] = useState<RigCommand | null>(null);
  const seq = useRef(0);
  const returnFocus = useRef<string | null>(null);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = window.matchMedia("(pointer: coarse)");
    const onMotion = () => setReduced(motion.matches);
    const onPointer = () => setTouch(pointer.matches || navigator.maxTouchPoints > 0);
    motion.addEventListener("change", onMotion);
    pointer.addEventListener("change", onPointer);
    return () => {
      motion.removeEventListener("change", onMotion);
      pointer.removeEventListener("change", onPointer);
    };
  }, []);

  useEffect(() => {
    const sync = () => setSelectedId(idFromHash());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (selectedId) {
      document.getElementById("panel-close")?.focus();
      return;
    }
    if (returnFocus.current) {
      document.getElementById(`marker-${returnFocus.current}`)?.focus();
      returnFocus.current = null;
    }
  }, [selectedId]);

  const issue = (type: RigCommand["type"]) => {
    seq.current += 1;
    setCommand({ seq: seq.current, type });
  };

  const open = (id: string) => {
    if (idFromHash() !== id) window.location.hash = encodeURIComponent(id);
    else setSelectedId(id);
  };

  const close = () => {
    returnFocus.current = selectedId;
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setSelectedId(null);
  };

  const back = () => {
    issue("back");
    close();
  };

  const reset = () => {
    issue("reset");
    close();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const typing = Boolean(target?.closest(".panel, a, input, textarea, select"));
      if (event.key === "Escape" && selectedId) {
        event.preventDefault();
        back();
        return;
      }
      if (typing) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        issue(event.key === "ArrowLeft" ? "left" : "right");
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        issue(event.key === "ArrowUp" ? "up" : "down");
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        issue("in");
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        issue("out");
      } else if (event.key === "Home" || event.key === "r" || event.key === "R") {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        event.preventDefault();
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (failed) {
    return (
      <Fallback
        pieces={catalog}
        reason="This browser can't show the 3D view. The projects are listed here."
      />
    );
  }

  const selected = catalog.find((piece) => piece.id === selectedId) ?? null;

  return (
    <div className="app">
      <p className="sr-only">
        A three-dimensional space of projects. Tab to a project name and press Enter to read it.
        Escape goes back. R resets the view. Arrow keys orbit. Plus and minus zoom.
      </p>
      <div className="labels">
        {catalog.map((piece, index) =>
          piece.id === selectedId ? null : (
            <button
              key={piece.id}
              id={`marker-${piece.id}`}
              type="button"
              className="marker"
              aria-label={piece.title}
              style={{ "--accent": accentFor(piece.id, index) } as CSSProperties}
              onClick={() => open(piece.id)}
            >
              <span className="sr-only">{piece.title}</span>
            </button>
          ),
        )}
        <button id="sun-primary" type="button" className="marker" aria-label="Tom Gray on LinkedIn" onClick={openLinkedIn}>
          <span className="sr-only">Tom Gray on LinkedIn</span>
        </button>
        <button id="sun-secondary" type="button" className="marker" aria-label="Tom Gray on LinkedIn" onClick={openLinkedIn}>
          <span className="sr-only">Tom Gray on LinkedIn</span>
        </button>
      </div>
      <div className="stage">
        <SceneBoundary onError={() => setFailed(true)}>
          <Suspense fallback={null}>
          <Canvas
            dpr={[1, quality.dprMax]}
            frameloop="always"
            camera={{ fov: FOV_DEG, near: 0.05, far: 1200, position: [0, 8, 28] }}
            gl={{
              antialias: quality.antialias,
              alpha: false,
              stencil: false,
              powerPreference: "high-performance",
              failIfMajorPerformanceCaveat: false,
            }}
            onCreated={({ gl }) => {
              gl.setClearColor("#07080e");
              gl.toneMapping = ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.05;
              gl.domElement.addEventListener("webglcontextlost", (event) => {
                event.preventDefault();
                setFailed(true);
              });
            }}
          >
            <Universe
              pieces={catalog}
              quality={quality}
              reduced={reduced}
              selectedId={selectedId}
              command={command}
              onSelect={open}
            />
          </Canvas>
          </Suspense>
        </SceneBoundary>
      </div>
      <Chrome onReset={reset} />
      <Hint touch={touch} hidden={Boolean(selected)} />
      {selected ? <Panel piece={selected} onBack={back} onReset={reset} /> : null}
    </div>
  );
}
