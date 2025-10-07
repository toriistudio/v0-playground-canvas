import React, { useRef } from "react";
import { useResizableLayout } from "@/context/ResizableLayout";
import { useControlsContext } from "@/context/ControlsContext";
import Grid from "@/components/Grid";
import { MOBILE_CONTROL_PANEL_PEEK } from "@/constants/layout";

type Props = {
  children?: React.ReactNode;
  hideControls?: boolean;
};

const PreviewContainer: React.FC<Props> = ({ children, hideControls }) => {
  const { config } = useControlsContext();
  const { leftPanelWidth, isDesktop, isHydrated, containerRef } =
    useResizableLayout();
  const previewRef = useRef<HTMLDivElement>(null);

  const safeAreaInset = "env(safe-area-inset-bottom, 0px)";
  const mobileViewportHeight = `calc(100vh - (${MOBILE_CONTROL_PANEL_PEEK}px + ${safeAreaInset}))`;

  const previewStyle: React.CSSProperties = {};

  if (isHydrated) {
    if (isDesktop && !hideControls) {
      Object.assign(previewStyle, {
        width: `${100 - leftPanelWidth}%`,
        marginLeft: `${leftPanelWidth}%`,
      });
    } else if (!isDesktop) {
      Object.assign(previewStyle, {
        minHeight: mobileViewportHeight,
        height: mobileViewportHeight,
      });
    }
  }

  const previewInnerStyle = !isDesktop
    ? {
        minHeight: mobileViewportHeight,
        height: mobileViewportHeight,
      }
    : undefined;

  return (
    <div
      ref={previewRef}
      className="order-1 md:order-2 flex-1 bg-black overflow-auto flex items-center justify-center relative"
      style={previewStyle}
    >
      <div className="w-screen h-screen" style={previewInnerStyle}>
        {config?.showGrid && <Grid />}
        <div
          className="w-screen h-screen flex items-center justify-center relative"
          style={previewInnerStyle}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default PreviewContainer;
