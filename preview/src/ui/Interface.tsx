import { useEffect, type KeyboardEvent } from "react";
import { panelModel, type Piece } from "../data/content";

export function Chrome({ onReset }: { onReset: () => void }) {
  return (
    <header className="chrome">
      <h1>tom gray</h1>
      <button type="button" className="text-button" onClick={onReset}>
        Reset view
      </button>
    </header>
  );
}

export function Hint({ touch, hidden }: { touch: boolean; hidden: boolean }) {
  if (hidden) return null;
  return (
    <p className="hint">
      {touch
        ? "Drag to look · Pinch to move closer · Tap a planet"
        : "Drag to look · Scroll to move closer · Click a planet"}
      <span className="keys">Arrows orbit · +/− zoom · Enter opens · Esc back · R reset</span>
    </p>
  );
}

function focusables(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea")].filter(
    (node) => !node.hasAttribute("disabled") && node.tabIndex !== -1,
  );
}

export function Panel({
  piece,
  onBack,
  onReset,
}: {
  piece: Piece;
  onBack: () => void;
  onReset: () => void;
}) {
  const model = panelModel(piece);

  useEffect(() => {
    document.getElementById("panel-close")?.focus();
  }, [piece.id]);

  const trap = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const items = focusables(event.currentTarget);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="panel-title"
      onKeyDown={trap}
    >
      <div className="panel-head">
        <p className="kicker">project</p>
        <button id="panel-close" type="button" className="text-button" onClick={onBack}>
          Back
        </button>
      </div>
      <h2 id="panel-title">{model.title}</h2>
      {model.banner ? <p className="lede">{model.banner}</p> : null}
      {model.problem ? (
        <section>
          <h3>what it&apos;s for</h3>
          <p>{model.problem}</p>
        </section>
      ) : null}
      {model.build.length > 0 ? (
        <section>
          <h3>how it&apos;s built</h3>
          <ul>
            {model.build.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <dl className="meta">
        {model.language ? (
          <div>
            <dt>written in</dt>
            <dd>{model.language}</dd>
          </div>
        ) : null}
        {model.pushed ? (
          <div>
            <dt>last pushed</dt>
            <dd>{model.pushed}</dd>
          </div>
        ) : null}
        {model.stars ? (
          <div>
            <dt>stars</dt>
            <dd>{model.stars}</dd>
          </div>
        ) : null}
      </dl>
      {model.terms ? (
        <p className="terms">
          <span className="stamp">{model.terms.stamp}</span>
          {model.terms.line}
        </p>
      ) : null}
      <div className="panel-actions">
        {model.url ? (
          <a className="out" href={model.url} target="_blank" rel="noopener noreferrer">
            see the work
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}
        <button type="button" className="text-button" onClick={onReset}>
          Reset view
        </button>
      </div>
    </div>
  );
}

export function Fallback({ pieces, reason }: { pieces: Piece[]; reason: string }) {
  return (
    <main className="fallback">
      <h1>tom gray</h1>
      <p>{reason}</p>
      {pieces.map((piece) => {
        const model = panelModel(piece);
        return (
          <article key={piece.id} id={piece.id}>
            <h2>{model.title}</h2>
            {model.banner ? <p className="lede">{model.banner}</p> : null}
            {model.problem ? <p>{model.problem}</p> : null}
            {model.url ? (
              <a href={model.url} target="_blank" rel="noopener noreferrer">
                see the work
              </a>
            ) : null}
          </article>
        );
      })}
    </main>
  );
}
