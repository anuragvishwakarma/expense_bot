import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.*.*"], // dev only: lets phones on LAN hydrate
};

export default nextConfig;
