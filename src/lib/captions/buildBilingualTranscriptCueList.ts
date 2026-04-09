/**
 * 目的: 英語字幕と日本語字幕を時間軸で概ね対応付け、UI 用の BilingualTranscriptCue を生成する
 * 主な役割: 同期ズレ・区間の隙・YouTube 自動翻訳トラックのわずかなズレを許容して結合する
 * 他ファイルとの関係: captions API から利用
 *
 * 注意: 旧実装は「重なり > 50ms」のみ採用し、接する区間や tlang 由来の微ズレで日本語が全欠損しやすかった。
 */

import type {
  BilingualTranscriptCue,
  TranscriptCue,
} from "@/types/youtubeEnglishLearningViewer";

/** 英語終了後、この秒数以上先にしか日本語が来ない場合はこれ以上の日本語候補を見ない（開始時刻昇順を前提） */
const overlapScanGraceSecondsAfterEnglishSegmentEnd = 3.5;

/** 区間が重ならないが「隙がこれ以下」なら、YouTube の境界丸めで同一発話とみなす */
const segmentTouchingMaximumGapSeconds = 0.35;

/** 上記「すれ違いギャップ」に対して付与する仮想重なりスコア（閾値より小さくしないこと） */
const segmentTouchingOverlapCreditSeconds = 0.08;

/** このスコア以上なら重なり（または接続）一致として日本語を採用する */
const minimumOverlapScoreToAcceptJapaneseCue = 0.034;

/** 重なりが取れないとき、中点距離がこの秒数以内の日本語行をフォールバックで採用する */
const maximumMidpointDistanceSecondsForFallbackJapanesePairing = 8.0;

/**
 * 目的: 2 区間の「実効」重なりスコアを返す（接する境界もわずかに正のスコアにする）
 * 入力: englishCue, japaneseCue
 * 出力: 秒相当のスコア（大きいほど一致が強い）
 * 副作用: なし
 * エラー発生時の挙動: なし
 */
function computeOverlapScoreBetweenTranscriptCues(
  englishCue: TranscriptCue,
  japaneseCue: TranscriptCue,
): number {
  const overlapIntervalStartSeconds = Math.max(englishCue.startSeconds, japaneseCue.startSeconds);
  const overlapIntervalEndSeconds = Math.min(englishCue.endSeconds, japaneseCue.endSeconds);
  const rawOverlapDurationSeconds = Math.max(0, overlapIntervalEndSeconds - overlapIntervalStartSeconds);
  if (rawOverlapDurationSeconds >= minimumOverlapScoreToAcceptJapaneseCue) {
    return rawOverlapDurationSeconds;
  }
  const earlierSegmentEndSeconds = Math.min(englishCue.endSeconds, japaneseCue.endSeconds);
  const laterSegmentStartSeconds = Math.max(englishCue.startSeconds, japaneseCue.startSeconds);
  const gapBetweenNonOverlappingSegmentsSeconds = laterSegmentStartSeconds - earlierSegmentEndSeconds;
  if (
    gapBetweenNonOverlappingSegmentsSeconds >= 0 &&
    gapBetweenNonOverlappingSegmentsSeconds <= segmentTouchingMaximumGapSeconds
  ) {
    return segmentTouchingOverlapCreditSeconds;
  }
  return rawOverlapDurationSeconds;
}

/**
 * 目的: 字幕区間の時間中央（代表時刻）を返す
 * 入力: cue
 * 出力: 秒
 * 副作用: なし
 * エラー発生時の挙動: なし
 */
function computeTranscriptCueMidpointSeconds(cue: TranscriptCue): number {
  return (cue.startSeconds + cue.endSeconds) / 2;
}

/**
 * 目的: 2つのキューから英語1行ごとに最適な日本語を選び、BilingualTranscriptCue を生成する
 * 入力: englishCueList, japaneseCueList — それぞれ開始時刻昇順ソート済みを想定（パーサがソートする）
 * 出力: 英語基準の BilingualTranscriptCue 配列
 * 副作用: なし
 * エラー発生時の挙動: 入力が空でも例外にしない
 *
 * 注意: 同一の日本語行が複数の英語行に対応付く場合がある（英語の分割が細かいとき等）。意図的に「占有」しない。
 */
export function buildBilingualTranscriptCueListFromSeparateTracks(
  englishCueList: readonly TranscriptCue[],
  japaneseCueList: readonly TranscriptCue[],
): BilingualTranscriptCue[] {
  const bilingualCueList: BilingualTranscriptCue[] = [];

  for (const englishCue of englishCueList) {
    let bestJapaneseCueByOverlap: TranscriptCue | null = null;
    let bestOverlapScore = 0;

    for (const japaneseCue of japaneseCueList) {
      if (
        japaneseCue.startSeconds >
        englishCue.endSeconds + overlapScanGraceSecondsAfterEnglishSegmentEnd
      ) {
        break;
      }
      const overlapScore = computeOverlapScoreBetweenTranscriptCues(englishCue, japaneseCue);
      if (overlapScore > bestOverlapScore) {
        bestOverlapScore = overlapScore;
        bestJapaneseCueByOverlap = japaneseCue;
      }
    }

    let selectedJapaneseText: string | null = null;
    if (
      bestJapaneseCueByOverlap &&
      bestOverlapScore >= minimumOverlapScoreToAcceptJapaneseCue
    ) {
      selectedJapaneseText = bestJapaneseCueByOverlap.text;
    } else {
      let smallestMidpointDistanceSeconds = Infinity;
      let bestJapaneseCueByMidpoint: TranscriptCue | null = null;
      const englishCueMidpointSeconds = computeTranscriptCueMidpointSeconds(englishCue);
      for (const japaneseCue of japaneseCueList) {
        const midpointDistanceSeconds = Math.abs(
          computeTranscriptCueMidpointSeconds(japaneseCue) - englishCueMidpointSeconds,
        );
        if (
          midpointDistanceSeconds < smallestMidpointDistanceSeconds &&
          midpointDistanceSeconds <= maximumMidpointDistanceSecondsForFallbackJapanesePairing
        ) {
          smallestMidpointDistanceSeconds = midpointDistanceSeconds;
          bestJapaneseCueByMidpoint = japaneseCue;
        }
      }
      if (bestJapaneseCueByMidpoint) {
        selectedJapaneseText = bestJapaneseCueByMidpoint.text;
      }
    }

    bilingualCueList.push({
      startSeconds: englishCue.startSeconds,
      endSeconds: englishCue.endSeconds,
      englishText: englishCue.text,
      japaneseText: selectedJapaneseText,
      missingJapanese: selectedJapaneseText === null,
      missingEnglish: false,
    });
  }

  if (englishCueList.length === 0 && japaneseCueList.length > 0) {
    return japaneseCueList.map((japaneseCue) => ({
      startSeconds: japaneseCue.startSeconds,
      endSeconds: japaneseCue.endSeconds,
      englishText: "",
      japaneseText: japaneseCue.text,
      missingJapanese: false,
      missingEnglish: true,
    }));
  }

  return bilingualCueList;
}

/*
 * ファイル概要: 英日字幕の時間軸マージ
 * 入出力の概要: TranscriptCue[]×2 → BilingualTranscriptCue[]
 * 依存関係の一覧: @/types/youtubeEnglishLearningViewer
 */
