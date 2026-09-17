/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets the dev server's HMR websocket (and hydration) work when hit from
  // a LAN IP instead of localhost — e.g. testing on a phone on the same
  // WiFi. Without this, requests from that origin get rejected and the app
  // never hydrates (silently — no console error, just every useEffect never
  // running, so the UI stays frozen in its server-rendered initial state).
  allowedDevOrigins: ["192.168.0.17"],
};
module.exports = nextConfig;