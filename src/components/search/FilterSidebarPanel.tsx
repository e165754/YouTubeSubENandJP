/**
 * 目的: 検索条件（種別・並び・期間・長さ）をまとめて操作するサイドパネル
 * 主な役割: YouTube Data API の対応パラメータにマッピング可能な UI
 * 他ファイルとの関係: YouTubeLearningSearchPageContent と双方向バインド
 */

type FilterSidebarPanelProperties = {
  readonly resultType: "video" | "channel" | "playlist";
  readonly onResultTypeChange: (nextResultType: "video" | "channel" | "playlist") => void;
  readonly order: "relevance" | "date" | "rating" | "viewCount";
  readonly onOrderChange: (nextOrder: "relevance" | "date" | "rating" | "viewCount") => void;
  readonly publishedAfterPreset: "any" | "7d" | "30d" | "365d";
  readonly onPublishedAfterPresetChange: (
    nextPreset: "any" | "7d" | "30d" | "365d",
  ) => void;
  readonly videoDurationFilter: "any" | "short" | "medium" | "long";
  readonly onVideoDurationFilterChange: (
    nextDuration: "any" | "short" | "medium" | "long",
  ) => void;
};

/**
 * 目的: フィルタ UI を描画し変更を親へ通知する
 * 入力: 現在値と onChange 群
 * 出力: React 要素
 * 副作用: なし（イベントは親へ委譲）
 * エラー発生時の挙動: なし
 */
export function FilterSidebarPanel({
  resultType,
  onResultTypeChange,
  order,
  onOrderChange,
  publishedAfterPreset,
  onPublishedAfterPresetChange,
  videoDurationFilter,
  onVideoDurationFilterChange,
}: FilterSidebarPanelProperties) {
  return (
    <aside className="w-full shrink-0 space-y-6 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 lg:w-64">
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          種別
        </h2>
        <div className="flex flex-col gap-2 text-sm">
          {(
            [
              { value: "video" as const, label: "動画" },
              { value: "channel" as const, label: "チャンネル" },
              { value: "playlist" as const, label: "再生リスト" },
            ] as const
          ).map((optionItem) => (
            <label
              key={optionItem.value}
              className="flex cursor-pointer items-center gap-2 text-zinc-200"
            >
              <input
                type="radio"
                name="resultType"
                checked={resultType === optionItem.value}
                onChange={() => onResultTypeChange(optionItem.value)}
                className="accent-red-600"
              />
              {optionItem.label}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          並び順
        </h2>
        <select
          value={order}
          onChange={(changeEvent) =>
            onOrderChange(changeEvent.target.value as typeof order)
          }
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
        >
          <option value="relevance">関連度</option>
          <option value="date">投稿日</option>
          <option value="rating">評価</option>
          <option value="viewCount">再生回数</option>
        </select>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          投稿日（以降）
        </h2>
        <select
          value={publishedAfterPreset}
          onChange={(changeEvent) =>
            onPublishedAfterPresetChange(changeEvent.target.value as typeof publishedAfterPreset)
          }
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
        >
          <option value="any">指定なし</option>
          <option value="7d">過去7日</option>
          <option value="30d">過去30日</option>
          <option value="365d">過去1年</option>
        </select>
      </section>

      {resultType === "video" ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            動画の長さ
          </h2>
          <select
            value={videoDurationFilter}
            onChange={(changeEvent) =>
              onVideoDurationFilterChange(changeEvent.target.value as typeof videoDurationFilter)
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
          >
            <option value="any">指定なし</option>
            <option value="short">短い（4分未満）</option>
            <option value="medium">中（4〜20分）</option>
            <option value="long">長い（20分超）</option>
          </select>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-zinc-500">
        将来拡張: 字幕あり / 英語字幕 / 日本語字幕 / 学習ラベル は Data API
        単体では安定取得が難しいため、別途インデックス設計が必要です。
      </p>
    </aside>
  );
}

/*
 * ファイル概要: 検索フィルタサイドバー
 * 入出力の概要: 状態は親、変更はコールバック
 * 依存関係の一覧: なし（React のみ）
 */
