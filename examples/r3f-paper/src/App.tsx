"use client";

import {
  PlaygroundCanvas,
  useAdvancedPaletteControls,
  useControls,
} from "@toriistudio/v0-playground-canvas";
import { Html } from "@react-three/drei";

import { MeshGradient } from "@paper-design/shaders-react";

const CONTROL_SCHEMA = {
  distortion: {
    type: "number",
    value: 1,
    min: 0,
    max: 5,
    step: 0.1,
    folder: "Layout",
  },
  swirl: {
    type: "number",
    value: 1,
    min: 0,
    max: 5,
    step: 0.1,
    folder: "Layout",
  },
  grainMixer: {
    type: "number",
    value: 0,
    min: 0,
    max: 1,
    step: 0.05,
    folder: "Layout",
  },
  grainOverlay: {
    type: "number",
    value: 0,
    min: 0,
    max: 1,
    step: 0.05,
    folder: "Layout",
  },
  speed: {
    type: "number",
    value: 0.6,
    min: 0,
    max: 5,
    step: 0.1,
    folder: "Layout",
  },
};

function MeshGradientScene() {
  const { hexColors, controlConfig } = useAdvancedPaletteControls({
    control: { folder: "Colors" },
  });

  const controls = useControls(CONTROL_SCHEMA, {
    config: {
      mainLabel: "Mesh Gradient Controls",
      showGrid: false,
      showCopyButton: true,
      addAdvancedPaletteControl: controlConfig,
    },
  });

  return (
    <Html fullscreen>
      <MeshGradient
        width="100%"
        height="100%"
        colors={hexColors}
        distortion={controls.distortion ?? CONTROL_SCHEMA.distortion.value}
        swirl={controls.swirl ?? CONTROL_SCHEMA.swirl.value}
        grainMixer={controls.grainMixer ?? CONTROL_SCHEMA.grainMixer.value}
        grainOverlay={
          controls.grainOverlay ?? CONTROL_SCHEMA.grainOverlay.value
        }
        speed={controls.speed ?? CONTROL_SCHEMA.speed.value}
      />
    </Html>
  );
}

export default function Home() {
  return (
    <PlaygroundCanvas>
      <MeshGradientScene />
    </PlaygroundCanvas>
  );
}
