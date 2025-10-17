"use client";

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  type ReactNode,
  useCallback,
  useRef,
} from "react";

import { getUrlParams } from "@/utils/getUrlParams";
import {
  CHANNEL_KEYS,
  clonePalette,
  createAdvancedPaletteSchemaEntries,
  createPaletteControlKey,
  createPaletteSignature,
  resolveAdvancedPaletteConfig,
  toNumberOr,
  type AdvancedPalette,
  type AdvancedPaletteControlConfig,
  type PaletteChannelKey,
  type ResolvedAdvancedPaletteConfig,
} from "@/lib/advancedPalette";

import {
  REMOTE_CONTROL_CHANNEL_PREFIX,
  REMOTE_CONTROLS_CONTROLLER,
  REMOTE_CONTROLS_PARAM,
} from "@/constants/remoteControl";

type BaseControl = {
  hidden?: boolean;
  folder?: string;
  folderPlacement?: "top" | "bottom";
};

export type ControlType =
  | ({ type: "boolean"; value: boolean } & BaseControl)
  | ({
      type: "number";
      value: number;
      min?: number;
      max?: number;
      step?: number;
    } & BaseControl)
  | ({ type: "string"; value: string } & BaseControl)
  | ({ type: "color"; value: string } & BaseControl)
  | ({
      type: "select";
      value: string;
      options: Record<string, any>;
    } & BaseControl)
  | ({
      type: "button";
      onClick?: () => void;
      label?: string;
      render?: () => React.ReactNode;
    } & BaseControl);

export type ControlsSchema = Record<string, ControlType>;

type ControlsConfig = {
  showCopyButton?: boolean;
  mainLabel?: string;
  showGrid?: boolean;
  addAdvancedPaletteControl?: ResolvedAdvancedPaletteConfig;
  remoteControl?:
    | boolean
    | {
        label?: string;
        channelId?: string;
      };
};

type UseControlsConfig = Omit<ControlsConfig, "addAdvancedPaletteControl"> & {
  addAdvancedPaletteControl?: AdvancedPaletteControlConfig;
};

type UseControlsOptions = {
  componentName?: string;
  config?: UseControlsConfig;
};

type RemoteRole = "host" | "controller";

type RemoteMessage =
  | { type: "HELLO"; role: RemoteRole }
  | { type: "REQUEST_STATE" }
  | {
      type: "SYNC_STATE";
      values: Record<string, any>;
      schema: RemoteControlsSchema;
      config?: ControlsConfig;
    }
  | { type: "UPDATE_VALUE"; key: string; value: any; source: RemoteRole }
  | { type: "TRIGGER_BUTTON"; key: string };

type RemoteControlBase = {
  hidden?: boolean;
};

type RemoteBooleanControl = RemoteControlBase & { type: "boolean" };
type RemoteNumberControl = RemoteControlBase & {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
};
type RemoteStringControl = RemoteControlBase & { type: "string" };
type RemoteColorControl = RemoteControlBase & { type: "color" };
type RemoteSelectControl = RemoteControlBase & {
  type: "select";
  options: string[];
};
type RemoteButtonControl = RemoteControlBase & {
  type: "button";
  label?: string;
  supportsRemote?: boolean;
};

export type RemoteControlDefinition =
  | RemoteBooleanControl
  | RemoteNumberControl
  | RemoteStringControl
  | RemoteColorControl
  | RemoteSelectControl
  | RemoteButtonControl;

export type RemoteControlsSchema = Record<string, RemoteControlDefinition>;

const serializeControl = (
  key: string,
  control: ControlType
): RemoteControlDefinition => {
  switch (control.type) {
    case "boolean":
      return {
        type: "boolean",
        hidden: control.hidden,
      };
    case "number":
      return {
        type: "number",
        hidden: control.hidden,
        min: control.min,
        max: control.max,
        step: control.step,
      };
    case "string":
      return {
        type: "string",
        hidden: control.hidden,
      };
    case "color":
      return {
        type: "color",
        hidden: control.hidden,
      };
    case "select":
      return {
        type: "select",
        hidden: control.hidden,
        options: Object.keys(control.options ?? {}),
      };
    case "button":
      return {
        type: "button",
        hidden: control.hidden,
        label: control.label ?? key,
        supportsRemote: Boolean(control.onClick),
      };
  }

  const exhaustive: never = control;
  throw new Error(
    `Unsupported control type: ${(exhaustive as ControlType).type}`
  );
};

type ControlsContextValue = {
  schema: ControlsSchema;
  remoteSchema: RemoteControlsSchema;
  values: Record<string, any>;
  setValue: (key: string, value: any) => void;
  triggerButton: (key: string) => void;
  registerSchema: (
    newSchema: ControlsSchema,
    opts?: {
      componentName?: string;
      config?: UseControlsConfig;
    }
  ) => void;
  componentName?: string;
  config?: ControlsConfig;
  remoteRole: RemoteRole;
};

const ControlsContext = createContext<ControlsContextValue | null>(null);

export const useControlsContext = () => {
  const ctx = useContext(ControlsContext);
  if (!ctx) throw new Error("useControls must be used within ControlsProvider");
  return ctx;
};

export const ControlsProvider = ({ children }: { children: ReactNode }) => {
  const [schema, setSchema] = useState<ControlsSchema>({});
  const [remoteSchema, setRemoteSchema] = useState<RemoteControlsSchema>({});
  const [values, setValues] = useState<Record<string, any>>({});
  const [config, setConfig] = useState<ControlsConfig>({
    showCopyButton: false,
  });
  const [componentName, setComponentName] = useState<string | undefined>();
  const [remoteRole, setRemoteRole] = useState<RemoteRole>("host");
  const channelRef = useRef<BroadcastChannel | null>(null);
  const valuesRef = useRef(values);
  const schemaRef = useRef<ControlsSchema>({});
  const remoteSchemaRef = useRef<RemoteControlsSchema>({});
  const channelNameRef = useRef<string | null>(null);
  const hostReadyRef = useRef(false);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    schemaRef.current = schema;
  }, [schema]);

  useEffect(() => {
    remoteSchemaRef.current = remoteSchema;
  }, [remoteSchema]);

  console.log("[ControlsProvider] render", {
    remoteRole,
    schemaKeys: Object.keys(schema),
    remoteSchemaKeys: Object.keys(remoteSchema),
    config,
    hasChannel: Boolean(channelRef.current),
  });

  useEffect(() => {
    if (remoteRole !== "host" || !hostReadyRef.current || !channelRef.current) {
      return;
    }

    channelRef.current.postMessage({
      type: "SYNC_STATE",
      values: valuesRef.current,
      schema: remoteSchemaRef.current,
      config,
    });
  }, [remoteSchema, remoteRole, config]);

  useEffect(() => {
    if (remoteRole !== "host" || !hostReadyRef.current || !channelRef.current) {
      return;
    }

    channelRef.current.postMessage({
      type: "SYNC_STATE",
      values: valuesRef.current,
      schema: remoteSchemaRef.current,
      config,
    });
  }, [values, remoteRole, config]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get(REMOTE_CONTROLS_PARAM) === REMOTE_CONTROLS_CONTROLLER) {
      setRemoteRole("controller");
    }
  }, []);

  const setValueInternal = (
    key: string,
    value: any,
    { broadcast = true }: { broadcast?: boolean } = {}
  ) => {
    setValues((prev) => {
      if (prev[key] === value) return prev;
      const updated = { ...prev, [key]: value };
      valuesRef.current = updated;
      return updated;
    });

    if (
      broadcast &&
      channelRef.current &&
      typeof channelRef.current.postMessage === "function"
    ) {
      const message: RemoteMessage = {
        type: "UPDATE_VALUE",
        key,
        value,
        source: remoteRole,
      };
      channelRef.current.postMessage(message);
    }
  };

  const triggerButton = (key: string) => {
    if (remoteRole === "controller") {
      channelRef.current?.postMessage({
        type: "TRIGGER_BUTTON",
        key,
      });
      return;
    }

    const control = schemaRef.current[key];
    if (control && control.type === "button") {
      control.onClick?.();
    }
  };

  const setValue = (key: string, value: any) => {
    setValueInternal(key, value);
  };

  const registerSchema = (
    newSchema: ControlsSchema,
    opts?: { componentName?: string; config?: UseControlsConfig }
  ) => {
    console.log("[ControlsProvider] registerSchema start", {
      remoteRole,
      keys: Object.keys(newSchema),
      hasChannel: Boolean(channelRef.current),
    });
    if (opts?.componentName) {
      setComponentName(opts.componentName);
    }

    if (opts?.config) {
      const { addAdvancedPaletteControl, ...otherConfig } = opts.config;

      setConfig((prev) => ({
        ...prev,
        ...otherConfig,
        ...(Object.prototype.hasOwnProperty.call(
          opts.config,
          "addAdvancedPaletteControl"
        )
          ? {
              addAdvancedPaletteControl: addAdvancedPaletteControl
                ? resolveAdvancedPaletteConfig(addAdvancedPaletteControl)
                : undefined,
            }
          : {}),
      }));
    }

    setSchema((prevSchema) => ({ ...prevSchema, ...newSchema }));
    setValues((prevValues) => {
      const updated = { ...prevValues };

      for (const key in newSchema) {
        const control = newSchema[key];
        if (!(key in updated)) {
          if ("value" in control) {
            updated[key] = control.value;
          }
        }
      }

      valuesRef.current = updated;
      return updated;
    });

    const serialized: RemoteControlsSchema = Object.fromEntries(
      Object.entries(newSchema).map(([key, control]) => [
        key,
        serializeControl(key, control),
      ])
    );
    const nextRemoteSchema = {
      ...remoteSchemaRef.current,
      ...serialized,
    };
    remoteSchemaRef.current = nextRemoteSchema;
    setRemoteSchema(nextRemoteSchema);

    console.log("[ControlsProvider] remote schema updated", {
      remoteRole,
      keys: Object.keys(nextRemoteSchema),
      hostReady: hostReadyRef.current,
    });
    if (remoteRole === "host") {
      hostReadyRef.current = true;
      console.log("[ControlsProvider] host ready, broadcasting initial state");
      if (channelRef.current && channelNameRef.current) {
        channelRef.current.postMessage({
          type: "SYNC_STATE",
          values: valuesRef.current,
          schema: remoteSchemaRef.current,
          config,
        });
      }
    }
  };

  const contextValue = useMemo(
    () => ({
      schema,
      remoteSchema,
      values,
      setValue,
      triggerButton,
      registerSchema,
      componentName,
      config,
      remoteRole,
    }),
    [schema, remoteSchema, values, componentName, config, remoteRole]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!config?.remoteControl && remoteRole !== "controller") return;
    if (typeof BroadcastChannel === "undefined") return;

    console.log("[ControlsProvider] setting up channel", {
      remoteRole,
      channelRef: Boolean(channelRef.current),
      config,
    });

    const customChannelId =
      typeof config.remoteControl === "object"
        ? config.remoteControl.channelId
        : undefined;
    const channelName = `${REMOTE_CONTROL_CHANNEL_PREFIX}:${
      customChannelId ?? window.location.pathname
    }`;
    channelNameRef.current = channelName;
    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    const postState = () => {
      if (remoteRole === "host" && !hostReadyRef.current) return;
      console.log("[ControlsProvider] postState", {
        remoteRole,
        hostReady: hostReadyRef.current,
        values: Object.keys(valuesRef.current),
        schema: Object.keys(remoteSchemaRef.current),
      });
      const message: RemoteMessage = {
        type: "SYNC_STATE",
        values: valuesRef.current,
        schema: remoteSchemaRef.current,
        config,
      };
      channel.postMessage(message);
    };

    channel.onmessage = (event: MessageEvent<RemoteMessage>) => {
      const message = event.data;
      console.log("[ControlsProvider] onmessage", message);
      switch (message?.type) {
        case "HELLO": {
          if (
            remoteRole === "host" &&
            message.role === "controller" &&
            hostReadyRef.current
          ) {
            postState();
          }
          break;
        }
        case "REQUEST_STATE": {
          if (remoteRole === "host") {
            postState();
          }
          break;
        }
        case "SYNC_STATE": {
          if (!message?.values || typeof message.values !== "object") return;
          setValues((prev) => {
            const updated = { ...prev, ...message.values };
            valuesRef.current = updated;
            return updated;
          });
          if (remoteRole === "controller" && message?.schema) {
            setRemoteSchema(message.schema);
          }
          if (remoteRole === "controller" && message?.config) {
            setConfig((prev) => ({
              ...prev,
              ...message.config,
            }));
          }
          break;
        }
        case "UPDATE_VALUE": {
          if (message?.source === remoteRole) {
            return;
          }
          setValueInternal(message.key, message.value, {
            broadcast: false,
          });
          break;
        }
        case "TRIGGER_BUTTON": {
          if (remoteRole !== "host") return;
          const control = schemaRef.current[message.key];
          if (control && control.type === "button") {
            control.onClick?.();
          }
          break;
        }
        default:
          break;
      }
    };

    channel.postMessage({
      type: "HELLO",
      role: remoteRole,
    });
    console.log("[ControlsProvider] sent HELLO", remoteRole);

    if (remoteRole === "controller") {
      channel.postMessage({
        type: "REQUEST_STATE",
      });
    } else {
      postState();
    }

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [config?.remoteControl, remoteRole]);

  return (
    <ControlsContext.Provider value={contextValue}>
      {children}
    </ControlsContext.Provider>
  );
};

export const useControls = <T extends ControlsSchema>(
  schema: T,
  options?: UseControlsOptions
) => {
  const ctx = useContext(ControlsContext);
  if (!ctx) throw new Error("useControls must be used within ControlsProvider");
  const lastAdvancedPaletteSignature = useRef<string | null>(null);

  // Merge URL params with schema defaults
  const urlParams = getUrlParams();

  const resolvedAdvancedConfig = options?.config?.addAdvancedPaletteControl
    ? resolveAdvancedPaletteConfig(options.config.addAdvancedPaletteControl)
    : undefined;

  const schemaWithAdvanced = useMemo(() => {
    const baseSchema: ControlsSchema = { ...schema };
    if (!resolvedAdvancedConfig) return baseSchema;
    return createAdvancedPaletteSchemaEntries(
      baseSchema,
      resolvedAdvancedConfig
    );
  }, [schema, resolvedAdvancedConfig]);

  const urlParamsKey = useMemo(() => JSON.stringify(urlParams), [urlParams]);

  const mergedSchema = useMemo(() => {
    return Object.fromEntries(
      Object.entries(schemaWithAdvanced).map(([key, control]) => {
        const urlValue = urlParams[key];
        if (!urlValue || !("value" in control)) return [key, control];

        const defaultValue = control.value;

        let parsed: any = urlValue;
        if (typeof defaultValue === "number") {
          parsed = parseFloat(urlValue);
          if (isNaN(parsed)) parsed = defaultValue;
        } else if (typeof defaultValue === "boolean") {
          parsed = urlValue === "true";
        }

        return [
          key,
          {
            ...control,
            value: parsed,
          },
        ];
      })
    ) as ControlsSchema;
  }, [schemaWithAdvanced, urlParams, urlParamsKey]);

  // Register the merged schema
  useEffect(() => {
    console.log("[useControls] registerSchema effect", {
      componentName: options?.componentName,
      config: options?.config,
    });
    ctx.registerSchema(mergedSchema, options);
  }, [JSON.stringify(mergedSchema), JSON.stringify(options)]);

  // Set default values
  useEffect(() => {
    for (const key in mergedSchema) {
      if (!(key in ctx.values) && "value" in mergedSchema[key]) {
        ctx.setValue(key, mergedSchema[key].value);
      }
    }
  }, [JSON.stringify(mergedSchema), JSON.stringify(ctx.values)]);

  useEffect(() => {
    if (!resolvedAdvancedConfig?.onPaletteChange) return;

    const palette = resolvedAdvancedConfig.sections.reduce<AdvancedPalette>(
      (acc, section) => {
        const channels = CHANNEL_KEYS.reduce<Record<PaletteChannelKey, number>>(
          (channelAcc, channel) => {
            const key = createPaletteControlKey(
              resolvedAdvancedConfig.hiddenKeyPrefix,
              section.key,
              channel
            );
            const fallback =
              resolvedAdvancedConfig.defaultPalette?.[section.key]?.[channel] ??
              0;
            channelAcc[channel] = toNumberOr(ctx.values[key], fallback);
            return channelAcc;
          },
          {} as Record<PaletteChannelKey, number>
        );

        acc[section.key] = channels;
        return acc;
      },
      {} as AdvancedPalette
    );

    const signature = createPaletteSignature(palette);
    if (lastAdvancedPaletteSignature.current === signature) return;

    lastAdvancedPaletteSignature.current = signature;
    resolvedAdvancedConfig.onPaletteChange(clonePalette(palette));
  }, [ctx.values, resolvedAdvancedConfig]);

  // Strongly-typed return values
  const typedValues = ctx.values as {
    [K in keyof T]: T[K] extends { value: infer V } ? V : never;
  };

  const jsx = useCallback(() => {
    if (!options?.componentName) return "";
    const props = Object.entries(typedValues)
      .map(([key, val]) => {
        if (typeof val === "string") return `${key}="${val}"`;
        if (typeof val === "boolean") return `${key}={${val}}`;
        return `${key}={${JSON.stringify(val)}}`;
      })
      .join(" ");
    return `<${options.componentName} ${props} />`;
  }, [options?.componentName, JSON.stringify(typedValues)]);

  return {
    ...typedValues,
    controls: ctx.values,
    schema: ctx.schema,
    setValue: ctx.setValue,
    jsx,
  };
};

export const useUrlSyncedControls = useControls;
