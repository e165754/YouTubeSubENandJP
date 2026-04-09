/**
 * 目的: 同一字幕セグメントの翻訳補完を短時間キャッシュし LLM コストを抑える
 * 主な役割: メモリ上の LRU 風マップ（サーバープロセス単位）
 * 他ファイルとの関係: subtitle-completion ルートから利用
 *
 * 注意: サーバーレスではインスタンスごとに別キャッシュになる点に留意
 */

import type { SubtitleCompletionResult } from "@/types/youtubeEnglishLearningViewer";

const maximumCacheEntryCount = 200;
const cacheKeyToResultMap = new Map<string, SubtitleCompletionResult>();

/**
 * 目的: キャッシュキーから結果を取り出す
 * 入力: cacheKey（string）
 * 出力: ヒット時 SubtitleCompletionResult、ミス時 undefined
 * 副作用: LRU のため Map の順序を更新する場合がある
 * エラー発生時の挙動: なし
 */
export function getSubtitleCompletionFromCache(
  cacheKey: string,
): SubtitleCompletionResult | undefined {
  const cachedResult = cacheKeyToResultMap.get(cacheKey);
  if (!cachedResult) {
    return undefined;
  }
  cacheKeyToResultMap.delete(cacheKey);
  cacheKeyToResultMap.set(cacheKey, cachedResult);
  return cachedResult;
}

/**
 * 目的: キャッシュへ結果を保存する（上限超過時は最古を削除）
 * 入力: cacheKey, completionResult
 * 出力: なし
 * 副作用: Map を更新
 * エラー発生時の挙動: なし
 */
export function setSubtitleCompletionInCache(
  cacheKey: string,
  completionResult: SubtitleCompletionResult,
): void {
  if (cacheKeyToResultMap.has(cacheKey)) {
    cacheKeyToResultMap.delete(cacheKey);
  }
  cacheKeyToResultMap.set(cacheKey, completionResult);
  while (cacheKeyToResultMap.size > maximumCacheEntryCount) {
    const oldestKey = cacheKeyToResultMap.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    cacheKeyToResultMap.delete(oldestKey);
  }
}

/**
 * 目的: キャッシュキーを安定化するためのヘルパ
 * 入力: videoId, startSeconds, sourceText, directionLabel
 * 出力: 連結キー string
 * 副作用: なし
 */
export function buildSubtitleCompletionCacheKey(input: {
  readonly youtubeVideoId: string;
  readonly startSeconds: number;
  readonly sourceText: string;
  readonly translationDirection: "en_to_ja" | "ja_to_en";
}): string {
  return [
    input.youtubeVideoId,
    String(input.startSeconds),
    input.translationDirection,
    input.sourceText,
  ].join("::");
}

/*
 * ファイル概要: 翻訳補完キャッシュ
 * 入出力の概要: key ↔ SubtitleCompletionResult
 * 依存関係の一覧: @/types/youtubeEnglishLearningViewer
 */
