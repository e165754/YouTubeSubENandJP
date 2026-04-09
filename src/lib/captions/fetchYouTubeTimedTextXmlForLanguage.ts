/**
 * 目的: 指定言語コードで YouTube timedtext を取得する（サーバー側）
 * 主な役割: 公開動画向けの字幕 XML 取得（公式 Captions API の OAuth 代替）
 * 他ファイルとの関係: API route から呼ばれる
 *
 * 注意: 動画・権限により取得できない場合がある（利用規約・ロボット規約に従うこと）
 */

/**
 * 目的: 単一言語の timedtext をフェッチする
 * 入力: youtubeVideoId — 動画ID（string）, languageCode — "en" / "ja" 等（string）
 * 出力: 成功時は XML 文字列、失敗時は null
 * 副作用: 外部ネットワーク fetch を行う
 * エラー発生時の挙動: 例外は投げず null を返す
 */
export async function fetchYouTubeTimedTextXmlForLanguage(
  youtubeVideoId: string,
  languageCode: string,
): Promise<string | null> {
  const timedTextUrl = new URL("https://www.youtube.com/api/timedtext");
  timedTextUrl.searchParams.set("v", youtubeVideoId);
  timedTextUrl.searchParams.set("lang", languageCode);
  timedTextUrl.searchParams.set("fmt", "srv3");

  try {
    const timedTextResponse = await fetch(timedTextUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; YouTubeEnglishLearningViewer/1.0; +https://example.local)",
      },
      next: { revalidate: 3600 },
    });
    if (!timedTextResponse.ok) {
      return null;
    }
    const xmlBody = await timedTextResponse.text();
    if (!xmlBody.includes("<text")) {
      return null;
    }
    return xmlBody;
  } catch {
    return null;
  }
}

/**
 * 目的: よく使う言語コード候補を順に試し、最初に取れた XML を返す
 * 入力: youtubeVideoId, preferredLanguageCodeList — 例: ["en", "en-US"]
 * 出力: { xmlString, resolvedLanguageCode } または null
 * 副作用: ネットワーク（最大で候補回数分）
 * エラー発生時の挙動: すべて失敗なら null
 */
export async function fetchYouTubeTimedTextXmlWithLanguageFallback(
  youtubeVideoId: string,
  preferredLanguageCodeList: readonly string[],
): Promise<{ xmlString: string; resolvedLanguageCode: string } | null> {
  for (const languageCodeCandidate of preferredLanguageCodeList) {
    const xmlString = await fetchYouTubeTimedTextXmlForLanguage(
      youtubeVideoId,
      languageCodeCandidate,
    );
    if (xmlString) {
      return { xmlString, resolvedLanguageCode: languageCodeCandidate };
    }
  }
  return null;
}

/** InnerTube 経路と同版の Android UA（timedtext の tlang 取得で空レスポンスになりにくくする） */
const youTubeTimedTextCaptionAndroidStyleUserAgentString =
  "com.google.android.youtube/20.10.38 (Linux; U; Android 14)";

/**
 * 目的: ソース言語の字幕を基に、YouTube timedtext の `tlang=ja` で日本語自動翻訳 XML を取得する
 * 入力: youtubeVideoId, sourceCaptionLanguageCode — 実際に取れている英語トラックの lang（例 en, en-US）
 * 出力: 成功時は XML と resolvedLanguageCode（"ja"）、失敗時は null
 * 副作用: 外部ネットワーク fetch
 * エラー発生時の挙動: 例外は投げず null
 *
 * 注意: ネイティブ日本語トラックが無い動画向け。品質は YouTube 側の自動翻訳に依存する。
 */
export async function fetchYouTubeTimedTextJapaneseXmlViaYoutubeAutoTranslationParameter(
  youtubeVideoId: string,
  sourceCaptionLanguageCode: string,
): Promise<{ xmlString: string; resolvedLanguageCode: string } | null> {
  const timedTextUrl = new URL("https://www.youtube.com/api/timedtext");
  timedTextUrl.searchParams.set("v", youtubeVideoId);
  timedTextUrl.searchParams.set("lang", sourceCaptionLanguageCode);
  timedTextUrl.searchParams.set("tlang", "ja");
  timedTextUrl.searchParams.set("fmt", "srv3");

  try {
    const timedTextResponse = await fetch(timedTextUrl.toString(), {
      headers: {
        "User-Agent": youTubeTimedTextCaptionAndroidStyleUserAgentString,
      },
      next: { revalidate: 3600 },
    });
    if (!timedTextResponse.ok) {
      return null;
    }
    const xmlBody = await timedTextResponse.text();
    if (!xmlBody.includes("<text") && !xmlBody.includes("<p ")) {
      return null;
    }
    return { xmlString: xmlBody, resolvedLanguageCode: "ja" };
  } catch {
    return null;
  }
}

/*
 * ファイル概要: timedtext フェッチ
 * 入出力の概要: videoId + lang → XML または null
 * 依存関係の一覧: なし（標準 fetch）
 */
