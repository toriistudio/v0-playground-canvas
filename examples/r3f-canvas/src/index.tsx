if (typeof window !== "undefined") {
  console.log("[BC] instrumentation boot", (window as any).__BC_INSPECTOR__);
}

if (typeof window !== "undefined" && !(window as any).__BC_INSPECTOR__) {
  const OriginalBroadcastChannel = window.BroadcastChannel;
  window.BroadcastChannel = function patchedBroadcastChannel(name: string) {
    const channel = new OriginalBroadcastChannel(name);
    console.log("[BC:new]", name);

    const originalPost = channel.postMessage.bind(channel);
    channel.postMessage = (message: any) => {
      console.log("[BC:post]", name, message);
      return originalPost(message);
    };

    channel.addEventListener("message", (event) => {
      console.log("[BC:onmessage]", name, event.data);
    });

    return channel;
  } as typeof window.BroadcastChannel;

  (window as any).__BC_INSPECTOR__ = true;
  console.log("[BC] instrumentation attached");
}

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
