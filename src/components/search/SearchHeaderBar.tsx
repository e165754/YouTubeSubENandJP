/**
 * 目的: 画面上部の検索バーとブランド表示を担う
 * 主な役割: クエリ入力と検索実行（submit）
 * 他ファイルとの関係: YouTubeLearningSearchPageContent から利用
 */

type SearchHeaderBarProperties = {
  readonly searchQueryText: string;
  readonly onSearchQueryTextChange: (nextQueryText: string) => void;
  readonly onSubmitSearch: () => void;
  readonly isSearchLoading: boolean;
};

/**
 * 目的: ヘッダー検索 UI を描画する
 * 入力: クエリ文字列、ローディング、ハンドラ
 * 出力: React 要素
 * 副作用: なし
 * エラー発生時の挙動: なし
 */
export function SearchHeaderBar({
  searchQueryText,
  onSearchQueryTextChange,
  onSubmitSearch,
  isSearchLoading,
}: SearchHeaderBarProperties) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-red-600 px-2 py-1 text-xs font-bold text-white">Learn</span>
          <div>
            <p className="text-sm font-semibold text-zinc-100">YouTube英語学習ビュワー</p>
            <p className="text-xs text-zinc-500">検索 → 再生 → 字幕 → 単語</p>
          </div>
        </div>
        <form
          className="flex w-full max-w-2xl gap-2 sm:justify-end"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            onSubmitSearch();
          }}
        >
          <input
            value={searchQueryText}
            onChange={(changeEvent) => onSearchQueryTextChange(changeEvent.target.value)}
            placeholder="キーワードで検索（英語学習、TED、ニュース など）"
            className="flex-1 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-red-600 focus:outline-none"
            aria-label="検索キーワード"
          />
          <button
            type="submit"
            disabled={isSearchLoading}
            className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSearchLoading ? "検索中…" : "検索"}
          </button>
        </form>
      </div>
    </header>
  );
}

/*
 * ファイル概要: 検索ヘッダー
 * 入出力の概要: props → UI
 * 依存関係の一覧: なし
 */
