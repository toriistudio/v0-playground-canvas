"use client";

import React, { useState, useMemo } from "react";
import { Check, Copy, SquareArrowOutUpRight } from "lucide-react";

import { usePreviewUrl } from "@/hooks/usePreviewUrl";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectItem,
  SelectContent,
} from "@/components/ui/select";
import { useResizableLayout } from "@/context/ResizableLayout";
import { useControlsContext } from "@/context/ControlsContext";

import { Button } from "@/components/ui/button";

const ControlPanel: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const { leftPanelWidth, isDesktop, isHydrated } = useResizableLayout();

  const { schema, setValue, values, componentName, config } =
    useControlsContext();

  const previewUrl = usePreviewUrl(values);

  const normalControls = Object.entries(schema).filter(
    ([, control]) => control.type !== "button" && !control.hidden
  );
  const buttonControls = Object.entries(schema).filter(
    ([, control]) => control.type === "button" && !control.hidden
  );

  const jsx = useMemo(() => {
    if (!componentName) return "";
    const props = Object.entries(values)
      .map(([key, val]) => {
        if (typeof val === "string") return `${key}="${val}"`;
        if (typeof val === "boolean") return `${key}={${val}}`;
        return `${key}={${JSON.stringify(val)}}`;
      })
      .join(" ");
    return `<${componentName} ${props} />`;
  }, [componentName, values]);

  // Format raw schema keys into human-friendly labels
  const labelize = (key: string) =>
    key
      .replace(/([A-Z])/g, " $1")
      .replace(/[\-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/(^|\s)\S/g, (s) => s.toUpperCase());

  return (
    <div
      className={`order-2 md:order-1 w-full md:h-auto p-2 md:p-4 bg-stone-900 font-mono text-stone-300 transition-opacity duration-300 ${
        !isHydrated ? "opacity-0" : "opacity-100"
      }`}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      style={{
        width: "100%",
        height: "auto",
        flex: "0 0 auto",
        ...(isHydrated && isDesktop
          ? {
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${leftPanelWidth}%`,
              overflowY: "auto",
            }
          : {}),
      }}
    >
      <div className="dark mb-10 space-y-6 p-4 md:p-6 bg-stone-900/95 backdrop-blur-md border-2 border-stone-700 rounded-xl shadow-lg">
        <div className="space-y-1">
          <h1 className="text-lg text-stone-100 font-semibold">
            {config?.mainLabel ?? "Controls"}
          </h1>
        </div>

        <div className="space-y-6">
          {normalControls.map(([key, control]) => {
            const value = values[key];

            switch (control.type) {
              case "boolean":
                return (
                  <div key={key} className="flex items-center justify-between">
                    <Label htmlFor={key} className="cursor-pointer">
                      {labelize(key)}
                    </Label>
                    <Switch
                      id={key}
                      checked={value}
                      onCheckedChange={(v) => setValue(key, v)}
                      className="cursor-pointer scale-90"
                    />
                  </div>
                );

              case "number":
                return (
                  <div key={key} className="space-y-3 w-full">
                    <div className="flex items-center justify-between">
                      <Label className="text-stone-300" htmlFor={key}>
                        {labelize(key)}
                      </Label>
                      <Input
                        type="number"
                        value={value}
                        min={control.min ?? 0}
                        max={control.max ?? 100}
                        step={control.step ?? 1}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isNaN(v)) return;
                          setValue(key, v);
                        }}
                        className="w-20 text-center cursor-text"
                      />
                    </div>
                    <Slider
                      id={key}
                      min={control.min ?? 0}
                      max={control.max ?? 100}
                      step={control.step ?? 1}
                      value={[value]}
                      onValueChange={([v]) => setValue(key, v)}
                      className="w-full cursor-pointer"
                    />
                  </div>
                );

              case "string":
                return (
                  <div key={key} className="space-y-2 w-full">
                    <Label className="text-stone-300" htmlFor={key}>
                      {labelize(key)}
                    </Label>
                    <Input
                      id={key}
                      value={value}
                      placeholder={key}
                      onChange={(e) => setValue(key, e.target.value)}
                      className="bg-stone-900"
                    />
                  </div>
                );

              case "color":
                return (
                  <div key={key} className="space-y-2 w-full">
                    <Label className="text-stone-300" htmlFor={key}>
                      {labelize(key)}
                    </Label>
                    <input
                      type="color"
                      id={key}
                      value={value}
                      onChange={(e) => setValue(key, e.target.value)}
                      className="w-full h-10 rounded border border-stone-600 bg-transparent"
                    />
                  </div>
                );

              case "select":
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Label className="min-w-fit" htmlFor={key}>
                        {labelize(key)}
                      </Label>
                      <Select
                        value={value}
                        onValueChange={(val) => setValue(key, val)}
                      >
                        <SelectTrigger className="flex-1 cursor-pointer">
                          <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                        <SelectContent className="cursor-pointer z-[9999]">
                          {Object.entries(control.options).map(([label]) => (
                            <SelectItem
                              key={label}
                              value={label}
                              className="cursor-pointer"
                            >
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );

              default:
                return null;
            }
          })}
          {(buttonControls.length > 0 || jsx) && (
            <div>
              {jsx && config?.showCopyButton !== false && (
                <div key="control-panel-jsx" className="flex-1 pt-4">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(jsx);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 5000);
                    }}
                    className="w-full px-4 py-2 text-sm bg-stone-800 hover:bg-stone-700 text-white rounded-md flex items-center justify-center gap-2 shadow"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy to Clipboard
                      </>
                    )}
                  </button>
                </div>
              )}
              {buttonControls.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-4">
                  {buttonControls.map(([key, control]) =>
                    control.type === "button" ? (
                      <div
                        key={`control-panel-custom-${key}`}
                        className="flex-1 [&_[data-slot=button]]:w-full"
                      >
                        {control.render ? (
                          control.render()
                        ) : (
                          <button
                            onClick={control.onClick}
                            className="w-full px-4 py-2 text-sm bg-stone-800 hover:bg-stone-700 text-white rounded-md shadow"
                          >
                            {control.label ?? key}
                          </button>
                        )}
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {previewUrl && (
          <Button asChild>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-4 py-2 text-sm text-center bg-stone-900 hover:bg-stone-800 text-white rounded-md border border-stone-700"
            >
              <SquareArrowOutUpRight /> Open in a New Tab
            </a>
          </Button>
        )}
      </div>
    </div>
  );
};

export default ControlPanel;
