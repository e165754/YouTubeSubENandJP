/**
 * 目的: アプリの入口（YouTubeライク検索）を表示する
 * 主な役割: 検索クライアントコンポーネントのマウント
 * 他ファイルとの関係: YouTubeLearningSearchPageContent を描画
 */

import { YouTubeLearningSearchPageContent } from "@/components/search/YouTubeLearningSearchPageContent";

/**
 * 目的: トップページを返す
 * 入力: なし
 * 出力: React 要素
 * 副作用: なし
 * エラー発生時の挙動: なし
 */
export default function HomePage() {
  return <YouTubeLearningSearchPageContent />;
}

/*
 * ファイル概要: / ルートページ
 * 入出力の概要: なし → 検索 UI
 * 依存関係の一覧: @/components/search/YouTubeLearningSearchPageContent
 */
