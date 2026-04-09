/**
 * 目的: 視聴ページに埋め込まれた ytInitialPlayerResponse から字幕トラック baseUrl を得て XML を取得する
 * 主な役割: `/api/timedtext` への素のクエリが失敗する環境でも、公式プレイヤーと同様の URL で字幕を取る
 * 他ファイルとの関係: captions API ルートから優先的に呼ばれる
 *
 * 注意: YouTube の HTML 構造変更で壊れる可能性がある。利用規約・ロボット規約に従うこと。
 */

import { extractBalancedJsonObjectSubstring } from "@/lib/captions/extractBalancedJsonObjectSubstring";

type YouTubeCaptionTrackFromPlayerResponse = {
  readonly baseUrl: string;
  readonly languageCode: string;
  readonly kind?: string;
};

type YtInitialPlayerResponseUnknown = {
  readonly captions?: {
    readonly playerCaptionsTracklistRenderer?: {
      readonly captionTracks?: unknown;
    };
  };
};

const browserLikeFetchHeaders: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,ja;q=0.8",
};

/**
 * 目的: 視聴ページ HTML を取得する
 * 入力: youtubeVideoId
 * 出力: HTML 文字列、失敗時 null
 * 副作用: ネットワーク fetch
 * エラー発生時の挙動: null
 */
async function fetchYouTubeWatchPageHtmlString(
  youtubeVideoId: string,
): Promise<string | null> {
  const watchPageUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeVideoId)}`;
  try {
    const watchPageResponse = await fetch(watchPageUrl, {
      headers: browserLikeFetchHeaders,
      cache: "no-store",
    });
    if (!watchPageResponse.ok) {
      return null;
    }
    return await watchPageResponse.text();
  } catch {
    return null;
  }
}

/**
 * 目的: HTML 内のすべての ytInitialPlayerResponse 代入をパースし、字幕トラック数が最大のものを選ぶ
 * 入力: watchPageHtmlString
 * 出力: 最も字幕情報が豊富なパース済みオブジェクト、失敗時 null
 * 副作用: なし
 * エラー発生時の挙動: null
 *
 * 注意: 同一ページに「軽量な先頭オブジェクト」と「captionTracks 付きの後続オブジェクト」が並ぶことがある。
 */
function parseYtInitialPlayerResponseUnknownWithMostCaptionTracksFromWatchPageHtml(
  watchPageHtmlString: string,
): YtInitialPlayerResponseUnknown | null {
  const assignmentPattern = /ytInitialPlayerResponse\s*=\s*/g;
  let regexMatch: RegExpExecArray | null;
  let bestPlayerResponseCandidate: YtInitialPlayerResponseUnknown | null = null;
  let bestCaptionTrackCount = 0;

  while ((regexMatch = assignmentPattern.exec(watchPageHtmlString)) !== null) {
    const braceStartIndex = watchPageHtmlString.indexOf(
      "{",
      regexMatch.index + regexMatch[0].length,
    );
    if (braceStartIndex === -1) {
      continue;
    }
    const jsonObjectSubstring = extractBalancedJsonObjectSubstring(
      watchPageHtmlString,
      braceStartIndex,
    );
    if (!jsonObjectSubstring) {
      continue;
    }
    try {
      const parsedPlayerResponse = JSON.parse(jsonObjectSubstring) as YtInitialPlayerResponseUnknown;
      const captionTracksUnknown =
        parsedPlayerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      const captionTrackCount = buildCaptionTrackListFromUnknown(captionTracksUnknown).length;
      if (captionTrackCount > bestCaptionTrackCount) {
        bestCaptionTrackCount = captionTrackCount;
        bestPlayerResponseCandidate = parsedPlayerResponse;
      }
    } catch {
      continue;
    }
  }

  return bestPlayerResponseCandidate;
}

/**
 * 目的: unknown を字幕トラック配列へ正規化する
 * 入力: captionTracksUnknown
 * 出力: 検証済みトラック配列
 * 副作用: なし
 */
function buildCaptionTrackListFromUnknown(
  captionTracksUnknown: unknown,
): YouTubeCaptionTrackFromPlayerResponse[] {
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
 * 目的: 言語候補に合致する最適なトラックを1つ選ぶ（手動字幕を ASR より優先）
 * 入力: captionTrackList, preferredLanguageCodeList（先頭ほど優先）
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
 * 目的: プレイヤー応答の baseUrl を絶対 URL に正規化する（// 相対・パス相対に対応）
 * 入力: trackBaseUrl
 * 出力: https で始まる URL 文字列
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
 * 目的: baseUrl から srv3 XML を取得する（fmt は常に srv3 に揃え、json3 既定を上書きする）
 * 入力: trackBaseUrl
 * 出力: XML 文字列、失敗時 null
 * 副作用: fetch
 */
async function fetchCaptionXmlStringFromTrackBaseUrl(
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
      headers: browserLikeFetchHeaders,
      cache: "no-store",
    });
    if (!captionResponse.ok) {
      return null;
    }
    const responseBodyText = await captionResponse.text();
    if (!responseBodyText.includes("<text") && !responseBodyText.includes("<p ")) {
      return null;
    }
    return responseBodyText;
  } catch {
    return null;
  }
}

export type CaptionXmlFetchResult = {
  readonly xmlString: string;
  readonly resolvedLanguageCode: string;
  /** true のとき、ネイティブの日本語トラックではなく baseUrl に `tlang` を付けた YouTube 側の自動翻訳 */
  readonly isAcquiredViaYoutubeAutoTranslation?: boolean;
};

/**
 * 目的: 動画 ID から英語・日本語の字幕 XML を可能な範囲で取得する（プレイヤーレスポンス経由）
 * 入力: youtubeVideoId, 言語フォールバック配列
 * 出力: 各言語の XML または null
 * 副作用: YouTube への複数回 fetch
 * エラー発生時の挙動: 部分的成功を許容（英のみ等）
 */
export async function fetchEnglishAndJapaneseCaptionXmlUsingWatchPagePlayerResponse(input: {
  readonly youtubeVideoId: string;
  readonly englishLanguageFallbackCodeList: readonly string[];
  readonly japaneseLanguageFallbackCodeList: readonly string[];
}): Promise<{
  readonly englishFetchResult: CaptionXmlFetchResult | null;
  readonly japaneseFetchResult: CaptionXmlFetchResult | null;
  readonly playerResponseDiagnosticMessage: string | null;
}> {
  const watchPageHtmlString = await fetchYouTubeWatchPageHtmlString(input.youtubeVideoId);
  if (!watchPageHtmlString) {
    return {
      englishFetchResult: null,
      japaneseFetchResult: null,
      playerResponseDiagnosticMessage: "視聴ページ HTML の取得に失敗しました。",
    };
  }

  const playerResponseUnknown =
    parseYtInitialPlayerResponseUnknownWithMostCaptionTracksFromWatchPageHtml(
      watchPageHtmlString,
    );
  if (!playerResponseUnknown) {
    const looksLikeConsent = watchPageHtmlString.includes("consent.youtube.com");
    return {
      englishFetchResult: null,
      japaneseFetchResult: null,
      playerResponseDiagnosticMessage: looksLikeConsent
        ? "同意画面（consent）が返り、プレイヤー情報を解析できませんでした。サーバー所在地や Cookie 要件の影響の可能性があります。"
        : "ytInitialPlayerResponse を HTML から解析できませんでした（ページ構造の変更の可能性）。",
    };
  }

  const captionTracksUnknown =
    playerResponseUnknown.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  const captionTrackList = buildCaptionTrackListFromUnknown(captionTracksUnknown);

  if (captionTrackList.length === 0) {
    return {
      englishFetchResult: null,
      japaneseFetchResult: null,
      playerResponseDiagnosticMessage:
        "この動画に利用可能な字幕トラックがプレイヤー応答に含まれていません（投稿者が字幕を無効化している等）。",
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
    ? await fetchCaptionXmlStringFromTrackBaseUrl(englishCaptionTrack.baseUrl)
    : null;
  let japaneseXmlString = japaneseCaptionTrack
    ? await fetchCaptionXmlStringFromTrackBaseUrl(japaneseCaptionTrack.baseUrl)
    : null;
  let japaneseResolvedLanguageCode: string | null = japaneseCaptionTrack?.languageCode ?? null;
  let japaneseIsYoutubeAutoTranslation = false;

  if (!japaneseXmlString && englishCaptionTrack) {
    const autoTranslatedJapaneseXmlString = await fetchCaptionXmlStringFromTrackBaseUrl(
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
    playerResponseDiagnosticMessage: null,
  };
}

/*
 * ファイル概要: プレイヤーレスポンス経由の字幕取得
 * 入出力の概要: videoId → XML（英日）
 * 依存関係の一覧: ./extractBalancedJsonObjectSubstring
 */
