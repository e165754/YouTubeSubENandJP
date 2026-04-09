/**
 * 目的: 再生位置秒から、該当するバイリンガル字幕行のインデックスを求める
 * 主な役割: ハイライト・オーバーレイの同期に使用
 * 他ファイルとの関係: 視聴ページのクライアントコンポーネントから利用
 *
 * 注意: 行判定では「実効再生時刻 = 再生時刻 − ラグ秒」を使う。
 * ラグが正だと実効時刻が遅れ字幕表示が遅れる。ラグが負だと実効時刻が進み字幕が早く切り替わる。
 */

import type { BilingualTranscriptCue } from "@/types/youtubeEnglishLearningViewer";

/** 環境変数未設定時に使うラグ（秒）。負値は比較用時刻を進め、字幕切り替えをやや早める。 */
const defaultSubtitlePlaybackSyncLagSecondsWhenEnvironmentVariableUnset = -0.35;

/** 環境変数で指定できるラグの絶対値の上限（秒）。誤設定で挙動が極端になるのを防ぐ。 */
const maximumAbsoluteSubtitlePlaybackSyncLagSecondsFromEnvironment = 5;

/**
 * 目的: クライアントで字幕同期に使うラグ秒を解決する（ビルド時に NEXT_PUBLIC が埋め込まれる）
 * 入力: なし
 * 出力: [-maximumAbsolute, +maximumAbsolute] の範囲の秒（既定は負の既定定数）
 * 副作用: なし
 * エラー発生時の挙動: 不正値・未設定は既定値にフォールバック
 */
function resolveSubtitlePlaybackSyncLagSeconds(): number {
  const rawValueFromEnvironment = process.env.NEXT_PUBLIC_SUBTITLE_PLAYBACK_SYNC_LAG_SECONDS;
  if (rawValueFromEnvironment === undefined || rawValueFromEnvironment.trim() === "") {
    return defaultSubtitlePlaybackSyncLagSecondsWhenEnvironmentVariableUnset;
  }
  const parsedLagSeconds = Number.parseFloat(rawValueFromEnvironment.trim());
  if (
    !Number.isFinite(parsedLagSeconds) ||
    parsedLagSeconds < -maximumAbsoluteSubtitlePlaybackSyncLagSecondsFromEnvironment ||
    parsedLagSeconds > maximumAbsoluteSubtitlePlaybackSyncLagSecondsFromEnvironment
  ) {
    return defaultSubtitlePlaybackSyncLagSecondsWhenEnvironmentVariableUnset;
  }
  return parsedLagSeconds;
}

const resolvedSubtitlePlaybackSyncLagSeconds: number = resolveSubtitlePlaybackSyncLagSeconds();

/**
 * 目的: 現在時刻が収まるキューのインデックスを返す（見つからなければ -1）
 * 入力: bilingualCueList, currentPlaybackTimeSeconds（IFrame の getCurrentTime 相当）
 * 出力: 0 以上の index または -1
 * 副作用: なし
 * エラー発生時の挙動: なし
 */
export function findActiveBilingualCueIndex(
  bilingualCueList: readonly BilingualTranscriptCue[],
  currentPlaybackTimeSeconds: number,
): number {
  const effectivePlaybackTimeSecondsForCueMatching = Math.max(
    0,
    currentPlaybackTimeSeconds - resolvedSubtitlePlaybackSyncLagSeconds,
  );
  return bilingualCueList.findIndex(
    (bilingualCue) =>
      effectivePlaybackTimeSecondsForCueMatching >= bilingualCue.startSeconds &&
      effectivePlaybackTimeSecondsForCueMatching < bilingualCue.endSeconds,
  );
}

/*
 * ファイル概要: 字幕アクティブ行検索（再生時刻ラグ補正付き）
 * 入出力の概要: cues + time → index
 * 依存関係の一覧: @/types/youtubeEnglishLearningViewer
 */
