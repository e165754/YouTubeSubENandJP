/**
 * 目的: 検索結果の動画カードをグリッド表示する
 * 主な役割: サムネ・タイトル・チャンネル・日付・長さの一覧 UI
 * 他ファイルとの関係: YouTubeLearningSearchPageContent から利用
 */

import Image from "next/image";
import Link from "next/link";
import type { YouTubeSearchResultVideoItem } from "@/types/youtubeEnglishLearningViewer";

type VideoSearchResultGridProperties = {
  readonly videoItemList: readonly YouTubeSearchResultVideoItem[];
  readonly resultType: "video" | "channel" | "playlist";
};

/**
 * 目的: 検索結果をカードグリッドとして描画する
 * 入力: videoItemList, resultType
 * 出力: React 要素
 * 副作用: なし（描画のみ）
 * エラー発生時の挙動: 空配列なら案内文
 */
export function VideoSearchResultGrid({
  videoItemList,
  resultType,
}: VideoSearchResultGridProperties) {
  if (videoItemList.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-10 text-center text-sm text-zinc-400">
        該当する結果がありません。条件を変えて試してください。
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {videoItemList.map((videoItem, listPositionIndex) => {
        const hrefForNavigation =
          resultType === "video"
            ? `/watch/${videoItem.videoId}`
            : resultType === "channel"
              ? `https://www.youtube.com/channel/${videoItem.videoId}`
              : `https://www.youtube.com/playlist?list=${videoItem.videoId}`;

        const isExternalLink = resultType !== "video";

        const cardInner = (
          <>
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-zinc-900">
              {videoItem.thumbnailUrl ? (
                <Image
                  src={videoItem.thumbnailUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              ) : null}
              {resultType === "video" && videoItem.durationIso8601 ? (
                <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-xs text-white">
                  {videoItem.durationIso8601}
                </span>
              ) : null}
            </div>
            <div className="space-y-1 pt-2">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-100">
                {videoItem.title}
              </h3>
              <p className="text-xs text-zinc-400">{videoItem.channelTitle}</p>
              <p className="text-xs text-zinc-500">
                {videoItem.publishedAt
                  ? new Date(videoItem.publishedAt).toLocaleDateString("ja-JP")
                  : ""}
              </p>
              {videoItem.descriptionSnippet ? (
                <p className="line-clamp-2 text-xs text-zinc-500">{videoItem.descriptionSnippet}</p>
              ) : null}
            </div>
          </>
        );

        const sharedClassName =
          "block rounded-xl border border-zinc-800 bg-zinc-950/30 p-2 transition hover:border-red-600/50 hover:bg-zinc-900/40";

        const reactListItemKey = `${listPositionIndex}-${videoItem.videoId}`;

        if (isExternalLink) {
          return (
            <a
              key={reactListItemKey}
              href={hrefForNavigation}
              target="_blank"
              rel="noreferrer"
              className={sharedClassName}
            >
              {cardInner}
            </a>
          );
        }

        return (
          <Link key={reactListItemKey} href={hrefForNavigation} className={sharedClassName}>
            {cardInner}
          </Link>
        );
      })}
    </div>
  );
}

/*
 * ファイル概要: 検索結果グリッド
 * 入出力の概要: props → UI
 * 依存関係の一覧: next/image, next/link, @/types/youtubeEnglishLearningViewer
 */
