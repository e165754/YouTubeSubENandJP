/**
 * 目的: 動画IDから英日字幕を取得し、ビュワー用に結合した JSON を返す
 * 主な役割: timedtext のフェッチ・パース・時間軸マージ
 * 他ファイルとの関係: 視聴ページの初期ロードで呼ばれる
 */

import { NextResponse } from "next/server";
import {
  fetchYouTubeTimedTextJapaneseXmlViaYoutubeAutoTranslationParameter,
  fetchYouTubeTimedTextXmlWithLanguageFallback,
} from "@/lib/captions/fetchYouTubeTimedTextXmlForLanguage";
import { fetchEnglishAndJapaneseCaptionXmlViaInnerTubePlayerApi } from "@/lib/captions/fetchYouTubeCaptionXmlViaInnerTubePlayerApi";
import {
  fetchEnglishAndJapaneseCaptionXmlUsingWatchPagePlayerResponse,
  type CaptionXmlFetchResult,
} from "@/lib/captions/fetchYouTubeCaptionXmlViaWatchPagePlayerResponse";
import { parseYouTubeTimedTextXmlString } from "@/lib/captions/parseYouTubeTimedTextXmlString";
import { buildBilingualTranscriptCueListFromSeparateTracks } from "@/lib/captions/buildBilingualTranscriptCueList";
import { logServerYouTubeCaptionPipelineDebug } from "@/lib/debug/logYouTubeCaptionPipelineDebugIfEnabled";

/** ローカル NLLB 推論で長時間かかるため上限を広げる（ホスティングが対応している場合のみ有効） */
export const maxDuration = 300;

/**
 * 目的: デバッグ時に bilingual リストの健全性を数値化する
 * 入力: bilingualCueList
 * 出力: 件数・欠損日本語行数など
 * 副作用: なし
 * エラー発生時の挙動: なし
 */
function summarizeBilingualCueListForCaptionPipelineDebug(
  bilingualCueList: readonly { missingJapanese: boolean; englishText: string }[],
): {
  readonly totalCueCount: number;
  readonly missingJapaneseCueCount: number;
  readonly emptyEnglishTextCueCount: number;
} {
  let missingJapaneseCueCount = 0;
  let emptyEnglishTextCueCount = 0;
  for (const cue of bilingualCueList) {
    if (cue.missingJapanese) {
      missingJapaneseCueCount += 1;
    }
    if (cue.englishText.trim().length === 0) {
      emptyEnglishTextCueCount += 1;
    }
  }
  return {
    totalCueCount: bilingualCueList.length,
    missingJapaneseCueCount,
    emptyEnglishTextCueCount,
  };
}

/**
 * 目的: InnerTube・視聴ページ・timedtext から得た日本語字幕候補のうち、ネイティブを自動翻訳より優先して選ぶ
 * 入力: 各経路の取得結果（null 可）
 * 出力: 採用する 1 件または null
 * 副作用: なし
 * エラー発生時の挙動: なし
 */
function selectPreferredJapaneseCaptionFetchResult(
  japaneseCaptionFetchResultFromInnerTube: CaptionXmlFetchResult | null,
  japaneseCaptionFetchResultFromPlayerResponse: CaptionXmlFetchResult | null,
  japaneseCaptionFetchResultFromTimedTextNative: CaptionXmlFetchResult | null,
): CaptionXmlFetchResult | null {
  const japaneseCaptionFetchCandidateList: readonly (CaptionXmlFetchResult | null)[] = [
    japaneseCaptionFetchResultFromInnerTube,
    japaneseCaptionFetchResultFromPlayerResponse,
    japaneseCaptionFetchResultFromTimedTextNative,
  ];
  for (const japaneseCaptionFetchCandidate of japaneseCaptionFetchCandidateList) {
    if (
      japaneseCaptionFetchCandidate &&
      !japaneseCaptionFetchCandidate.isAcquiredViaYoutubeAutoTranslation
    ) {
      return japaneseCaptionFetchCandidate;
    }
  }
  return (
    japaneseCaptionFetchResultFromInnerTube ??
    japaneseCaptionFetchResultFromPlayerResponse ??
    japaneseCaptionFetchResultFromTimedTextNative
  );
}

/**
 * 目的: GET で videoId を受け取り、字幕キューを返す
 * 入力: searchParams.videoId
 * 出力: bilingualCueList, resolved*LanguageCode, japaneseIsYoutubeAutoTranslation, japaneseIsMachineTranslationFallback, japaneseMachineTranslationProvider
 * 副作用: YouTube への fetch
 * エラー発生時の挙動: 400/404/502
 */
export async function GET(request: Request): Promise<NextResponse> {
  const captionPipelineStartedAtMilliseconds = Date.now();
  const requestUrl = new URL(request.url);
  const youtubeVideoId = (requestUrl.searchParams.get("videoId") ?? "").trim();
  if (!youtubeVideoId || youtubeVideoId.length < 6) {
    return NextResponse.json({ errorMessage: "videoId が不正です。" }, { status: 400 });
  }

  logServerYouTubeCaptionPipelineDebug("GET /api/captions 開始", {
    youtubeVideoId,
    captionPipelineStartedAtMilliseconds,
  });

  const englishLanguageFallbackList = ["en", "en-US", "en-GB"];
  const japaneseLanguageFallbackList = ["ja", "ja-JP"];

  const innerTubeCaptionFetchOutcome = await fetchEnglishAndJapaneseCaptionXmlViaInnerTubePlayerApi({
    youtubeVideoId,
    englishLanguageFallbackCodeList: englishLanguageFallbackList,
    japaneseLanguageFallbackCodeList: japaneseLanguageFallbackList,
  });

  const playerResponseCaptionFetchOutcome =
    await fetchEnglishAndJapaneseCaptionXmlUsingWatchPagePlayerResponse({
      youtubeVideoId,
      englishLanguageFallbackCodeList: englishLanguageFallbackList,
      japaneseLanguageFallbackCodeList: japaneseLanguageFallbackList,
    });

  let englishFetchResult =
    innerTubeCaptionFetchOutcome.englishFetchResult ??
    playerResponseCaptionFetchOutcome.englishFetchResult;
  if (!englishFetchResult) {
    englishFetchResult = await fetchYouTubeTimedTextXmlWithLanguageFallback(
      youtubeVideoId,
      englishLanguageFallbackList,
    );
  }

  let japaneseFetchResult = selectPreferredJapaneseCaptionFetchResult(
    innerTubeCaptionFetchOutcome.japaneseFetchResult,
    playerResponseCaptionFetchOutcome.japaneseFetchResult,
    null,
  );

  const shouldAttemptNativeJapaneseTimedTextFetch =
    !japaneseFetchResult ||
    japaneseFetchResult.isAcquiredViaYoutubeAutoTranslation === true;

  if (shouldAttemptNativeJapaneseTimedTextFetch) {
    const japaneseCaptionFetchResultFromTimedTextNative =
      await fetchYouTubeTimedTextXmlWithLanguageFallback(
        youtubeVideoId,
        japaneseLanguageFallbackList,
      );
    japaneseFetchResult = selectPreferredJapaneseCaptionFetchResult(
      innerTubeCaptionFetchOutcome.japaneseFetchResult,
      playerResponseCaptionFetchOutcome.japaneseFetchResult,
      japaneseCaptionFetchResultFromTimedTextNative,
    );
  }

  if (!japaneseFetchResult && englishFetchResult) {
    const japaneseCaptionFetchResultFromTimedTextAutoTranslation =
      await fetchYouTubeTimedTextJapaneseXmlViaYoutubeAutoTranslationParameter(
        youtubeVideoId,
        englishFetchResult.resolvedLanguageCode,
      );
    if (japaneseCaptionFetchResultFromTimedTextAutoTranslation) {
      japaneseFetchResult = {
        xmlString: japaneseCaptionFetchResultFromTimedTextAutoTranslation.xmlString,
        resolvedLanguageCode: japaneseCaptionFetchResultFromTimedTextAutoTranslation.resolvedLanguageCode,
        isAcquiredViaYoutubeAutoTranslation: true,
      };
    }
  }

  const englishCueList = englishFetchResult
    ? parseYouTubeTimedTextXmlString(englishFetchResult.xmlString)
    : [];
  const japaneseCueList = japaneseFetchResult
    ? parseYouTubeTimedTextXmlString(japaneseFetchResult.xmlString)
    : [];

  logServerYouTubeCaptionPipelineDebug("XML パース後（単言語キュー件数）", {
    youtubeVideoId,
    englishSingleLanguageCueCount: englishCueList.length,
    japaneseSingleLanguageCueCount: japaneseCueList.length,
    resolvedEnglishLanguageCode: englishFetchResult?.resolvedLanguageCode ?? null,
    resolvedJapaneseLanguageCode: japaneseFetchResult?.resolvedLanguageCode ?? null,
    japaneseIsYoutubeAutoTranslation: japaneseFetchResult?.isAcquiredViaYoutubeAutoTranslation === true,
    englishSourceLabel: englishFetchResult
      ? innerTubeCaptionFetchOutcome.englishFetchResult === englishFetchResult
        ? "innerTube"
        : playerResponseCaptionFetchOutcome.englishFetchResult === englishFetchResult
          ? "playerResponse"
          : "timedtext_fallback"
      : null,
  });

  if (englishCueList.length === 0 && japaneseCueList.length === 0) {
    const diagnosticDetailMessage =
      innerTubeCaptionFetchOutcome.innerTubeDiagnosticMessage ??
      playerResponseCaptionFetchOutcome.playerResponseDiagnosticMessage ??
      "字幕 XML の取得に失敗しました（プレイヤー応答にトラックが無い、または取得 URL が拒否された可能性があります）。";
    logServerYouTubeCaptionPipelineDebug("404: 英日ともパース結果が空", {
      youtubeVideoId,
      diagnosticDetailMessage,
      innerTubeDiagnosticMessage: innerTubeCaptionFetchOutcome.innerTubeDiagnosticMessage ?? null,
      playerResponseDiagnosticMessage:
        playerResponseCaptionFetchOutcome.playerResponseDiagnosticMessage ?? null,
      elapsedMillisecondsSinceCaptionPipelineStart: Date.now() - captionPipelineStartedAtMilliseconds,
    });
    return NextResponse.json(
      {
        errorMessage: `この動画から字幕を取得できませんでした。${diagnosticDetailMessage}`,
        bilingualCueList: [],
        resolvedEnglishLanguageCode: null,
        resolvedJapaneseLanguageCode: null,
        japaneseIsYoutubeAutoTranslation: false,
        japaneseIsMachineTranslationFallback: false,
        japaneseMachineTranslationProvider: null,
      },
      { status: 404 },
    );
  }

  let bilingualCueList = buildBilingualTranscriptCueListFromSeparateTracks(
    englishCueList,
    japaneseCueList,
  );

  const bilingualSummaryAfterMerge = summarizeBilingualCueListForCaptionPipelineDebug(
    bilingualCueList,
  );
  logServerYouTubeCaptionPipelineDebug("英日マージ直後（ローカル補完前）", {
    youtubeVideoId,
    ...bilingualSummaryAfterMerge,
  });

  /**
   * 日本語トラックが 1 行も取れない動画では、マージ後の全行が missingJapanese になり、
   * ローカル NLLB が全文を逐次翻訳する。長尺では応答がタイムアウトし英語も返らなくなるため、
   * 既定では NLLB をスキップして英語のみ（欠損日本語のまま）を返す。
   * 全文をローカル翻訳したい場合のみ ENABLE_LOCAL_NLLB_FOR_ENGLISH_ONLY_TRANSCRIPTS を有効にする。
   */
  const isJapaneseTranscriptCueListEmptyAfterYoutubeFetch = japaneseCueList.length === 0;
  const enableLocalNllbForEnglishOnlyTranscriptRaw =
    process.env.ENABLE_LOCAL_NLLB_FOR_ENGLISH_ONLY_TRANSCRIPTS ?? "";
  const isLocalNllbExplicitlyEnabledForEnglishOnlyTranscript =
    enableLocalNllbForEnglishOnlyTranscriptRaw === "true" ||
    enableLocalNllbForEnglishOnlyTranscriptRaw === "1";
  const shouldRunMachineTranslationFillForMissingJapanese =
    !isJapaneseTranscriptCueListEmptyAfterYoutubeFetch ||
    isLocalNllbExplicitlyEnabledForEnglishOnlyTranscript;

  if (
    isJapaneseTranscriptCueListEmptyAfterYoutubeFetch &&
    !isLocalNllbExplicitlyEnabledForEnglishOnlyTranscript
  ) {
    logServerYouTubeCaptionPipelineDebug(
      "ローカル NLLB: 日本語トラック 0 件のため補完をスキップ（英語のみ即時返却。全文翻訳は ENABLE_LOCAL_NLLB_FOR_ENGLISH_ONLY_TRANSCRIPTS）",
      {
        youtubeVideoId,
        bilingualCueCountAfterMerge: bilingualCueList.length,
      },
    );
  }

  /**
   * Cloudflare Workers では onnxruntime-node（.node バイナリ）をバンドルできないため、
   * ローカル NLLB による補完は無効化し、YouTube 由来の字幕のみを返す。
   */
  const machineTranslationFillOutcome = {
    bilingualCueList,
    appliedMachineTranslation: false,
    machineTranslationProviderUsed: null as null | "local_nllb",
  };
  bilingualCueList = machineTranslationFillOutcome.bilingualCueList;

  const bilingualSummaryAfterMachineTranslation =
    summarizeBilingualCueListForCaptionPipelineDebug(bilingualCueList);
  logServerYouTubeCaptionPipelineDebug("ローカル補完後・200 応答直前", {
    youtubeVideoId,
    ...bilingualSummaryAfterMachineTranslation,
    appliedMachineTranslation: machineTranslationFillOutcome.appliedMachineTranslation,
    machineTranslationProviderUsed: machineTranslationFillOutcome.machineTranslationProviderUsed,
    elapsedMillisecondsSinceCaptionPipelineStart: Date.now() - captionPipelineStartedAtMilliseconds,
  });

  const resolvedJapaneseLanguageCodeFromYoutube =
    japaneseFetchResult?.resolvedLanguageCode ?? null;
  const resolvedJapaneseLanguageCode =
    resolvedJapaneseLanguageCodeFromYoutube ??
    (machineTranslationFillOutcome.appliedMachineTranslation ? "ja" : null);

  return NextResponse.json({
    bilingualCueList,
    resolvedEnglishLanguageCode: englishFetchResult?.resolvedLanguageCode ?? null,
    resolvedJapaneseLanguageCode,
    japaneseIsYoutubeAutoTranslation:
      japaneseFetchResult?.isAcquiredViaYoutubeAutoTranslation === true,
    japaneseIsMachineTranslationFallback:
      machineTranslationFillOutcome.appliedMachineTranslation === true,
    japaneseMachineTranslationProvider:
      machineTranslationFillOutcome.machineTranslationProviderUsed,
  });
}

/*
 * ファイル概要: 字幕取得 API
 * 入出力の概要: videoId → bilingual cues JSON
 * 依存関係の一覧: next/server, @/lib/captions/*, @/lib/translation/*
 */
