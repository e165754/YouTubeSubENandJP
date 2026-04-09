/**
 * 目的: プレイヤー下に英日字幕を大きく表示し、現在行を強調する
 * 主な役割: 表示モード（英のみ/日のみ/両方）と学習用の日本語非表示
 * 他ファイルとの関係: YouTubeLearningWatchPageContent から利用
 */

import type { ReactNode } from "react";
import type { BilingualTranscriptCue } from "@/types/youtubeEnglishLearningViewer";
import { splitEnglishSubtitleLineIntoWordTokens } from "@/lib/watch/splitEnglishSubtitleLineIntoWordTokens";

export type SubtitleDisplayMode = "english_only" | "japanese_only" | "both";

type SubtitleOverlayPanelProperties = {
  readonly activeCue: BilingualTranscriptCue | null;
  readonly subtitleDisplayMode: SubtitleDisplayMode;
  readonly isJapaneseLineHiddenForLearning: boolean;
  readonly onEnglishWordClick: (input: {
    readonly headword: string;
    readonly surroundingSentenceEnglish: string;
  }) => void;
};

/**
 * 目的: アクティブ字幕行をレンダリングする
 * 入力: activeCue, 表示設定, 単語クリックハンドラ
 * 出力: React 要素
 * 副作用: なし
 * エラー発生時の挙動: activeCue が null ならプレースホルダ
 */
export function SubtitleOverlayPanel({
  activeCue,
  subtitleDisplayMode,
  isJapaneseLineHiddenForLearning,
  onEnglishWordClick,
}: SubtitleOverlayPanelProperties) {
  if (!activeCue) {
    return (
      <div className="min-h-[4.5rem] rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-500">
        字幕の該当行がありません（字幕未取得、またはこの時間帯に字幕が無い可能性があります）。
      </div>
    );
  }

  const shouldRenderEnglishLine =
    subtitleDisplayMode === "english_only" || subtitleDisplayMode === "both";
  const shouldRenderJapaneseLine =
    subtitleDisplayMode === "japanese_only" || subtitleDisplayMode === "both";

  const isJapaneseLineActuallyHidden =
    shouldRenderJapaneseLine && isJapaneseLineHiddenForLearning && subtitleDisplayMode === "both";

  const englishWordTokenList = splitEnglishSubtitleLineIntoWordTokens(activeCue.englishText);

  const englishLineReactNodeList: ReactNode[] = [];
  let englishLineCursorIndex = 0;
  for (const wordToken of englishWordTokenList) {
    if (wordToken.startIndexInclusive > englishLineCursorIndex) {
      englishLineReactNodeList.push(
        <span key={`english-gap-${englishLineCursorIndex}`}>
          {activeCue.englishText.slice(englishLineCursorIndex, wordToken.startIndexInclusive)}
        </span>,
      );
    }
    englishLineReactNodeList.push(
      <button
        key={`english-word-${wordToken.startIndexInclusive}-${wordToken.surfaceForm}`}
        type="button"
        className="inline rounded px-0.5 hover:bg-red-900/40 hover:text-white"
        onClick={() =>
          onEnglishWordClick({
            headword: wordToken.surfaceForm,
            surroundingSentenceEnglish: activeCue.englishText,
          })
        }
      >
        {activeCue.englishText.slice(wordToken.startIndexInclusive, wordToken.endIndexExclusive)}
      </button>,
    );
    englishLineCursorIndex = wordToken.endIndexExclusive;
  }
  if (englishLineCursorIndex < activeCue.englishText.length) {
    englishLineReactNodeList.push(
      <span key={`english-gap-${englishLineCursorIndex}`}>
        {activeCue.englishText.slice(englishLineCursorIndex)}
      </span>,
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
      {shouldRenderEnglishLine && activeCue.englishText ? (
        <p
          className="leading-relaxed text-zinc-50 [font-size:var(--watch-subtitle-overlay-english-font-size)]"
        >
          {englishLineReactNodeList}
        </p>
      ) : null}

      {shouldRenderJapaneseLine ? (
        <p
          className={
            isJapaneseLineActuallyHidden
              ? "text-zinc-600 blur-sm transition hover:blur-none [font-size:var(--watch-subtitle-overlay-japanese-font-size)]"
              : "leading-relaxed text-zinc-300 [font-size:var(--watch-subtitle-overlay-japanese-font-size)]"
          }
          title={
            isJapaneseLineActuallyHidden
              ? "学習モード: ホバーで日本語を確認（要件の『必要時のみ表示』の簡易版）"
              : undefined
          }
        >
          {activeCue.japaneseText ?? "（日本語字幕なし — 上の画面から自動翻訳を利用してください）"}
        </p>
      ) : null}
    </div>
  );
}

/*
 * ファイル概要: 字幕オーバーレイ
 * 入出力の概要: active cue → UI、単語クリックは親へ
 * 依存関係の一覧: @/types/*, @/lib/watch/splitEnglishSubtitleLineIntoWordTokens
 */
