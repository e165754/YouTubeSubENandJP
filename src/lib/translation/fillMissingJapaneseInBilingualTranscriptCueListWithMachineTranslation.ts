/**
 * 目的: BilingualTranscriptCue のうち日本語欠損行だけをローカル ONNX 翻訳で埋める
 * 主な役割: 外部翻訳 API キー不要（@xenova/transformers + NLLB）
 * 他ファイルとの関係: /api/captions から利用
 *
 * 無効化: `DISABLE_LOCAL_NLLB_SUBTITLE_TRANSLATION=true` のとき何もしない（サーバーレス向け）。
 */

import type { BilingualTranscriptCue } from "@/types/youtubeEnglishLearningViewer";
import { logServerYouTubeCaptionPipelineDebug } from "@/lib/debug/logYouTubeCaptionPipelineDebugIfEnabled";
import { translateEnglishTextListToJapaneseWithLocalNllbPipeline } from "@/lib/translation/translateEnglishTextListToJapaneseWithLocalNllbPipeline";

/**
 * 目的: 欠損日本語をローカル NLLB で補う
 * 入力: bilingualCueList
 * 出力: 補完後のリストとプロバイダ識別子
 * 副作用: 初回はモデルダウンロード、以降は ONNX 推論
 * エラー発生時の挙動: 例外を握りつぶし元リストを返す。サーバーログに概要を出す。
 */
export async function fillMissingJapaneseInBilingualTranscriptCueListWithMachineTranslation(
  bilingualCueList: readonly BilingualTranscriptCue[],
): Promise<{
  readonly bilingualCueList: BilingualTranscriptCue[];
  readonly appliedMachineTranslation: boolean;
  readonly machineTranslationProviderUsed: null | "local_nllb";
}> {
  const missingJapaneseCueIndexList: number[] = [];
  const englishTextListForTranslation: string[] = [];
  for (let cueIndex = 0; cueIndex < bilingualCueList.length; cueIndex += 1) {
    const cue = bilingualCueList[cueIndex];
    if (cue.missingJapanese && cue.englishText.trim().length > 0) {
      missingJapaneseCueIndexList.push(cueIndex);
      englishTextListForTranslation.push(cue.englishText);
    }
  }

  if (englishTextListForTranslation.length === 0) {
    logServerYouTubeCaptionPipelineDebug("ローカル NLLB: 補完対象行なし（missingJapanese かつ英語あり が 0 件）", {
      totalBilingualCueCount: bilingualCueList.length,
    });
    return {
      bilingualCueList: [...bilingualCueList],
      appliedMachineTranslation: false,
      machineTranslationProviderUsed: null,
    };
  }

  const isLocalNllbSubtitleTranslationDisabled =
    process.env.DISABLE_LOCAL_NLLB_SUBTITLE_TRANSLATION === "true" ||
    process.env.DISABLE_LOCAL_NLLB_SUBTITLE_TRANSLATION === "1";

  if (isLocalNllbSubtitleTranslationDisabled) {
    logServerYouTubeCaptionPipelineDebug("ローカル NLLB: DISABLE_LOCAL_NLLB_SUBTITLE_TRANSLATION によりスキップ", {
      linesThatWouldHaveBeenTranslatedCount: englishTextListForTranslation.length,
    });
    return {
      bilingualCueList: [...bilingualCueList],
      appliedMachineTranslation: false,
      machineTranslationProviderUsed: null,
    };
  }

  logServerYouTubeCaptionPipelineDebug("ローカル NLLB: 推論開始", {
    linesToTranslateCount: englishTextListForTranslation.length,
  });

  try {
    const translatedJapaneseTextList = await translateEnglishTextListToJapaneseWithLocalNllbPipeline({
      englishTextList: englishTextListForTranslation,
    });

    const nextCueList: BilingualTranscriptCue[] = bilingualCueList.map((cue) => ({ ...cue }));
    let filledCueCount = 0;
    for (
      let translationIndex = 0;
      translationIndex < missingJapaneseCueIndexList.length;
      translationIndex += 1
    ) {
      const cueIndex = missingJapaneseCueIndexList[translationIndex];
      const translatedJapaneseText = translatedJapaneseTextList[translationIndex];
      const normalizedJapaneseText =
        typeof translatedJapaneseText === "string" ? translatedJapaneseText.trim() : "";
      if (normalizedJapaneseText.length > 0) {
        const previousCue = nextCueList[cueIndex];
        nextCueList[cueIndex] = {
          ...previousCue,
          japaneseText: normalizedJapaneseText,
          missingJapanese: false,
        };
        filledCueCount += 1;
      }
    }

    logServerYouTubeCaptionPipelineDebug("ローカル NLLB: 推論完了", {
      linesToTranslateCount: englishTextListForTranslation.length,
      successfullyFilledCueCount: filledCueCount,
    });

    return {
      bilingualCueList: nextCueList,
      appliedMachineTranslation: filledCueCount > 0,
      machineTranslationProviderUsed: filledCueCount > 0 ? "local_nllb" : null,
    };
  } catch (translationFailure: unknown) {
    const failureMessage =
      translationFailure instanceof Error ? translationFailure.message : String(translationFailure);
    console.error(
      "[fillMissingJapaneseInBilingualTranscriptCueListWithMachineTranslation] ローカル NLLB 翻訳に失敗しました:",
      failureMessage,
    );
    return {
      bilingualCueList: [...bilingualCueList],
      appliedMachineTranslation: false,
      machineTranslationProviderUsed: null,
    };
  }
}

/*
 * ファイル概要: ローカル NLLB による日本語欠損の埋め合わせ
 * 入出力の概要: BilingualTranscriptCue[] → 補完済み配列
 * 依存関係の一覧: @/types/*, ./translateEnglishTextListToJapaneseWithLocalNllbPipeline
 */
