/**
 * 目的: YouTube Data API v3 を用いて動画検索を行う（サーバー専用）
 * 主な役割: search.list + videos.list で一覧に必要なフィールドを結合
 * 他ファイルとの関係: /api/youtube/search から呼ばれる
 */

import type { YouTubeSearchResultVideoItem } from "@/types/youtubeEnglishLearningViewer";
import { formatIso8601DurationForDisplay } from "@/lib/youtube/formatIso8601DurationForDisplay";

export type YouTubeSearchRequestParameters = {
  readonly searchQueryText: string;
  readonly youtubeDataApiKey: string;
  readonly resultType: "video" | "channel" | "playlist";
  readonly order: "relevance" | "date" | "rating" | "viewCount";
  readonly publishedAfterIso8601: string | null;
  readonly videoDurationFilter: "any" | "short" | "medium" | "long";
  readonly maxResults: number;
  readonly pageToken: string | null;
};

export type YouTubeSearchResponsePayload = {
  readonly videoItemList: YouTubeSearchResultVideoItem[];
  readonly nextPageToken: string | null;
  readonly totalResultEstimate: number | null;
};

/**
 * 目的: キーワードで YouTube を検索し、UI 向けに正規化した結果を返す
 * 入力: YouTubeSearchRequestParameters
 * 出力: YouTubeSearchResponsePayload
 * 副作用: 外部 API へ HTTP リクエスト
 * エラー発生時の挙動: 失敗時は Error を throw（route で 500 化）
 */
export async function searchYouTubeVideos(
  requestParameters: YouTubeSearchRequestParameters,
): Promise<YouTubeSearchResponsePayload> {
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("key", requestParameters.youtubeDataApiKey);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", requestParameters.resultType);
  searchUrl.searchParams.set("q", requestParameters.searchQueryText);
  searchUrl.searchParams.set("order", requestParameters.order);
  searchUrl.searchParams.set("maxResults", String(requestParameters.maxResults));
  if (requestParameters.pageToken) {
    searchUrl.searchParams.set("pageToken", requestParameters.pageToken);
  }
  if (requestParameters.publishedAfterIso8601) {
    searchUrl.searchParams.set("publishedAfter", requestParameters.publishedAfterIso8601);
  }
  if (requestParameters.resultType === "video" && requestParameters.videoDurationFilter !== "any") {
    searchUrl.searchParams.set("videoDuration", requestParameters.videoDurationFilter);
  }

  const searchResponse = await fetch(searchUrl.toString(), { next: { revalidate: 60 } });
  if (!searchResponse.ok) {
    const errorBodyText = await searchResponse.text();
    throw new Error(`YouTube search failed: ${searchResponse.status} ${errorBodyText}`);
  }

  const searchJsonUnknown: unknown = await searchResponse.json();
  const searchJson = searchJsonUnknown as {
    items?: Array<{ id?: { videoId?: string }; snippet?: Record<string, unknown> }>;
    nextPageToken?: string;
    pageInfo?: { totalResults?: number };
  };

  const rawItemList = searchJson.items ?? [];
  if (requestParameters.resultType !== "video") {
    const nonVideoItemList: YouTubeSearchResultVideoItem[] = rawItemList.map((item) => {
      const channelOrPlaylistId =
        (item.id as { channelId?: string; playlistId?: string } | undefined)?.channelId ??
        (item.id as { playlistId?: string } | undefined)?.playlistId ??
        "";
      const snippet = item.snippet ?? {};
      return {
        videoId: channelOrPlaylistId,
        title: String(snippet.title ?? ""),
        channelTitle: String(snippet.channelTitle ?? ""),
        thumbnailUrl: String(
          (snippet.thumbnails as { medium?: { url?: string } } | undefined)?.medium?.url ?? "",
        ),
        publishedAt: String(snippet.publishedAt ?? ""),
        durationIso8601: "",
        descriptionSnippet: String(snippet.description ?? "").slice(0, 220),
      };
    });
    return {
      videoItemList: nonVideoItemList,
      nextPageToken: searchJson.nextPageToken ?? null,
      totalResultEstimate: searchJson.pageInfo?.totalResults ?? null,
    };
  }

  const videoIdList = rawItemList
    .map((item) => item.id?.videoId)
    .filter((videoId): videoId is string => Boolean(videoId));

  if (videoIdList.length === 0) {
    return {
      videoItemList: [],
      nextPageToken: searchJson.nextPageToken ?? null,
      totalResultEstimate: searchJson.pageInfo?.totalResults ?? null,
    };
  }

  const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  videosUrl.searchParams.set("key", requestParameters.youtubeDataApiKey);
  videosUrl.searchParams.set("part", "contentDetails,snippet");
  videosUrl.searchParams.set("id", videoIdList.join(","));

  const videosResponse = await fetch(videosUrl.toString(), { next: { revalidate: 300 } });
  if (!videosResponse.ok) {
    const errorBodyText = await videosResponse.text();
    throw new Error(`YouTube videos failed: ${videosResponse.status} ${errorBodyText}`);
  }

  const videosJsonUnknown: unknown = await videosResponse.json();
  const videosJson = videosJsonUnknown as {
    items?: Array<{
      id?: string;
      contentDetails?: { duration?: string };
      snippet?: Record<string, unknown>;
    }>;
  };

  const videoDetailsById = new Map(
    (videosJson.items ?? []).map((videoItem) => [videoItem.id ?? "", videoItem]),
  );

  const videoItemList: YouTubeSearchResultVideoItem[] = videoIdList.map((videoId) => {
    const details = videoDetailsById.get(videoId);
    const snippet = details?.snippet ?? {};
    const durationIso8601 = details?.contentDetails?.duration ?? "";
    return {
      videoId,
      title: String(snippet.title ?? ""),
      channelTitle: String(snippet.channelTitle ?? ""),
      thumbnailUrl: String(
        (snippet.thumbnails as { medium?: { url?: string } } | undefined)?.medium?.url ?? "",
      ),
      publishedAt: String(snippet.publishedAt ?? ""),
      durationIso8601: formatIso8601DurationForDisplay(durationIso8601),
      descriptionSnippet: String(snippet.description ?? "").slice(0, 220),
    };
  });

  return {
    videoItemList,
    nextPageToken: searchJson.nextPageToken ?? null,
    totalResultEstimate: searchJson.pageInfo?.totalResults ?? null,
  };
}

/*
 * ファイル概要: YouTube Data API 検索クライアント
 * 入出力の概要: 検索パラメータ → 正規化済み一覧
 * 依存関係の一覧: @/types/youtubeEnglishLearningViewer, ./formatIso8601DurationForDisplay
 */
