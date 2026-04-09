/**
 * 目的: InnerTube の player エンドポイント（ANDROID クライアント）で字幕トラックを取得し、本文 XML を取る
 * 主な役割: Web 視聴ページ由来の署名付き baseUrl がサーバー fetch で空になる問題の回避
 * 他ファイルとの関係: captions API が watch ページ取得より先に呼ぶ
 *
 * 注意: InnerTube の仕様は変更されうる。利用規約に従うこと。
 */

import type { CaptionXmlFetchResult } from "@/lib/captions/fetchYouTubeCaptionXmlViaWatchPagePlayerResponse";

const innerTubePlayerPostEndpointUrl =
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

/** ANDROID クライアントの版（取得失敗時は youtube-transcript 等の更新値を参考に更新） */
const androidYouTubeInnerTubeClientVersion = "20.10.38";

const androidYouTubeHttpUserAgentString = `com.google.android.youtube/${androidYouTubeInnerTubeClientVersion} (Linux; U; Android 14)`;

type YouTubeCaptionTrackFromPlayerResponse = {
  readonly baseUrl: string;
  readonly languageCode: string;
  readonly kind?: string;
};

/**
 * 目的: baseUrl を https 絶対 URL にする
 * 入力: trackBaseUrl
 * 出力: URL 文字列
 * 副作用: なし
 */
function normalizeCaptionTrackBaseUrlToHttpsAbsoluteUrl(trackBaseUrl: string): string {
  const trimmedBaseUrl = trackBaseUrl.trim();
  if (trimmedBaseUrl.startsWith("//")) {
    return `https:${trimmedBaseUrl}`;
  }
  if (trimmedBaseUrl.startsWith("http://") || trimmedBaseUrl.startsWith("https://")) {
    return trimmedBaseUrl;
  }
  return new URL(trimmedBaseUrl, "https://www.youtube.com").toString();
}

/**
 * 目的: player JSON の captionTracks を検証済み配列へ変換する
 * 入力: captionTracksUnknown
 * 出力: トラック配列
 * 副作用: なし
 */
function buildCaptionTrackListFromUnknown(captionTracksUnknown: unknown): YouTubeCaptionTrackFromPlayerResponse[] {
  if (!Array.isArray(captionTracksUnknown)) {
    return [];
  }
  const validatedTrackList: YouTubeCaptionTrackFromPlayerResponse[] = [];
  for (const trackUnknown of captionTracksUnknown) {
    if (!trackUnknown || typeof trackUnknown !== "object") {
      continue;
    }
    const trackRecord = trackUnknown as Record<string, unknown>;
    const baseUrl = trackRecord.baseUrl;
    const languageCode = trackRecord.languageCode;
    if (typeof baseUrl !== "string" || typeof languageCode !== "string") {
      continue;
    }
    const kind = trackRecord.kind;
    validatedTrackList.push({
      baseUrl,
      languageCode,
      kind: typeof kind === "string" ? kind : undefined,
    });
  }
  return validatedTrackList;
}

/**
 * 目的: 言語候補に合致するトラックを1つ選ぶ
 * 入力: captionTrackList, preferredLanguageCodeList
 * 出力: トラックまたは null
 * 副作用: なし
 */
function selectCaptionTrackForPreferredLanguageList(
  captionTrackList: readonly YouTubeCaptionTrackFromPlayerResponse[],
  preferredLanguageCodeList: readonly string[],
): YouTubeCaptionTrackFromPlayerResponse | null {
  for (const preferredLanguageCode of preferredLanguageCodeList) {
    const normalizedPreferred = preferredLanguageCode.toLowerCase();
    const matchingTrackList = captionTrackList.filter((captionTrack) => {
      const trackLanguageLower = captionTrack.languageCode.toLowerCase();
      return (
        trackLanguageLower === normalizedPreferred ||
        trackLanguageLower.startsWith(`${normalizedPreferred}-`)
      );
    });
    if (matchingTrackList.length === 0) {
      continue;
    }
    const manualCaptionTrack = matchingTrackList.find((captionTrack) => captionTrack.kind !== "asr");
    return manualCaptionTrack ?? matchingTrackList[0];
  }
  return null;
}

/**
 * 目的: 字幕トラック baseUrl を Android クライアントとして取得する（fmt=srv3）
 * 入力: trackBaseUrl
 * 出力: XML 文字列、失敗時 null
 * 副作用: fetch
 */
async function fetchCaptionXmlStringFromTrackBaseUrlWithAndroidYouTubeClient(
  trackBaseUrl: string,
  options?: { readonly targetTranslationLanguageCode?: string },
): Promise<string | null> {
  const captionRequestUrl = new URL(normalizeCaptionTrackBaseUrlToHttpsAbsoluteUrl(trackBaseUrl));
  captionRequestUrl.searchParams.set("fmt", "srv3");
  if (options?.targetTranslationLanguageCode) {
    captionRequestUrl.searchParams.set("tlang", options.targetTranslationLanguageCode);
  }
  try {
    const captionResponse = await fetch(captionRequestUrl.toString(), {
      headers: {
        "User-Agent": androidYouTubeHttpUserAgentString,
      },
      cache: "no-store",
    });
    if (!captionResponse.ok) {
      return null;
    }
    const responseBodyText = await captionResponse.text();
    if (responseBodyText.length < 10) {
      return null;
    }
    if (!responseBodyText.includes("<text") && !responseBodyText.includes("<p ")) {
      return null;
    }
    return responseBodyText;
  } catch {
    return null;
  }
}

/**
 * 目的: InnerTube player に POST し、英日字幕 XML を可能な範囲で取得する
 * 入力: youtubeVideoId, 言語フォールバック配列
 * 出力: 各言語の結果と診断メッセージ
 * 副作用: 外部 fetch（1〜3 回程度）
 * エラー発生時の挙動: null を返して呼び出し側でフォールバック
 */
export async function fetchEnglishAndJapaneseCaptionXmlViaInnerTubePlayerApi(input: {
  readonly youtubeVideoId: string;
  readonly englishLanguageFallbackCodeList: readonly string[];
  readonly japaneseLanguageFallbackCodeList: readonly string[];
}): Promise<{
  readonly englishFetchResult: CaptionXmlFetchResult | null;
  readonly japaneseFetchResult: CaptionXmlFetchResult | null;
  readonly innerTubeDiagnosticMessage: string | null;
}> {
  try {
    const playerPostResponse = await fetch(innerTubePlayerPostEndpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": androidYouTubeHttpUserAgentString,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: androidYouTubeInnerTubeClientVersion,
          },
        },
        videoId: input.youtubeVideoId,
      }),
      cache: "no-store",
    });
    if (!playerPostResponse.ok) {
      return {
        englishFetchResult: null,
        japaneseFetchResult: null,
        innerTubeDiagnosticMessage: `InnerTube player が ${playerPostResponse.status} を返しました。`,
      };
    }
    const playerJsonUnknown: unknown = await playerPostResponse.json();
    const playerJson = playerJsonUnknown as {
      captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: unknown } };
    };
    const captionTrackList = buildCaptionTrackListFromUnknown(
      playerJson.captions?.playerCaptionsTracklistRenderer?.captionTracks,
    );
    if (captionTrackList.length === 0) {
      return {
        englishFetchResult: null,
        japaneseFetchResult: null,
        innerTubeDiagnosticMessage:
          "InnerTube player 応答に字幕トラックが含まれていませんでした。",
      };
    }

    const englishCaptionTrack = selectCaptionTrackForPreferredLanguageList(
      captionTrackList,
      input.englishLanguageFallbackCodeList,
    );
    const japaneseCaptionTrack = selectCaptionTrackForPreferredLanguageList(
      captionTrackList,
      input.japaneseLanguageFallbackCodeList,
    );

    const englishXmlString = englishCaptionTrack
      ? await fetchCaptionXmlStringFromTrackBaseUrlWithAndroidYouTubeClient(englishCaptionTrack.baseUrl)
      : null;
    let japaneseXmlString = japaneseCaptionTrack
      ? await fetchCaptionXmlStringFromTrackBaseUrlWithAndroidYouTubeClient(japaneseCaptionTrack.baseUrl)
      : null;
    let japaneseResolvedLanguageCode: string | null = japaneseCaptionTrack?.languageCode ?? null;
    let japaneseIsYoutubeAutoTranslation = false;

    if (!japaneseXmlString && englishCaptionTrack) {
      const autoTranslatedJapaneseXmlString =
        await fetchCaptionXmlStringFromTrackBaseUrlWithAndroidYouTubeClient(
          englishCaptionTrack.baseUrl,
          { targetTranslationLanguageCode: "ja" },
        );
      if (autoTranslatedJapaneseXmlString) {
        japaneseXmlString = autoTranslatedJapaneseXmlString;
        japaneseResolvedLanguageCode = "ja";
        japaneseIsYoutubeAutoTranslation = true;
      }
    }

    return {
      englishFetchResult:
        englishXmlString && englishCaptionTrack
          ? { xmlString: englishXmlString, resolvedLanguageCode: englishCaptionTrack.languageCode }
          : null,
      japaneseFetchResult:
        japaneseXmlString && japaneseResolvedLanguageCode
          ? {
              xmlString: japaneseXmlString,
              resolvedLanguageCode: japaneseResolvedLanguageCode,
              isAcquiredViaYoutubeAutoTranslation: japaneseIsYoutubeAutoTranslation ? true : undefined,
            }
          : null,
      innerTubeDiagnosticMessage: null,
    };
  } catch {
    return {
      englishFetchResult: null,
      japaneseFetchResult: null,
      innerTubeDiagnosticMessage: "InnerTube player へのリクエスト中に例外が発生しました。",
    };
  }
}

/*
 * ファイル概要: InnerTube（ANDROID）経由の字幕取得
 * 入出力の概要: videoId → 英日 XML
 * 依存関係の一覧: ./fetchYouTubeCaptionXmlViaWatchPagePlayerResponse（型のみ）
 */
