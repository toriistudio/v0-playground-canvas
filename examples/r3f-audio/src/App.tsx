"use client";

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useControls,
  PlaygroundCanvas,
  useAdvancedPaletteControls,
} from "@toriistudio/v0-playground-canvas";

import RadialRipples, {
  type RadialRipplesHandle,
  type ShaderPalette,
} from "@/components/RadialRipples";
import OverlayScreen from "@/components/OverlayScreen";
import AudioControls from "@/components/AudioControls";
import AudioSource from "@/components/AudioSource";

const DEFAULT_TRACK_LABEL = "Built-in track";

function RadialRipplesScene() {
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState(DEFAULT_TRACK_LABEL);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
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

  const {
    palette,
    paletteGradient,
    controlConfig: paletteControlConfig,
  } = useAdvancedPaletteControls({
    control: {
      folder: "Colors",
      onInteraction: suppressOverlay,
    },
  });

  const renderControls = useCallback(
    () => (
      <div className="flex w-full flex-col gap-6">
        <AudioControls
          isPlaying={isPlaying}
          isLoading={isAudioLoading}
          onTogglePlayback={handleTogglePlayback}
          onRestart={handleRestart}
        />
        <AudioSource
          audioObjectUrl={audioObjectUrl}
          fileLabel={fileLabel}
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
          onReset={handleReset}
        />
      </div>
    ),
    [
      audioObjectUrl,
      fileLabel,
      fileInputRef,
      handleFileChange,
      handleReset,
      handleRestart,
      handleTogglePlayback,
      isAudioLoading,
      isPlaying,
    ]
  );

  const controlSchema = useMemo(
    () => ({
      playbackAndAudio: {
        type: "button",
        render: renderControls,
        playbackState: isPlaying ? "playing" : "paused",
        folder: "Audio",
        folderPlacement: "top",
      },
    }),
    [renderControls, isPlaying]
  );

  useControls(controlSchema, {
    config: {
      mainLabel: "Audio Radial Controls",
      showCopyButton: false,
      addAdvancedPaletteControl: paletteControlConfig,
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
