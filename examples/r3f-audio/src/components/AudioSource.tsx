import type { ChangeEvent, FC, RefObject } from "react";

type AudioSourceProps = {
  audioObjectUrl: string | null;
  fileLabel: string;
  fileInputRef: RefObject<HTMLInputElement>;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
};

const AudioSource: FC<AudioSourceProps> = ({
  audioObjectUrl,
  fileLabel,
  fileInputRef,
  onFileChange,
  onReset,
}) => {
  return (
    <div className="flex w-full flex-col gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-stone-200">
        Source
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
          onChange={onFileChange}
        />
      </label>
      {audioObjectUrl && (
        <button
          type="button"
          onClick={onReset}
          className="self-start rounded-md border border-stone-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-stone-200 transition hover:border-stone-500"
        >
          Use Default Track
        </button>
      )}
    </div>
  );
};

export default AudioSource;
