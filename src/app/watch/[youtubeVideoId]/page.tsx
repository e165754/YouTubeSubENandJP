/**
 * 目的: 動画視聴（埋め込み + 字幕 + スクリプト）のルートページ
 * 主な役割: 動的セグメント youtubeVideoId をクライアントコンテナへ渡す
 * 他ファイルとの関係: YouTubeLearningWatchPageContent を描画
 */

import type { Metadata } from "next";
import { YouTubeLearningWatchPageContent } from "@/components/watch/YouTubeLearningWatchPageContent";

type WatchPageProperties = {
  readonly params: Promise<{ youtubeVideoId: string }>;
};

/**
 * 目的: 動的メタデータを生成する
 * 入力: params
 * 出力: Metadata
 * 副作用: なし
 * エラー発生時の挙動: なし
 */
export async function generateMetadata(
  watchPageProperties: WatchPageProperties,
): Promise<Metadata> {
  const routeParameters = await watchPageProperties.params;
  return {
    title: `視聴: ${routeParameters.youtubeVideoId} | YouTube英語学習ビュワー`,
  };
}

/**
 * 目的: 視聴ページのサーバーコンポーネント本体
 * 入力: params.youtubeVideoId
 * 出力: React 要素
 * 副作用: なし
 * エラー発生時の挙動: なし
 */
export default async function WatchYoutubeVideoPage(watchPageProperties: WatchPageProperties) {
  const routeParameters = await watchPageProperties.params;
  return <YouTubeLearningWatchPageContent youtubeVideoId={routeParameters.youtubeVideoId} />;
}

/*
 * ファイル概要: /watch/[youtubeVideoId] ページ
 * 入出力の概要: URL パラメータ → クライアント視聴 UI
 * 依存関係の一覧: next, @/components/watch/YouTubeLearningWatchPageContent
 */
