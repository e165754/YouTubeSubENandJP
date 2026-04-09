/**
 * 目的: YouTube IFrame API が window に追加するコールバック名を型に載せる
 * 主な役割: TypeScript の Window 型拡張
 * 他ファイルとの関係: YouTubeIframePlayer から参照されるグローバル契約
 */

export {};

declare global {
  interface Window {
    /**
     * YouTube IFrame API の読み込み完了時に呼ばれるグローバルフック
     * 注意: 複数コンポーネントで上書きしないよう連結が必要（実装側の責務）
     */
    onYouTubeIframeAPIReady?: () => void;
  }
}

/*
 * ファイル概要: Window 型拡張（YouTube IFrame API）
 * 入出力の概要: 型のみ
 * 依存関係の一覧: なし
 */
