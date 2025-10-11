"use client";
import { useFrame } from "@react-three/fiber";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import * as THREE from "three";

import bufferFragmentShader from "@/shaders/bufferA.glsl";
import fragmentShader from "@/shaders/fragment.glsl";
import vertexShader from "@/shaders/vertex.glsl";

const BUFFER_WIDTH = 1;
const BUFFER_HEIGHT = 256;
const DEFAULT_AUDIO_SRC = "/audio/radial-ripples-cool.mp3";

export type PaletteTriplet = {
  r: number;
  g: number;
  b: number;
};

export type ShaderPalette = {
  A: PaletteTriplet;
  B: PaletteTriplet;
  C: PaletteTriplet;
  D: PaletteTriplet;
};

export type RadialRipplesHandle = {
  play: () => Promise<boolean>;
  pause: () => Promise<void>;
  restart: () => Promise<boolean>;
  setAudioSource: (
    url: string | null,
    options?: { autoplay?: boolean }
  ) => Promise<boolean>;
};

type RadialRipplesProps = {
  isPlaying: boolean;
  palette: ShaderPalette;
};

const clonePalette = (palette: ShaderPalette): ShaderPalette => ({
  A: { ...palette.A },
  B: { ...palette.B },
  C: { ...palette.C },
  D: { ...palette.D },
});

function createAudioSampleTexture() {
  const data = new Uint8Array(4);
  data[3] = 255;
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function createRenderTarget() {
  const target = new THREE.WebGLRenderTarget(BUFFER_WIDTH, BUFFER_HEIGHT, {
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.wrapS = THREE.ClampToEdgeWrapping;
  target.texture.wrapT = THREE.ClampToEdgeWrapping;
  target.texture.minFilter = THREE.NearestFilter;
  target.texture.magFilter = THREE.NearestFilter;
  target.texture.generateMipmaps = false;
  return target;
}

const RadialRipples = forwardRef<RadialRipplesHandle, RadialRipplesProps>(
  function RadialRipples({ isPlaying, palette }, ref) {
    const frameRef = useRef(0);

    const audioTexture = useMemo(() => createAudioSampleTexture(), []);

    const renderTargets = useMemo(
      () => [createRenderTarget(), createRenderTarget()],
      []
    );

    // Ping-pong render targets keep the rolling BufferA state.
    const pingPongRef = useRef<{
      read: THREE.WebGLRenderTarget;
      write: THREE.WebGLRenderTarget;
    }>({
      read: renderTargets[0],
      write: renderTargets[1],
    });

    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const analyserDataRef = useRef<Uint8Array | null>(null);
    const decodedBufferRef = useRef<AudioBuffer | null>(null);
    const audioLoadingRef = useRef(false);
    const analyserConnectedRef = useRef(false);
    const requestedAudioUrlRef = useRef<string>(DEFAULT_AUDIO_SRC);
    const currentAudioUrlRef = useRef<string | null>(null);

    const channelResolutions = useMemo(
      () => [
        new THREE.Vector3(1, 1, 1),
        new THREE.Vector3(BUFFER_WIDTH, BUFFER_HEIGHT, 1),
        new THREE.Vector3(1, 1, 1),
        new THREE.Vector3(1, 1, 1),
      ],
      []
    );

    const bufferUniforms = useMemo(
      () => ({
        iResolution: {
          value: new THREE.Vector3(BUFFER_WIDTH, BUFFER_HEIGHT, 1),
        },
        iFrame: { value: 0 },
        iChannel1: { value: audioTexture },
        iChannel2: { value: pingPongRef.current.read.texture },
      }),
      [audioTexture]
    );

    const bufferResources = useMemo(() => {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const geometry = new THREE.PlaneGeometry(2, 2);
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader: bufferFragmentShader,
        uniforms: bufferUniforms,
        depthTest: false,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      return { scene, camera, geometry, material };
    }, [bufferUniforms]);

    const mainUniforms = useMemo(
      () => ({
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector3(1, 1, 1) },
        iFrame: { value: 0 },
        iChannel1: { value: pingPongRef.current.read.texture },
        iChannelResolution: { value: channelResolutions },
        uPaletteA: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
        uPaletteB: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
        uPaletteC: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
        uPaletteD: { value: new THREE.Vector3(0.0, 0.1, 0.2) },
      }),
      [channelResolutions]
    );

    const mainMaterialRef = useRef<THREE.ShaderMaterial | null>(null);

    const stopCurrentSource = useCallback(() => {
      const source = audioSourceRef.current;
      if (!source) {
        return;
      }
      try {
        source.stop(0);
      } catch (error) {
        console.warn("Failed to stop audio source", error);
      }
      source.disconnect();
      audioSourceRef.current = null;
    }, []);

    const prepareAudioContext = useCallback(async () => {
      if (typeof window === "undefined") {
        return null;
      }

      let context = audioContextRef.current;
      if (!context) {
        const AudioCtx =
          window.AudioContext ||
          (
            window as typeof window & {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;
        if (!AudioCtx) {
          console.warn("Web Audio API is not supported in this browser.");
          return null;
        }
        context = new AudioCtx();
        audioContextRef.current = context;
      }

      if (!analyserRef.current) {
        const analyser = context.createAnalyser();
        analyser.fftSize = Math.max(BUFFER_HEIGHT * 2, 32);
        analyserRef.current = analyser;
        analyserDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      }

      return context;
    }, []);

    const fetchAudioBuffer = useCallback(async () => {
      const context = await prepareAudioContext();
      if (!context) {
        return null;
      }

      const targetUrl = requestedAudioUrlRef.current ?? DEFAULT_AUDIO_SRC;

      if (
        currentAudioUrlRef.current === targetUrl &&
        decodedBufferRef.current
      ) {
        return decodedBufferRef.current;
      }

      if (audioLoadingRef.current) {
        return decodedBufferRef.current;
      }

      audioLoadingRef.current = true;
      try {
        const response = await fetch(targetUrl);
        if (!response.ok) {
          throw new Error(`Failed to load audio file at ${targetUrl}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await context.decodeAudioData(arrayBuffer);
        decodedBufferRef.current = buffer;
        currentAudioUrlRef.current = targetUrl;
        return buffer;
      } catch (error) {
        console.error("Failed to load audio", error);
        return decodedBufferRef.current;
      } finally {
        audioLoadingRef.current = false;
      }
    }, [prepareAudioContext]);

    const playBuffer = useCallback(
      (buffer: AudioBuffer) => {
        const context = audioContextRef.current;
        const analyser = analyserRef.current;
        if (!context || !analyser) {
          return;
        }

        stopCurrentSource();

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(analyser);

        if (!analyserConnectedRef.current) {
          analyser.connect(context.destination);
          analyserConnectedRef.current = true;
        }

        try {
          source.start(0);
          audioSourceRef.current = source;
        } catch (error) {
          console.error("Failed to start audio playback", error);
        }
      },
      [stopCurrentSource]
    );

    const play = useCallback(async () => {
      const context = await prepareAudioContext();
      if (!context) {
        return false;
      }

      const targetUrl = requestedAudioUrlRef.current ?? DEFAULT_AUDIO_SRC;
      if (currentAudioUrlRef.current !== targetUrl) {
        stopCurrentSource();
        decodedBufferRef.current = null;
      }

      if (context.state === "suspended") {
        try {
          await context.resume();
        } catch (error) {
          console.warn("Failed to resume audio context", error);
        }
      }

      if (audioSourceRef.current) {
        return true;
      }

      const buffer =
        decodedBufferRef.current && currentAudioUrlRef.current === targetUrl
          ? decodedBufferRef.current
          : await fetchAudioBuffer();

      if (buffer) {
        playBuffer(buffer);
        return audioSourceRef.current !== null;
      }
      return false;
    }, [fetchAudioBuffer, playBuffer, prepareAudioContext, stopCurrentSource]);

    const pause = useCallback(async () => {
      const context = audioContextRef.current;
      if (!context) {
        return;
      }

      if (context.state !== "suspended") {
        try {
          await context.suspend();
        } catch (error) {
          console.warn("Failed to suspend audio context", error);
        }
      }
    }, []);

    const restart = useCallback(async () => {
      const context = await prepareAudioContext();
      if (!context) {
        return false;
      }

      if (context.state === "suspended") {
        try {
          await context.resume();
        } catch (error) {
          console.warn("Failed to resume audio context", error);
        }
      }

      const buffer = decodedBufferRef.current ?? (await fetchAudioBuffer());

      if (buffer) {
        playBuffer(buffer);
      }
      return audioSourceRef.current !== null;
    }, [fetchAudioBuffer, playBuffer, prepareAudioContext]);

    const setAudioSource = useCallback(
      async (url: string | null, options?: { autoplay?: boolean }) => {
        requestedAudioUrlRef.current = url ?? DEFAULT_AUDIO_SRC;
        stopCurrentSource();
        decodedBufferRef.current = null;
        currentAudioUrlRef.current = null;

        if (options?.autoplay) {
          return await play();
        }
        return false;
      },
      [play, stopCurrentSource]
    );

    useImperativeHandle(
      ref,
      () => ({
        play: async () => {
          return await play();
        },
        pause: async () => {
          await pause();
        },
        restart: async () => {
          return await restart();
        },
        setAudioSource: async (url, options) => {
          return await setAudioSource(url, options);
        },
        getPalette: () => clonePalette(palette),
      }),
      [pause, play, restart, setAudioSource, palette]
    );

    useEffect(() => {
      return () => {
        stopCurrentSource();

        const analyser = analyserRef.current;
        if (analyser) {
          analyser.disconnect();
        }

        const context = audioContextRef.current;
        if (context) {
          void context.close();
        }

        audioTexture.dispose();
        renderTargets.forEach((target) => target.dispose());
        bufferResources.material.dispose();
        bufferResources.geometry.dispose();
      };
    }, [audioTexture, bufferResources, renderTargets, stopCurrentSource]);

    useEffect(() => {
      const { A, B, C, D } = palette;
      mainUniforms.uPaletteA.value.set(A.r, A.g, A.b);
      mainUniforms.uPaletteB.value.set(B.r, B.g, B.b);
      mainUniforms.uPaletteC.value.set(C.r, C.g, C.b);
      mainUniforms.uPaletteD.value.set(D.r, D.g, D.b);
      if (mainMaterialRef.current) {
        (mainMaterialRef.current as THREE.ShaderMaterial).uniformsNeedUpdate =
          true;
      }
    }, [mainUniforms, palette]);

    useFrame((state) => {
      const mainMaterial = mainMaterialRef.current;
      if (!mainMaterial) {
        return;
      }

      const { gl, size, clock } = state;
      const pingPong = pingPongRef.current;
      const bufferMaterial = bufferResources.material;

      const analyser = analyserRef.current;
      const analyserData = analyserDataRef.current;
      if (analyser && analyserData) {
        analyser.getByteFrequencyData(analyserData);

        let sum = 0;
        for (let index = 0; index < analyserData.length; index += 1) {
          sum += analyserData[index];
        }
        const average = analyserData.length > 0 ? sum / analyserData.length : 0;
        const normalized = Math.min(Math.max(average / 255, 0), 1);
        const mappedValue = Math.floor(normalized * 255);

        const pixelData = audioTexture.image.data as Uint8Array;
        pixelData[0] = mappedValue;
        pixelData[1] = mappedValue;
        pixelData[2] = Math.floor(Math.pow(normalized, 2.0) * 255.0);
        pixelData[3] = 255;
        audioTexture.needsUpdate = true;
      }

      const currentFrame = frameRef.current;

      bufferMaterial.uniforms.iFrame.value = currentFrame;
      bufferMaterial.uniforms.iChannel1.value = audioTexture;
      bufferMaterial.uniforms.iChannel2.value = pingPong.read.texture;

      const previousTarget = gl.getRenderTarget();
      gl.setRenderTarget(pingPong.write);
      gl.render(bufferResources.scene, bufferResources.camera);
      gl.setRenderTarget(previousTarget);

      const newRead = pingPong.write;
      pingPong.write = pingPong.read;
      pingPong.read = newRead;

      mainMaterial.uniforms.iTime.value = clock.elapsedTime;
      mainMaterial.uniforms.iResolution.value.set(size.width, size.height, 1);
      mainMaterial.uniforms.iFrame.value = currentFrame;
      mainMaterial.uniforms.iChannel1.value = pingPong.read.texture;

      frameRef.current = currentFrame + 1.0;
    });

    return (
      <>
        <mesh>
          <planeGeometry args={[2, 2]} />
          <shaderMaterial
            ref={mainMaterialRef}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            uniforms={mainUniforms}
          />
        </mesh>
      </>
    );
  }
);

export default RadialRipples;
