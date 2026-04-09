/**
 * 目的: トップ検索ページのクライアント側状態とデータ取得を束ねる
 * 主な役割: /api/youtube/search 呼び出し、フィルタ状態、ページネーション
 * 他ファイルとの関係: app/page.tsx から描画
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { YouTubeSearchResultVideoItem } from "@/types/youtubeEnglishLearningViewer";
import type { YouTubeSearchResponsePayload } from "@/lib/youtube/searchYouTubeVideos";
import { SearchHeaderBar } from "@/components/search/SearchHeaderBar";
import { FilterSidebarPanel } from "@/components/search/FilterSidebarPanel";
import { VideoSearchResultGrid } from "@/components/search/VideoSearchResultGrid";

/** ホーム検索の初回クエリ（入力欄初期値・マウント時の自動検索と一致させる） */
const defaultYouTubeSearchQueryTextOnHomePage = "TED";

/**
 * 目的: 投稿日プリセットを RFC3339（API用）へ変換する
 * 入力: preset
 * 出力: ISO 文字列または null
 * 副作用: なし
 * エラー発生時の挙動: なし
 */
/**
 * 目的: 検索 API が同一 videoId を複数返すケース（ページ跨ぎ等）を吸収し、一覧を一意化する
 * 入力: videoItemList — 検索結果の動画配列
 * 出力: 先勝ちで重複 videoId を除いた配列
 * 副作用: なし
 * エラー発生時の挙動: なし
 */
function buildVideoSearchResultListWithDuplicateVideoIdsRemoved(
  videoItemList: readonly YouTubeSearchResultVideoItem[],
): YouTubeSearchResultVideoItem[] {
  const alreadySeenVideoIdSet = new Set<string>();
  const deduplicatedVideoItemList: YouTubeSearchResultVideoItem[] = [];
  for (const videoItem of videoItemList) {
    if (alreadySeenVideoIdSet.has(videoItem.videoId)) {
      continue;
    }
    alreadySeenVideoIdSet.add(videoItem.videoId);
    deduplicatedVideoItemList.push(videoItem);
  }
  return deduplicatedVideoItemList;
}

function buildPublishedAfterIso8601FromPreset(
  preset: "any" | "7d" | "30d" | "365d",
): string | null {
  if (preset === "any") {
    return null;
  }
  const nowMilliseconds = Date.now();
  const dayMilliseconds = 24 * 60 * 60 * 1000;
  const offsetDays = preset === "7d" ? 7 : preset === "30d" ? 30 : 365;
  const thresholdDate = new Date(nowMilliseconds - offsetDays * dayMilliseconds);
  return thresholdDate.toISOString();
}

/**
 * 目的: 検索ページ全体を表示するクライアントコンポーネント
 * 入力: なし（URL 連携は未実装、初期クエリは defaultYouTubeSearchQueryTextOnHomePage）
 * 出力: React 要素
 * 副作用: fetch
 * エラー発生時の挙動: 画面にエラーメッセージ
 */
export function YouTubeLearningSearchPageContent() {
  const [searchQueryText, setSearchQueryText] = useState(defaultYouTubeSearchQueryTextOnHomePage);
  const [resultType, setResultType] = useState<"video" | "channel" | "playlist">("video");
  const [order, setOrder] = useState<"relevance" | "date" | "rating" | "viewCount">("relevance");
  const [publishedAfterPreset, setPublishedAfterPreset] = useState<
    "any" | "7d" | "30d" | "365d"
  >("any");
  const [videoDurationFilter, setVideoDurationFilter] = useState<
    "any" | "short" | "medium" | "long"
  >("any");

  const [searchResponsePayload, setSearchResponsePayload] =
    useState<YouTubeSearchResponsePayload | null>(null);
  const [searchErrorMessage, setSearchErrorMessage] = useState<string | null>(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const publishedAfterIso8601 = useMemo(
    () => buildPublishedAfterIso8601FromPreset(publishedAfterPreset),
    [publishedAfterPreset],
  );

  const executeSearchRequest = useCallback(
    async (pageToken: string | null, appendToExistingList: boolean) => {
      setIsSearchLoading(true);
      setSearchErrorMessage(null);
      try {
        const searchParams = new URLSearchParams();
        searchParams.set("q", searchQueryText);
        searchParams.set("type", resultType);
        searchParams.set("order", order);
        searchParams.set("videoDuration", videoDurationFilter);
        if (publishedAfterIso8601) {
          searchParams.set("publishedAfter", publishedAfterIso8601);
        }
        if (pageToken) {
          searchParams.set("pageToken", pageToken);
        }
        const response = await fetch(`/api/youtube/search?${searchParams.toString()}`);
        const responseJsonUnknown: unknown = await response.json();
        if (!response.ok) {
          const errorPayload = responseJsonUnknown as { errorMessage?: string };
          throw new Error(errorPayload.errorMessage ?? "検索に失敗しました。");
        }
        const payload = responseJsonUnknown as YouTubeSearchResponsePayload;
        setNextPageToken(payload.nextPageToken);
        if (appendToExistingList) {
          setSearchResponsePayload((previousPayload) => {
            if (!previousPayload) {
              return {
                ...payload,
                videoItemList: buildVideoSearchResultListWithDuplicateVideoIdsRemoved(
                  payload.videoItemList,
                ),
              };
            }
            const existingVideoIdSet = new Set(
              previousPayload.videoItemList.map((videoItem) => videoItem.videoId),
            );
            const appendedVideoItemList = payload.videoItemList.filter(
              (videoItem) => !existingVideoIdSet.has(videoItem.videoId),
            );
            return {
              ...payload,
              videoItemList: [
                ...previousPayload.videoItemList,
                ...appendedVideoItemList,
              ],
            };
          });
        } else {
          setSearchResponsePayload({
            ...payload,
            videoItemList: buildVideoSearchResultListWithDuplicateVideoIdsRemoved(
              payload.videoItemList,
            ),
          });
        }
      } catch (unknownError) {
        const message =
          unknownError instanceof Error ? unknownError.message : "検索に失敗しました。";
        setSearchErrorMessage(message);
      } finally {
        setIsSearchLoading(false);
      }
    },
    [order, publishedAfterIso8601, resultType, searchQueryText, videoDurationFilter],
  );

  const executeSearchRequestReference = useRef(executeSearchRequest);
  executeSearchRequestReference.current = executeSearchRequest;

  useEffect(() => {
    void executeSearchRequestReference.current(null, false);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <SearchHeaderBar
        searchQueryText={searchQueryText}
        onSearchQueryTextChange={setSearchQueryText}
        isSearchLoading={isSearchLoading}
        onSubmitSearch={() => {
          void executeSearchRequest(null, false);
        }}
      />
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
        <FilterSidebarPanel
          resultType={resultType}
          onResultTypeChange={(next) => {
            setResultType(next);
          }}
          order={order}
          onOrderChange={setOrder}
          publishedAfterPreset={publishedAfterPreset}
          onPublishedAfterPresetChange={setPublishedAfterPreset}
          videoDurationFilter={videoDurationFilter}
          onVideoDurationFilterChange={setVideoDurationFilter}
        />
        <main className="min-w-0 flex-1 space-y-4">
          {searchErrorMessage ? (
            <div className="rounded-lg border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
              {searchErrorMessage}
            </div>
          ) : null}
          <VideoSearchResultGrid
            videoItemList={searchResponsePayload?.videoItemList ?? []}
            resultType={resultType}
          />
          {nextPageToken ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={isSearchLoading}
                onClick={() => {
                  void executeSearchRequest(nextPageToken, true);
                }}
                className="rounded-full border border-zinc-700 px-6 py-2 text-sm text-zinc-200 hover:border-red-600 disabled:opacity-50"
              >
                さらに読み込む
              </button>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

/*
 * ファイル概要: 検索ページのクライアントコンテナ
 * 入出力の概要: ユーザー操作 → API → 一覧表示
 * 依存関係の一覧: React, 子コンポーネント, @/lib/youtube/searchYouTubeVideos（型のみ）
 */
