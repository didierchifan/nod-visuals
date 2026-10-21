import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ASPECTS } from "../../visuals/contours/config.ts";
import type { AspectId } from "../../visuals/contours/types.ts";
import {
  COLORS,
  DEFAULT_CONFIG,
  normalizeConfig,
  PARAMS,
  type FluidConfig,
  type Section,
} from "../../visuals/fluid/config.ts";
import {
  FluidCanvas,
  type FluidView,
} from "../../visuals/fluid/FluidCanvas.tsx";
import { fitAspect } from "../../visuals/fluid/water.ts";
import type { FrameOf } from "../../visuals/frame.ts";
import {
  createText,
  drawTexts,
  loadFonts,
  type TextLayer,
} from "../../visuals/text/text.ts";
import type { SwatchSource } from "../contours/ColorField.tsx";
import { Knob } from "../contours/Knob.tsx";
import { loadLogo, loadTexts, storeLogo, storeTexts } from "../contours/lab.ts";
import { Logo } from "../contours/Logo.tsx";
import { LogoPanel } from "../contours/LogoPanel.tsx";
import { Segmented } from "../contours/Segmented.tsx";
import { TextOverlay } from "../contours/TextOverlay.tsx";
import { TextPanel } from "../contours/TextPanel.tsx";
import { HexField } from "./HexField.tsx";
import { loadStored, LOGO_KEY, store, TEXTS_KEY } from "./lab.ts";
import "../contours/lab.css";
import "./fluid.css";

const SECTIONS: { id: Section; title: string }[] = [
  { id: "frame", title: "Frame" },
  { id: "color", title: "Colour" },
  { id: "big", title: "Big waves" },
  { id: "small", title: "Small waves" },
];

const ASPECT_IDS = Object.keys(ASPECTS) as AspectId[];

const ZOOM = PARAMS.find((spec) => spec.key === "zoom")!;
/** Each press of a zoom button or + and −. */
const ZOOM_STEP = 1.25;

/** Texts and the logo can wear the water's two colours, and follow them. */
const SWATCHES: SwatchSource = {
  line: "Depth colour",
  accent: "Surface colour",
  follows: "changes with the water",
};

/** Arrow keys move a selected text this many hundredths of the picture. */
const NUDGES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const unit = (v: number) => Math.min(1, Math.max(0, v));

/** 2026-10-21 14:32:07 local time as 20261021-143207. */
const stamp = () =>
  new Date().toLocaleString("sv-SE").replace(/[-:]/g, "").replace(" ", "-");

export default function FluidLab() {
  const [config, setConfig] = useState<FluidConfig>(
    () => loadStored() ?? DEFAULT_CONFIG,
  );
  const [notice, setNotice] = useState("");
  // The settings Defaults replaced, while its notice offers them back.
  const [undo, setUndo] = useState<FluidConfig | null>(null);
  const [logo, setLogo] = useState(() => loadLogo(LOGO_KEY));
  const [texts, setTexts] = useState<TextLayer[]>(() => loadTexts(TEXTS_KEY));
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"fluid" | "text" | "logo">("fluid");
  const stage = useRef<HTMLDivElement>(null);
  const view = useRef<FluidView>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);

  const selectedText = texts.find((t) => t.id === selected);
  const textColors = { line: config.color1, accent: config.color2 };
  const frameOf: FrameOf = (width, height) =>
    fitAspect(ASPECTS[config.aspect], width, height);

  useEffect(() => store(config), [config]);

  useEffect(() => storeLogo(logo, LOGO_KEY), [logo]);

  useEffect(() => storeTexts(texts, TEXTS_KEY), [texts]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(
      () => {
        setNotice("");
        setUndo(null);
      },
      undo ? 8000 : 3600,
    );
    return () => clearTimeout(timer);
  }, [notice, undo]);

  const say = (message: string) => {
    setNotice(message);
    setUndo(null);
  };

  const settingsJson = () => JSON.stringify(config, null, 2);

  const set = <K extends keyof FluidConfig>(key: K, value: FluidConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const zoomBy = (factor: number) =>
    setConfig((c) => ({
      ...c,
      zoom: Math.min(
        ZOOM.max,
        Math.max(ZOOM.min, Number((c.zoom * factor).toFixed(2))),
      ),
    }));

  const resetDefaults = () => {
    setConfig(DEFAULT_CONFIG);
    setNotice("Back to the default settings");
    setUndo(config);
  };

  const editText = (id: string, change: Partial<TextLayer>) =>
    setTexts((ts) => ts.map((t) => (t.id === id ? { ...t, ...change } : t)));

  const select = (id: string | null) => {
    setSelected(id);
    if (id) setTab("text");
    // An emptied text has nothing left to click, so it goes once it is let go.
    setTexts((ts) => {
      const kept = ts.filter((t) => t.id === id || t.content.trim());
      return kept.length === ts.length ? ts : kept;
    });
  };

  /** Puts the cursor in the selected text's words: all of them selected, or after the last. */
  const focusWords = (all: boolean) => {
    const input = textInput.current;
    if (!input) return;
    input.focus();
    if (all) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
  };

  const addText = () => {
    const text = createText(selectedText ?? texts.at(-1));
    flushSync(() => {
      setTexts((ts) => [...ts, text]);
      select(text.id);
    });
    focusWords(true);
  };

  const removeText = () => {
    setTexts((ts) => ts.filter((t) => t.id !== selected));
    setSelected(null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(settingsJson());
      say("Copied settings");
    } catch {
      say(
        "The browser blocked the clipboard. Press ⌘C with nothing selected instead.",
      );
    }
  };

  const exportPng = async () => {
    const canvas = view.current?.capture();
    if (!canvas) return;
    if (texts.length) {
      await loadFonts(texts);
      drawTexts(
        canvas.getContext("2d")!,
        texts,
        textColors,
        canvas.width,
        canvas.height,
      );
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fluid-${stamp()}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  };

  const resetView = () => view.current?.resetView();

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.current?.requestFullscreen();
  };

  useEffect(() => {
    const isControl = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      target.closest('button, input, textarea, select, [role="slider"]') !==
        null;

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isControl(e.target)) return;
      // A selected text takes the arrows, a hundredth of the picture at a time or ten with Shift.
      if (selectedText && e.key in NUDGES) {
        const [dx, dy] = NUDGES[e.key];
        const by = (e.shiftKey ? 10 : 1) / 100;
        editText(selectedText.id, {
          x: unit(selectedText.x + dx * by),
          y: unit(selectedText.y + dy * by),
        });
      } else if (selectedText && (e.key === "Backspace" || e.key === "Delete"))
        removeText();
      else if (selectedText && e.key === "Escape") select(null);
      else if (e.key === "f") toggleFullscreen();
      else if (e.key === "l") setLogo((l) => ({ ...l, shown: !l.shown }));
      else if (e.key === "t") addText();
      else if (e.key === "r") resetView();
      else if (e.key === "+" || e.key === "=") zoomBy(ZOOM_STEP);
      else if (e.key === "-") zoomBy(1 / ZOOM_STEP);
      else return;
      e.preventDefault();
    };
    // ⌘C with nothing selected copies the settings; ⌘V of copied settings brings them back.
    const onCopy = (e: ClipboardEvent) => {
      if (isControl(e.target) || window.getSelection()?.toString()) return;
      e.clipboardData?.setData("text/plain", settingsJson());
      e.preventDefault();
      say("Copied settings");
    };
    const onPaste = (e: ClipboardEvent) => {
      // Pasting into a text's words or a hex is just typing.
      if (
        e.target instanceof HTMLElement &&
        e.target.closest('textarea, input[type="text"]')
      )
        return;
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(e.clipboardData?.getData("text/plain") ?? "");
      } catch {
        // Not JSON, so not ours.
      }
      const next = normalizeConfig(parsed);
      if (!next) {
        say("The clipboard does not hold fluid settings");
        return;
      }
      e.preventDefault();
      setConfig(next);
      say("Loaded the pasted settings");
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("copy", onCopy);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("paste", onPaste);
    };
  });

  return (
    <div className="lab fluid">
      <div className="lab-stage" ref={stage}>
        <header className="lab-bar">
          <div className="lab-id">
            <span className="lab-id-mode">Fluid</span>
          </div>
          <p className="lab-hint">
            {selectedText ? (
              <>
                Drag the text anywhere{" "}
                <span>
                  · arrows nudge · ⌫ delete · Esc or click away to let go
                </span>
              </>
            ) : (
              <>
                Drag to orbit, scroll to dolly{" "}
                <span>
                  · + − zoom · right-drag pans · R resets the view · F
                  fullscreen · L logo · T text · ⌘C ⌘V settings
                </span>
              </>
            )}
          </p>
          <div className="lab-bar-actions">
            <button
              type="button"
              className="lab-icon"
              onClick={() => zoomBy(1 / ZOOM_STEP)}
              disabled={config.zoom <= ZOOM.min}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" />
                <path d="m10.5 10.5 3 3M5 7h4" />
              </svg>
            </button>
            <button
              type="button"
              className="lab-icon"
              onClick={() => zoomBy(ZOOM_STEP)}
              disabled={config.zoom >= ZOOM.max}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" />
                <path d="m10.5 10.5 3 3M5 7h4M7 5v4" />
              </svg>
            </button>
            <button
              type="button"
              className="lab-icon"
              onClick={resetView}
              aria-label="Reset view"
              title="Reset view"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.5H5" />
              </svg>
            </button>
            <button
              type="button"
              className="lab-icon"
              onClick={addText}
              aria-label="Add text"
              title="Add text"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.5 4V3h9v1M8 3v10M6 13h4" />
              </svg>
            </button>
            <button
              type="button"
              className="lab-icon"
              onClick={toggleFullscreen}
              aria-label="Fullscreen"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
              </svg>
            </button>
          </div>
        </header>

        <div className="lab-canvas">
          {/* With a text selected, a click on the water lets it go. */}
          <FluidCanvas
            config={config}
            ref={view}
            onClick={selectedText ? () => select(null) : undefined}
          />
          {logo.shown && (
            <Logo
              frameOf={frameOf}
              placement={logo}
              color={logo.color}
              colors={textColors}
              onSelect={() => {
                select(null);
                setTab("logo");
              }}
              onChange={(placement) => setLogo((l) => ({ ...l, ...placement }))}
            />
          )}
          <TextOverlay
            frameOf={frameOf}
            texts={texts}
            colors={textColors}
            selected={selected}
            onSelect={select}
            onMove={(id, x, y) => editText(id, { x, y })}
            onEdit={() => focusWords(false)}
          />
        </div>
      </div>

      <aside className="lab-panel">
        <div className="lab-tabs">
          <div className="lab-seg" role="group" aria-label="Panel">
            <button
              type="button"
              aria-pressed={tab === "fluid"}
              onClick={() => {
                setTab("fluid");
                select(null);
              }}
            >
              Fluid
            </button>
            <button
              type="button"
              aria-pressed={tab === "text"}
              onClick={() => setTab("text")}
            >
              Text
            </button>
            <button
              type="button"
              aria-pressed={tab === "logo"}
              onClick={() => {
                setTab("logo");
                select(null);
              }}
            >
              Logo
            </button>
          </div>
        </div>

        {tab === "text" && (
          <div className="lab-scroll">
            <TextPanel
              texts={texts}
              text={selectedText}
              colors={textColors}
              source={SWATCHES}
              inputRef={textInput}
              onAdd={addText}
              onSelect={select}
              onChange={(change) => selected && editText(selected, change)}
              onRemove={removeText}
            />
          </div>
        )}

        {tab === "logo" && (
          <div className="lab-scroll">
            <LogoPanel
              logo={logo}
              colors={textColors}
              source={SWATCHES}
              onChange={(change) => setLogo((l) => ({ ...l, ...change }))}
            />
          </div>
        )}

        {/* Stays mounted under the other tabs, so it keeps its scroll. */}
        <div className="lab-scroll" hidden={tab !== "fluid"}>
          {SECTIONS.map((section) => (
            <section key={section.id} className="lab-section">
              <div className="lab-section-head">
                <h2>{section.title}</h2>
              </div>
              {section.id === "frame" && (
                <Segmented
                  label="Aspect"
                  options={ASPECT_IDS}
                  value={config.aspect}
                  onChange={(aspect) => set("aspect", aspect)}
                />
              )}
              {section.id === "color" && (
                <div className="fluid-colors">
                  {COLORS.map(({ key, label }) => (
                    <HexField
                      key={key}
                      label={label}
                      note={key}
                      value={config[key]}
                      onChange={(hex) => set(key, hex)}
                    />
                  ))}
                </div>
              )}
              <div className="lab-knobs">
                {PARAMS.filter((spec) => spec.section === section.id).map(
                  (spec) => (
                    <Knob
                      key={spec.key}
                      label={spec.label}
                      value={config[spec.key]}
                      min={spec.min}
                      max={spec.max}
                      step={spec.step}
                      defaultValue={DEFAULT_CONFIG[spec.key]}
                      onChange={(v) => set(spec.key, v)}
                    />
                  ),
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="lab-actions">
          <button
            type="button"
            className="lab-btn lab-btn-primary"
            onClick={copy}
          >
            Copy settings
          </button>
          <button
            type="button"
            className="lab-btn"
            onClick={resetDefaults}
            title="Every setting back to where the lab starts"
          >
            Defaults
          </button>
          <button type="button" className="lab-btn" onClick={exportPng}>
            PNG
          </button>
        </div>
        <p className="lab-notice" aria-live="polite">
          {notice}
          {undo && (
            <>
              {" · "}
              <button
                type="button"
                className="fluid-undo"
                onClick={() => {
                  setConfig(undo);
                  say("Your settings are back");
                }}
              >
                Undo
              </button>
            </>
          )}
        </p>
      </aside>
    </div>
  );
}
