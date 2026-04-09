/**
 * 目的: YouTube 公式 IFrame プレイヤーを埋め込み、再生時刻とシークを親へ橋渡しする
 * 主な役割: IFrame API の読込・Player 生成・getCurrentTime ポーリング
 * 他ファイルとの関係: YouTubeLearningWatchPageContent から利用
 */

/// <reference types="youtube" />

"use client";

import { useEffect, useId, useRef } from "react";

type YouTubeIframePlayerProperties = {
  readonly youtubeVideoId: string;
  readonly onCurrentPlaybackTimeSeconds: (currentSeconds: number) => void;
  readonly seekCommand: { readonly targetSeconds: number; readonly requestId: number } | null;
};

/**
 * 目的: グローバル API 準備済みかを判定する
 * 入力: なし
 * 出力: boolean
 * 副作用: なし
 */
function isYouTubeIframeApiReadyOnWindow(): boolean {
  return typeof window !== "undefined" && Boolean((window as unknown as { YT?: unknown }).YT);
}

/**
 * 目的: YouTube 埋め込みプレイヤーを表示し操作する
 * 入力: youtubeVideoId, 時刻コールバック, seekCommand
 * 出力: React 要素
 * 副作用: script 挿入、Player 生成、タイマー
 * エラー発生時の挙動: 失敗してもアプリ全体は落とさない（コンソールのみ想定）
 */
export function YouTubeIframePlayer({
  youtubeVideoId,
  onCurrentPlaybackTimeSeconds,
  seekCommand,
}: YouTubeIframePlayerProperties) {
  const reactGeneratedDomElementId = useId();
  const playerContainerDomElementId = `youtube-player-${reactGeneratedDomElementId.replace(/:/g, "")}`;
  const youtubePlayerInstanceRef = useRef<YT.Player | null>(null);
  const pollingTimerIdRef = useRef<number | null>(null);
  const lastAppliedSeekRequestIdRef = useRef<number>(-1);

  useEffect(() => {
    let isUnmounted = false;

    /**
     * 目的: 定期的に再生位置を親へ送る
     */
    function startPlaybackTimePolling(playerInstance: YT.Player) {
      if (pollingTimerIdRef.current !== null) {
        window.clearInterval(pollingTimerIdRef.current);
      }
      pollingTimerIdRef.current = window.setInterval(() => {
        try {
          const currentSeconds = playerInstance.getCurrentTime();
          if (!Number.isFinite(currentSeconds)) {
            return;
          }
          onCurrentPlaybackTimeSeconds(currentSeconds);
        } catch {
          /* プレイヤー未準備時は無視 */
        }
      }, 200);
    }

    /**
     * 目的: YT.Player を生成する
     */
    function createYoutubePlayerInstance() {
      if (isUnmounted) {
        return;
      }
      youtubePlayerInstanceRef.current?.destroy();
      youtubePlayerInstanceRef.current = new window.YT.Player(playerContainerDomElementId, {
        videoId: youtubeVideoId,
        width: "100%",
        height: "100%",
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            startPlaybackTimePolling(event.target);
          },
        },
      });
    }

    if (!isYouTubeIframeApiReadyOnWindow()) {
      const existingScript = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]',
      );
      if (!existingScript) {
        const scriptElement = document.createElement("script");
        scriptElement.src = "https://www.youtube.com/iframe_api";
        scriptElement.async = true;
        document.body.appendChild(scriptElement);
      }
      const previousReadyCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReadyCallback?.();
        createYoutubePlayerInstance();
      };
    } else {
      createYoutubePlayerInstance();
    }

    return () => {
      isUnmounted = true;
      if (pollingTimerIdRef.current !== null) {
        window.clearInterval(pollingTimerIdRef.current);
        pollingTimerIdRef.current = null;
      }
      youtubePlayerInstanceRef.current?.destroy();
      youtubePlayerInstanceRef.current = null;
    };
  }, [onCurrentPlaybackTimeSeconds, playerContainerDomElementId, youtubeVideoId]);

  useEffect(() => {
    if (!seekCommand) {
      return;
    }
    if (seekCommand.requestId === lastAppliedSeekRequestIdRef.current) {
      return;
    }
    const playerInstance = youtubePlayerInstanceRef.current;
    if (!playerInstance) {
      return;
    }
    try {
      playerInstance.seekTo(seekCommand.targetSeconds, true);
      lastAppliedSeekRequestIdRef.current = seekCommand.requestId;
    } catch {
      /* seek 失敗は無視 */
    }
  }, [seekCommand]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-zinc-800 bg-black">
      <div id={playerContainerDomElementId} className="h-full w-full" />
    </div>
  );
}

/*
 * ファイル概要: YouTube IFrame プレイヤー
 * 入出力の概要: videoId → 埋め込み + 時刻通知 + シーク
 * 依存関係の一覧: グローバル YT（@types/youtube）
 */
