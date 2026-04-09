/**
 * 目的: ブラウザ上で `/api/captions` の結果を追いやすくする（既定オフ）
 * 主な役割: `NEXT_PUBLIC_DEBUG_YOUTUBE_CAPTION_PIPELINE` が真のときのみ console に出す
 * 他ファイルとの関係: `YouTubeLearningWatchPageContent.tsx` の fetch 後処理
 */

/**
 * 目的: クライアントの字幕デバッグログを出すか判定する
 * 入力: なし
 * 出力: ビルド時に埋め込まれた公開 env が真なら true
 * 副作用: なし
 * エラー発生時の挙動: なし
 */
export function isClientYouTubeCaptionPipelineDebugLoggingEnabled(): boolean {
  const rawFlag = process.env.NEXT_PUBLIC_DEBUG_YOUTUBE_CAPTION_PIPELINE;
  return rawFlag === "1" || rawFlag === "true";
}

const clientCaptionPipelineDebugLogPrefix = "[caption-pipeline][client]";

/**
 * 目的: クライアントで字幕調査ログを出す
 * 入力: eventName, 任意の詳細
 * 出力: なし
 * 副作用: 有効時のみ console.log / warn / error
 * エラー発生時の挙動: なし
 */
export function logClientYouTubeCaptionPipelineDebug(
  eventName: string,
  detailRecord?: Readonly<Record<string, unknown>>,
): void {
  if (!isClientYouTubeCaptionPipelineDebugLoggingEnabled()) {
    return;
  }
  if (detailRecord !== undefined) {
    console.log(clientCaptionPipelineDebugLogPrefix, eventName, detailRecord);
  } else {
    console.log(clientCaptionPipelineDebugLogPrefix, eventName);
  }
}

/*
 * ファイル概要: 字幕パイプラインのクライアント側デバッグログゲート
 * 入出力の概要: env 参照・console 出力
 * 依存関係の一覧: なし
 */
