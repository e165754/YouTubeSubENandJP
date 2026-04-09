/**
 * 目的: クリックされた語の解析結果を右側（または下段）に表示する
 * 主な役割: LLM 応答の整形表示とローディング/エラー表示
 * 他ファイルとの関係: YouTubeLearningWatchPageContent から利用
 */

import type { WordAnalysisResult } from "@/types/youtubeEnglishLearningViewer";

type WordAnalysisSidePanelProperties = {
  readonly selectedHeadword: string | null;
  readonly isAnalysisLoading: boolean;
  readonly analysisErrorMessage: string | null;
  readonly wordAnalysisResult: WordAnalysisResult | null;
};

/**
 * 目的: 単語解析パネルを描画する
 * 入力: 選択語、ロード状態、結果、エラー
 * 出力: React 要素
 * 副作用: なし
 * エラー発生時の挙動: analysisErrorMessage を表示
 */
export function WordAnalysisSidePanel({
  selectedHeadword,
  isAnalysisLoading,
  analysisErrorMessage,
  wordAnalysisResult,
}: WordAnalysisSidePanelProperties) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <h2 className="text-sm font-semibold text-zinc-100">単語・フレーズ解析</h2>
      <p className="mt-1 text-xs text-zinc-500">
        英語字幕の単語をクリックすると、文脈込みで意味・品詞・関連表現を表示します（LLM）。
      </p>
      {!selectedHeadword ? (
        <p className="mt-4 text-sm text-zinc-500">単語をクリックしてください。</p>
      ) : null}
      {selectedHeadword ? (
        <p className="mt-3 text-xs text-zinc-400">
          選択中: <span className="font-semibold text-zinc-100">{selectedHeadword}</span>
        </p>
      ) : null}
      {isAnalysisLoading ? <p className="mt-3 text-sm text-zinc-300">解析中…</p> : null}
      {analysisErrorMessage ? (
        <p className="mt-3 text-sm text-red-300">{analysisErrorMessage}</p>
      ) : null}
      {wordAnalysisResult ? (
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase text-zinc-500">自然な意味（日本語）</dt>
            <dd className="text-zinc-100">{wordAnalysisResult.meaningNaturalJapanese}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-zinc-500">直訳寄り（日本語）</dt>
            <dd className="text-zinc-200">{wordAnalysisResult.meaningLiteralJapanese}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-zinc-500">品詞（英語表記）</dt>
            <dd className="text-zinc-200">{wordAnalysisResult.partOfSpeechEnglish}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-zinc-500">発音（IPA 目安）</dt>
            <dd className="font-mono text-zinc-200">{wordAnalysisResult.pronunciationIpaHint}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-zinc-500">文脈での意味（日本語）</dt>
            <dd className="text-zinc-200">{wordAnalysisResult.contextualMeaningJapanese}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-zinc-500">句動詞・イディオム候補</dt>
            <dd className="text-zinc-200">
              {wordAnalysisResult.relatedPhrasesEnglish.length > 0
                ? wordAnalysisResult.relatedPhrasesEnglish.join(" / ")
                : "（なし）"}
            </dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

/*
 * ファイル概要: 単語解析サイドパネル
 * 入出力の概要: props → UI
 * 依存関係の一覧: @/types/youtubeEnglishLearningViewer
 */
