"use client";

import {
  PlaygroundCanvas,
  useControls,
} from "@toriistudio/v0-playground-canvas";
import { Html } from "@react-three/drei";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import RadialRipples, {
  type RadialRipplesHandle,
  type ShaderPalette,
} from "@/components/RadialRipples";

const DEFAULT_TRACK_LABEL = "Built-in track";

type PaletteSectionKey = keyof ShaderPalette;
type PaletteChannelKey = keyof ShaderPalette["A"];

const DEFAULT_PALETTE: ShaderPalette = {
  A: { r: 0.5, g: 0.5, b: 0.5 },
  B: { r: 0.5, g: 0.5, b: 0.5 },
  C: { r: 1.0, g: 1.0, b: 1.0 },
  D: { r: 0.0, g: 0.1, b: 0.2 },
};

const clonePalette = (palette: ShaderPalette): ShaderPalette => ({
  A: { ...palette.A },
  B: { ...palette.B },
  C: { ...palette.C },
  D: { ...palette.D },
});

const paletteSections: Array<{
  key: PaletteSectionKey;
  label: string;
  helper: string;
}> = [
  { key: "A", label: "Vector A", helper: "Base offset" },
  { key: "B", label: "Vector B", helper: "Amplitude" },
  { key: "C", label: "Vector C", helper: "Frequency" },
  { key: "D", label: "Vector D", helper: "Phase shift" },
];

const CHANNEL_KEYS: PaletteChannelKey[] = ["r", "g", "b"];
const PALETTE_CONTROL_ENTRIES: Array<[PaletteSectionKey, PaletteChannelKey]> = [
  ["A", "r"],
  ["A", "g"],
  ["A", "b"],
  ["B", "r"],
  ["B", "g"],
  ["B", "b"],
  ["C", "r"],
  ["C", "g"],
  ["C", "b"],
  ["D", "r"],
  ["D", "g"],
  ["D", "b"],
];

const paletteRanges: Record<
  PaletteSectionKey,
  { min: number; max: number; step: number }
> = {
  A: { min: 0, max: 1, step: 0.01 },
  B: { min: -1, max: 1, step: 0.01 },
  C: { min: 0, max: 2, step: 0.01 },
  D: { min: 0, max: 1, step: 0.01 },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const paletteControlKey = (
  section: PaletteSectionKey,
  channel: PaletteChannelKey
) => `palette${section}${channel}`;

const palettesEqual = (a: ShaderPalette, b: ShaderPalette, epsilon = 1e-4) =>
  (Object.keys(a) as PaletteSectionKey[]).every((section) =>
    CHANNEL_KEYS.every(
      (channel) =>
        Math.abs(a[section][channel] - b[section][channel]) <= epsilon
    )
  );

const toNumberOr = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const paletteColorAt = (palette: ShaderPalette, t: number) => {
  const twoPi = Math.PI * 2;
  const computeChannel = (
    a: number,
    b: number,
    c: number,
    d: number
  ): number => {
    const value = a + b * Math.cos(twoPi * (c * t + d));
    return clamp(value, 0, 1);
  };

  return {
    r: computeChannel(palette.A.r, palette.B.r, palette.C.r, palette.D.r),
    g: computeChannel(palette.A.g, palette.B.g, palette.C.g, palette.D.g),
    b: computeChannel(palette.A.b, palette.B.b, palette.C.b, palette.D.b),
  };
};

const toRgba = (
  { r, g, b }: { r: number; g: number; b: number },
  alpha = 0.5
) =>
  `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(
    b * 255
  )}, ${alpha})`;

const computePaletteGradient = (palette: ShaderPalette) => {
  const steps = 12;
  const stops = Array.from({ length: steps }, (_, index) => {
    const t = index / (steps - 1);
    const color = paletteColorAt(palette, t);
    const stop = ((t * 100) as number).toFixed(1);
    return `${toRgba(color)} ${stop}%`;
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
};

const createPaletteSignature = (palette: ShaderPalette) =>
  [
    palette.A.r,
    palette.A.g,
    palette.A.b,
    palette.B.r,
    palette.B.g,
    palette.B.b,
    palette.C.r,
    palette.C.g,
    palette.C.b,
    palette.D.r,
    palette.D.g,
    palette.D.b,
  ]
    .map((value) => value.toFixed(3))
    .join("-");

function RadialRipplesScene() {
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState(DEFAULT_TRACK_LABEL);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [palette, setPalette] = useState<ShaderPalette>(() =>
    clonePalette(DEFAULT_PALETTE)
  );
  const [overlaySuppressed, setOverlaySuppressed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const shaderRef = useRef<RadialRipplesHandle | null>(null);
  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setControlValueRef = useRef<
    ((key: string, value: number) => void) | null
  >(null);

  const suppressOverlay = useCallback(() => {
    setOverlaySuppressed(true);
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
    }
    overlayTimeoutRef.current = setTimeout(() => {
      setOverlaySuppressed(false);
      overlayTimeoutRef.current = null;
    }, 1500);
  }, []);

  useEffect(
    () => () => {
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
    },
    []
  );

  useEffect(
    () => () => {
      if (audioObjectUrl) {
        URL.revokeObjectURL(audioObjectUrl);
      }
    },
    [audioObjectUrl]
  );

  const startPlayback = useCallback(async () => {
    const handle = shaderRef.current;
    if (!handle) {
      return false;
    }

    setIsAudioLoading(true);
    try {
      const started = await handle.play();
      setIsPlaying(started);
      return started;
    } catch (error) {
      console.warn("Failed to start audio playback", error);
      setIsPlaying(false);
      return false;
    } finally {
      setIsAudioLoading(false);
    }
  }, [shaderRef]);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      const nextUrl = URL.createObjectURL(file);
      setAudioObjectUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return nextUrl;
      });
      setFileLabel(file.name);

      const handle = shaderRef.current;
      if (handle) {
        setIsAudioLoading(true);
        void (async () => {
          try {
            const started = await handle.setAudioSource(nextUrl, {
              autoplay: true,
            });
            setIsPlaying(started);
          } finally {
            setIsAudioLoading(false);
          }
        })();
      } else {
        setIsPlaying(false);
      }

      // Allow re-selecting the same file.
      event.target.value = "";
    },
    [shaderRef]
  );

  const handleReset = useCallback(() => {
    setAudioObjectUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    setFileLabel(DEFAULT_TRACK_LABEL);

    const handle = shaderRef.current;
    if (handle) {
      setIsAudioLoading(true);
      void (async () => {
        try {
          const started = await handle.setAudioSource(null, {
            autoplay: true,
          });
          setIsPlaying(started);
        } finally {
          setIsAudioLoading(false);
        }
      })();
    } else {
      setIsPlaying(false);
    }

    const input = fileInputRef.current;
    if (input) {
      input.value = "";
    }
  }, [shaderRef]);

  const handleOverlayPlay = useCallback(() => {
    void startPlayback();
  }, [startPlayback]);

  const handleTogglePlayback = useCallback(() => {
    const handle = shaderRef.current;
    if (!handle) {
      return;
    }
    if (isAudioLoading) {
      return;
    }
    if (isPlaying) {
      void (async () => {
        await handle.pause();
        setIsPlaying(false);
      })();
    } else {
      void startPlayback();
    }
  }, [isAudioLoading, isPlaying, shaderRef, startPlayback]);

  const handleRestart = useCallback(() => {
    const handle = shaderRef.current;
    if (!handle) {
      return;
    }
    setIsAudioLoading(true);
    void (async () => {
      try {
        const restarted = await handle.restart();
        setIsPlaying(restarted);
      } finally {
        setIsAudioLoading(false);
      }
    })();
  }, [shaderRef]);

  const updatePaletteValue = useCallback(
    (
      section: PaletteSectionKey,
      channel: PaletteChannelKey,
      nextValue: number
    ) => {
      const { min, max } = paletteRanges[section];
      const clampedValue = clamp(nextValue, min, max);
      suppressOverlay();
      setPalette((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [channel]: clampedValue,
        },
      }));
      const setter = setControlValueRef.current;
      if (setter) {
        setter(paletteControlKey(section, channel), clampedValue);
      }
    },
    [suppressOverlay]
  );

  const handleResetPalette = useCallback(() => {
    suppressOverlay();
    setPalette(clonePalette(DEFAULT_PALETTE));
    const setter = setControlValueRef.current;
    if (setter) {
      for (const [section, channel] of PALETTE_CONTROL_ENTRIES) {
        const key = paletteControlKey(section, channel);
        setter(key, DEFAULT_PALETTE[section][channel]);
      }
    }
  }, [suppressOverlay]);

  const paletteGradient = useMemo(
    () => computePaletteGradient(palette),
    [palette]
  );

  const paletteSignature = useMemo(
    () => createPaletteSignature(palette),
    [palette]
  );

  const renderControls = useCallback(() => {
    const baseButtonClasses =
      "flex-1 rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition";
    const channelLabels: Record<PaletteChannelKey, string> = {
      r: "Red",
      g: "Green",
      b: "Blue",
    };
    return (
      <div className="flex w-full flex-col gap-6">
        <div className="flex w-full flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-200">
            Playback
          </span>
          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={handleTogglePlayback}
              aria-pressed={isPlaying}
              disabled={isAudioLoading}
              className={`${baseButtonClasses} ${
                isPlaying
                  ? "border-stone-100 bg-stone-200 text-stone-900"
                  : "border-stone-700 bg-stone-900 text-stone-200 hover:border-stone-500"
              } ${isAudioLoading ? "cursor-wait opacity-70" : ""}`}
            >
              {isAudioLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-200 border-t-transparent"
                  />
                  <span>Loading...</span>
                </span>
              ) : isPlaying ? (
                "‖ Pause"
              ) : (
                "▶︎ Play"
              )}
            </button>
            <button
              type="button"
              onClick={handleRestart}
              className={`${baseButtonClasses} border-stone-700 bg-stone-900 text-stone-200 hover:border-stone-500`}
            >
              Reset
            </button>
          </div>
        </div>
        <div className="flex w-full flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-200">
              Palette
            </span>
            <button
              type="button"
              onClick={handleResetPalette}
              className="rounded border border-stone-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-stone-200 transition hover:border-stone-500"
            >
              Reset Palette
            </button>
          </div>
          <div
            className="h-4 w-full rounded border border-stone-700"
            style={{ background: paletteGradient }}
          />
          <div className="flex flex-col gap-4">
            {paletteSections.map((section) => {
              const range = paletteRanges[section.key];
              return (
                <div key={section.key} className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-stone-300">
                    <span>{section.label}</span>
                    <span className="text-stone-500">{section.helper}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {CHANNEL_KEYS.map((channel) => {
                      const value = palette[section.key][channel];
                      return (
                        <div key={channel} className="space-y-2">
                          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-stone-400">
                            <span>{channelLabels[channel]}</span>
                            <span>{value.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={range.min}
                            max={range.max}
                            step={range.step}
                            value={value}
                            onPointerDown={suppressOverlay}
                            onChange={(event) =>
                              updatePaletteValue(
                                section.key,
                                channel,
                                parseFloat(event.target.value)
                              )
                            }
                            className="w-full cursor-pointer accent-stone-300"
                          />
                          <input
                            type="number"
                            min={range.min}
                            max={range.max}
                            step={range.step}
                            value={value.toFixed(3)}
                            onPointerDown={suppressOverlay}
                            onFocus={suppressOverlay}
                            onChange={(event) => {
                              const parsed = parseFloat(event.target.value);
                              if (Number.isNaN(parsed)) {
                                return;
                              }
                              updatePaletteValue(section.key, channel, parsed);
                            }}
                            className="w-full rounded border border-stone-700 bg-stone-900 px-2 py-1 text-xs text-stone-200 focus:border-stone-500 focus:outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex w-full flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-200">
            Audio Source
          </span>
          <label className="group flex w-full cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-md border border-stone-700 bg-stone-900 px-3 py-2 text-sm transition hover:border-stone-500">
            <span className="min-w-0 flex-1 truncate text-stone-100 group-hover:text-white">
              {fileLabel}
            </span>

            <span className="flex-shrink-0 text-xs font-semibold uppercase tracking-wide text-stone-400 group-hover:text-stone-200">
              Browse
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
          {audioObjectUrl && (
            <button
              type="button"
              onClick={handleReset}
              className="self-start rounded-md border border-stone-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-stone-200 transition hover:border-stone-500"
            >
              Use Default Track
            </button>
          )}
        </div>
      </div>
    );
  }, [
    audioObjectUrl,
    fileLabel,
    handleFileChange,
    handleReset,
    handleRestart,
    handleTogglePlayback,
    isAudioLoading,
    isPlaying,
    palette,
    paletteGradient,
    handleResetPalette,
    suppressOverlay,
    updatePaletteValue,
  ]);

  const controlSchema = useMemo(
    () => ({
      playbackAndAudio: {
        type: "button" as const,
        render: renderControls,
        playbackState: isPlaying ? "playing" : "paused",
        paletteSignature,
      },
      paletteAr: {
        type: "number" as const,
        value: DEFAULT_PALETTE.A.r,
        hidden: true,
      },
      paletteAg: {
        type: "number" as const,
        value: DEFAULT_PALETTE.A.g,
        hidden: true,
      },
      paletteAb: {
        type: "number" as const,
        value: DEFAULT_PALETTE.A.b,
        hidden: true,
      },
      paletteBr: {
        type: "number" as const,
        value: DEFAULT_PALETTE.B.r,
        hidden: true,
      },
      paletteBg: {
        type: "number" as const,
        value: DEFAULT_PALETTE.B.g,
        hidden: true,
      },
      paletteBb: {
        type: "number" as const,
        value: DEFAULT_PALETTE.B.b,
        hidden: true,
      },
      paletteCr: {
        type: "number" as const,
        value: DEFAULT_PALETTE.C.r,
        hidden: true,
      },
      paletteCg: {
        type: "number" as const,
        value: DEFAULT_PALETTE.C.g,
        hidden: true,
      },
      paletteCb: {
        type: "number" as const,
        value: DEFAULT_PALETTE.C.b,
        hidden: true,
      },
      paletteDr: {
        type: "number" as const,
        value: DEFAULT_PALETTE.D.r,
        hidden: true,
      },
      paletteDg: {
        type: "number" as const,
        value: DEFAULT_PALETTE.D.g,
        hidden: true,
      },
      paletteDb: {
        type: "number" as const,
        value: DEFAULT_PALETTE.D.b,
        hidden: true,
      },
    }),
    [paletteSignature, renderControls, isPlaying]
  );

  const controlsApi = useControls(controlSchema, {
    config: {
      mainLabel: "Audio Radial Controls",
      showCopyButton: false,
    },
  }) as Record<string, unknown> & {
    setValue?: (key: string, value: number) => void;
  };

  useEffect(() => {
    if (typeof controlsApi?.setValue === "function") {
      setControlValueRef.current = controlsApi.setValue;
    }
  }, [controlsApi?.setValue]);

  const controlPalette = useMemo<ShaderPalette>(() => {
    const mapValue = (section: PaletteSectionKey, channel: PaletteChannelKey) =>
      toNumberOr(
        controlsApi?.[paletteControlKey(section, channel)],
        DEFAULT_PALETTE[section][channel]
      );

    return {
      A: {
        r: mapValue("A", "r"),
        g: mapValue("A", "g"),
        b: mapValue("A", "b"),
      },
      B: {
        r: mapValue("B", "r"),
        g: mapValue("B", "g"),
        b: mapValue("B", "b"),
      },
      C: {
        r: mapValue("C", "r"),
        g: mapValue("C", "g"),
        b: mapValue("C", "b"),
      },
      D: {
        r: mapValue("D", "r"),
        g: mapValue("D", "g"),
        b: mapValue("D", "b"),
      },
    };
  }, [
    controlsApi?.paletteAr,
    controlsApi?.paletteAg,
    controlsApi?.paletteAb,
    controlsApi?.paletteBr,
    controlsApi?.paletteBg,
    controlsApi?.paletteBb,
    controlsApi?.paletteCr,
    controlsApi?.paletteCg,
    controlsApi?.paletteCb,
    controlsApi?.paletteDr,
    controlsApi?.paletteDg,
    controlsApi?.paletteDb,
  ]);

  useEffect(() => {
    setPalette((prev) =>
      palettesEqual(prev, controlPalette) ? prev : clonePalette(controlPalette)
    );
  }, [controlPalette]);

  const overlayHidden = isPlaying || overlaySuppressed;

  return (
    <>
      <RadialRipples ref={shaderRef} isPlaying={isPlaying} palette={palette} />
      <Html fullscreen zIndexRange={[5, 0]}>
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
            overlayHidden
              ? "pointer-events-none opacity-0"
              : "pointer-events-auto opacity-100"
          }`}
          style={{
            background:
              paletteGradient ??
              "linear-gradient(rgba(29, 38, 113, 0.5), rgba(195, 55, 100, 0.5))",
            pointerEvents: overlayHidden ? "none" : "auto",
          }}
        >
          <button
            type="button"
            onClick={handleOverlayPlay}
            disabled={isAudioLoading}
            className="rounded-full border border-stone-700 bg-stone-900/80 px-6 py-3 text-sm font-semibold uppercase tracking-widest text-stone-200 backdrop-blur transition hover:border-stone-400 hover:bg-stone-900/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isAudioLoading ? (
              <span className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-stone-200 border-t-transparent"
                />
                <span>Loading...</span>
              </span>
            ) : (
              "▶︎ Play"
            )}
          </button>
        </div>
      </Html>
    </>
  );
}

export default function RadialRipplesPage() {
  return (
    <PlaygroundCanvas>
      <RadialRipplesScene />
    </PlaygroundCanvas>
  );
}
