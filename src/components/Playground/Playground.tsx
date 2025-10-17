"use client";

import { ReactNode, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { ResizableLayout } from "@/context/ResizableLayout";
import { ControlsProvider } from "@/context/ControlsContext";
import ControlPanel from "@/components/ControlPanel";
import PreviewContainer from "@/components/PreviewContainer";
import {
  REMOTE_CONTROLS_CONTROLLER,
  REMOTE_CONTROLS_PARAM,
  REMOTE_CONTROLS_VISIBILITY_EVENT,
} from "@/constants/remoteControl";

const NO_CONTROLS_PARAM = "nocontrols";

export default function Playground({ children }: { children: ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [isRemoteController, setIsRemoteController] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setControlsHidden(params.get(NO_CONTROLS_PARAM) === "true");
      setIsRemoteController(
        params.get(REMOTE_CONTROLS_PARAM) === REMOTE_CONTROLS_CONTROLLER
      );
    };

    updateFromUrl();

    const handlePopState = () => updateFromUrl();
    window.addEventListener("popstate", handlePopState);

    const visibilityListener: EventListener = (event) => {
      const customEvent = event as CustomEvent<boolean>;
      if (typeof customEvent.detail === "boolean") {
        setControlsHidden(customEvent.detail);
        return;
      }
      setControlsHidden((prev) => !prev);
    };

    window.addEventListener(
      REMOTE_CONTROLS_VISIBILITY_EVENT,
      visibilityListener
    );

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener(
        REMOTE_CONTROLS_VISIBILITY_EVENT,
        visibilityListener
      );
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isHydrated) return null;

  const hideControls = !isRemoteController && controlsHidden;

  return (
    <ResizableLayout hideControls={hideControls}>
      <ControlsProvider>
        {hideControls && (
          <button
            onClick={handleCopy}
            className="absolute top-4 right-4 z-50 flex items-center gap-1 rounded bg-black/70 px-3 py-1 text-white hover:bg-black"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied!" : "Share"}
          </button>
        )}
        <PreviewContainer
          hideControls={hideControls}
          className={isRemoteController ? "hidden" : undefined}
        >
          {children}
        </PreviewContainer>
        {!hideControls && <ControlPanel />}
      </ControlsProvider>
    </ResizableLayout>
  );
}
