import type { FC } from "react";

type AudioControlsProps = {
  isPlaying: boolean;
  isLoading: boolean;
  onTogglePlayback: () => void;
  onRestart: () => void;
};

const baseButtonClasses =
  "flex-1 rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition";

const AudioControls: FC<AudioControlsProps> = ({
  isPlaying,
  isLoading,
  onTogglePlayback,
  onRestart,
}) => {
  return (
    <div className="flex w-full flex-col gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-stone-200">
        Playback
      </span>
      <div className="flex w-full gap-3">
        <button
          type="button"
          onClick={onTogglePlayback}
          aria-pressed={isPlaying}
          disabled={isLoading}
          className={`${baseButtonClasses} ${
            isPlaying
              ? "border-stone-100 bg-stone-200 text-stone-900"
              : "border-stone-700 bg-stone-900 text-stone-200 hover:border-stone-500"
          } ${isLoading ? "cursor-wait opacity-70" : ""}`}
        >
          {isLoading ? (
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
          onClick={onRestart}
          className={`${baseButtonClasses} border-stone-700 bg-stone-900 text-stone-200 hover:border-stone-500`}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default AudioControls;
