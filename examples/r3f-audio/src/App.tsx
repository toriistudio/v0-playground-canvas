"use client";

import {
  PlaygroundCanvas,
  computePaletteGradient,
  clonePalette,
  useControls,
} from "@toriistudio/v0-playground-canvas";
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
import OverlayScreen from "@/components/OverlayScreen";

const DEFAULT_TRACK_LABEL = "Built-in track";

const DEFAULT_PALETTE: ShaderPalette = {
  A: { r: 0.5, g: 0.5, b: 0.5 },
  B: { r: 0.5, g: 0.5, b: 0.5 },
  C: { r: 1.0, g: 1.0, b: 1.0 },
  D: { r: 0.0, g: 0.1, b: 0.2 },
};

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

  const handlePaletteChange = useCallback((nextPalette: ShaderPalette) => {
    setPalette(clonePalette(nextPalette));
  }, []);

  const paletteGradient = useMemo(
    () => computePaletteGradient(palette),
    [palette]
  );

  const renderControls = useCallback(() => {
    const baseButtonClasses =
      "flex-1 rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition";
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
  ]);

  const controlSchema = useMemo(
    () => ({
      playbackAndAudio: {
        type: "button" as const,
        render: renderControls,
        playbackState: isPlaying ? "playing" : "paused",
      },
    }),
    [renderControls, isPlaying]
  );

  useControls(controlSchema, {
    config: {
      mainLabel: "Audio Radial Controls",
      showCopyButton: false,
      addAdvancedPaletteControl: {
        defaultPalette: DEFAULT_PALETTE,
        onPaletteChange: handlePaletteChange,
        onInteraction: suppressOverlay,
      },
    },
  });

  const overlayHidden = isPlaying || overlaySuppressed;

  return (
    <>
      <RadialRipples ref={shaderRef} isPlaying={isPlaying} palette={palette} />
      <OverlayScreen
        gradient={paletteGradient}
        hidden={overlayHidden}
        isLoading={isAudioLoading}
        onPlay={handleOverlayPlay}
      />
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
