export const WS_URL = (() => {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
})();

export const API_BASE = "";

export const CONVEX_URL_ENDPOINT = "/convex-url";
export const CONFIG_ENDPOINT = "/config";
