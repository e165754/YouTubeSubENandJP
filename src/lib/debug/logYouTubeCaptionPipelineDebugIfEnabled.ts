/**
 * 目的: 字幕パイプライン（/api/captions〜マージ〜ローカル補完）の調査用ログを、明示的に有効化したときだけ出す
 * 主な役割: `DEBUG_YOUTUBE_CAPTION_PIPELINE` が真のとき `console.log` / `console.error` を整形して出力
 * 他ファイルとの関係: `src/app/api/captions/route.ts`、翻訳 lib、視聴ページ（公開用は別定数）から利用
 */

/**
 * 目的: サーバー側の字幕デバッグログを出すか判定する
 * 入力: なし（`process.env.DEBUG_YOUTUBE_CAPTION_PIPELINE` を読む）
 * 出力: 有効なら true
 * 副作用: なし
 * エラー発生時の挙動: なし
 */
export function isServerYouTubeCaptionPipelineDebugLoggingEnabled(): boolean {
  const rawFlag = process.env.DEBUG_YOUTUBE_CAPTION_PIPELINE;
  return rawFlag === "1" || rawFlag === "true";
}

/** ログ行の先頭に付与し、他ログと区別する */
const serverCaptionPipelineDebugLogPrefix = "[caption-pipeline][server]";

/**
 * 目的: サーバーで字幕調査ログを 1 行にまとめて出す（本番では既定オフ）
 * 入力: eventName, 任意の詳細オブジェクト
 * 出力: なし
 * 副作用: 有効時のみ console.log
 * エラー発生時の挙動: なし
 */
export function logServerYouTubeCaptionPipelineDebug(
  eventName: string,
  detailRecord?: Readonly<Record<string, unknown>>,
): void {
  if (!isServerYouTubeCaptionPipelineDebugLoggingEnabled()) {
    return;
  }
  if (detailRecord !== undefined) {
    console.log(serverCaptionPipelineDebugLogPrefix, eventName, detailRecord);
  } else {
    console.log(serverCaptionPipelineDebugLogPrefix, eventName);
  }
}

/*
 * ファイル概要: 字幕パイプラインのサーバー側デバッグログゲート
 * 入出力の概要: env 参照・console 出力
 * 依存関係の一覧: なし
 */
