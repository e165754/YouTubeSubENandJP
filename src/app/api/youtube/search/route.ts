/**
 * 目的: クライアントから安全に YouTube 検索を呼ぶための API 境界
 * 主な役割: API キーをサーバーに閉じ、クエリを検証して searchYouTubeVideos を実行
 * 他ファイルとの関係: 検索ページの fetch 先
 */

import { NextResponse } from "next/server";
import { searchYouTubeVideos } from "@/lib/youtube/searchYouTubeVideos";

/**
 * 目的: GET で検索クエリとフィルタを受け取り JSON を返す
 * 入力: URL の searchParams
 * 出力: NextResponse JSON
 * 副作用: 外部 YouTube API
 * エラー発生時の挙動: 400/500 とメッセージ
 */
export async function GET(request: Request): Promise<NextResponse> {
  const youtubeDataApiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!youtubeDataApiKey) {
    return NextResponse.json(
      { errorMessage: "YOUTUBE_DATA_API_KEY が未設定です。.env.local を確認してください。" },
      { status: 500 },
    );
  }

  const requestUrl = new URL(request.url);
  const searchQueryText = (requestUrl.searchParams.get("q") ?? "").trim();
  if (searchQueryText.length < 2) {
    return NextResponse.json({ errorMessage: "検索語は2文字以上にしてください。" }, { status: 400 });
  }

  const resultTypeRaw = requestUrl.searchParams.get("type") ?? "video";
  const resultType =
    resultTypeRaw === "channel" || resultTypeRaw === "playlist" ? resultTypeRaw : "video";

  const orderRaw = requestUrl.searchParams.get("order") ?? "relevance";
  const order =
    orderRaw === "date" || orderRaw === "rating" || orderRaw === "viewCount"
      ? orderRaw
      : "relevance";

  const publishedAfterRaw = requestUrl.searchParams.get("publishedAfter");
  const publishedAfterIso8601 =
    publishedAfterRaw && publishedAfterRaw.length > 4 ? publishedAfterRaw : null;

  const videoDurationRaw = requestUrl.searchParams.get("videoDuration") ?? "any";
  const videoDurationFilter =
    videoDurationRaw === "short" || videoDurationRaw === "medium" || videoDurationRaw === "long"
      ? videoDurationRaw
      : "any";

  const pageToken = requestUrl.searchParams.get("pageToken");

  const maxResultsRaw = Number.parseInt(requestUrl.searchParams.get("maxResults") ?? "12", 10);
  const maxResults = Number.isFinite(maxResultsRaw)
    ? Math.min(Math.max(maxResultsRaw, 1), 25)
    : 12;

  try {
    const searchResponsePayload = await searchYouTubeVideos({
      searchQueryText,
      youtubeDataApiKey,
      resultType,
      order,
      publishedAfterIso8601,
      videoDurationFilter,
      maxResults,
      pageToken,
    });
    return NextResponse.json(searchResponsePayload);
  } catch (unknownError) {
    const message =
      unknownError instanceof Error ? unknownError.message : "検索に失敗しました。";
    return NextResponse.json({ errorMessage: message }, { status: 502 });
  }
}

/*
 * ファイル概要: YouTube 検索 API ルート
 * 入出力の概要: GET query → JSON
 * 依存関係の一覧: next/server, @/lib/youtube/searchYouTubeVideos
 */
