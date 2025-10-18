import { Html } from "@react-three/drei";

export type OverlayScreenProps = {
  gradient?: string;
  hidden: boolean;
  isLoading: boolean;
  onPlay: () => void;
};

const FALLBACK_GRADIENT =
  "linear-gradient(rgba(29, 38, 113, 0.5), rgba(195, 55, 100, 0.5))";

const OverlayScreen: React.FC<OverlayScreenProps> = ({
  gradient,
  hidden,
  isLoading,
  onPlay,
}) => {
  return (
    <Html fullscreen zIndexRange={[5, 0]}>
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
          hidden
            ? "pointer-events-none opacity-0"
            : "pointer-events-auto opacity-100"
        }`}
        style={{
          background: gradient ?? FALLBACK_GRADIENT,
          pointerEvents: hidden ? "none" : "auto",
        }}
      >
        <button
          type="button"
          onClick={onPlay}
          disabled={isLoading}
          className="rounded-full border border-stone-700 bg-stone-900/80 px-6 py-3 text-sm font-semibold uppercase tracking-widest text-stone-200 backdrop-blur transition hover:border-stone-400 hover:bg-stone-900/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? (
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
  );
};

export default OverlayScreen;
