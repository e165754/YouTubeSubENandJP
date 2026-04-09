import type { NextConfig } from "next";

/**
 * process.cwd() は `npm run dev` を実行したディレクトリを返す。
 * Turbopack が自動検出するワークスペースルートが親フォルダ（Desktop 等）に
 * 誤設定される場合に明示することで tailwindcss の解決エラーを防ぐ。
 */
const projectRootAbsolutePath = process.cwd();

const nextConfig: NextConfig = {
  /** @xenova/transformers（ONNX）をサーバーバンドルから外し、実行時に解決する */
  serverExternalPackages: ["@xenova/transformers", "sharp", "onnxruntime-node"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/**",
      },
    ],
  },
  turbopack: {
    root: projectRootAbsolutePath,
  },
  /**
   * Turbopack の SST 永続化が環境（同期ツール・権限・競合）で失敗する場合があるため無効化。
   * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopackFileSystemCache
   */
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
