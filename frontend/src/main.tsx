import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "./app/provider";
import { App } from "./app/app";
import "./index.css";

// Apply persisted theme immediately to avoid flash
(() => {
  try {
    const stored = JSON.parse(localStorage.getItem("gemini-live-theme") ?? "{}");
    const theme = stored?.state?.theme ?? "dark";
    const isDark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  } catch {
    document.documentElement.classList.add("dark");
  }
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
