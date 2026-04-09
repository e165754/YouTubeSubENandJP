/**
 * 目的: 右ペインに全字幕を一覧表示し、クリックでシークできるようにする
 * 主な役割: 現在行ハイライト、単語クリックの委譲（日英は /api/captions の結果をそのまま表示）
 * 他ファイルとの関係: YouTubeLearningWatchPageContent から利用
 */

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { BilingualTranscriptCue } from "@/types/youtubeEnglishLearningViewer";
import { splitEnglishSubtitleLineIntoWordTokens } from "@/lib/watch/splitEnglishSubtitleLineIntoWordTokens";

type TranscriptScriptPaneProperties = {
  readonly bilingualCueList: readonly BilingualTranscriptCue[];
  readonly activeCueIndex: number;
  readonly onSeekToCueStartSeconds: (cueStartSeconds: number) => void;
  readonly onEnglishWordClick: (input: {
    readonly headword: string;
    readonly surroundingSentenceEnglish: string;
  }) => void;
};

/**
 * 目的: スクリプト一覧 UI を描画する
 * 入力: 字幕配列、アクティブ index、各種ハンドラ
 * 出力: React 要素
 * 副作用: スクリプト用スクロール要素内でアクティブ行へ追従スクロール
 * エラー発生時の挙動: なし
 */
export function TranscriptScriptPane({
  bilingualCueList,
  activeCueIndex,
  onSeekToCueStartSeconds,
  onEnglishWordClick,
}: TranscriptScriptPaneProperties) {
  const activeRowElementRef = useRef<HTMLDivElement | null>(null);
  const transcriptScrollContainerElementRef = useRef<HTMLDivElement | null>(null);

  /**
   * 目的: 再生位置に合わせてアクティブ行をスクリプト枠内だけに表示する
   * 入力: activeCueIndex の変化（ref が指す DOM）
   * 出力: なし
   * 副作用: transcriptScrollContainerElementRef の scrollTop を更新する（document は動かさない）
   * エラー発生時の挙動: ref が無い場合は何もしない
   */
  useEffect(() => {
    const activeRowElement = activeRowElementRef.current;
    const transcriptScrollContainerElement = transcriptScrollContainerElementRef.current;
    if (!activeRowElement || !transcriptScrollContainerElement) {
      return;
    }
    const scrollPaddingPixels = 8;
    const containerBoundingClientRect = transcriptScrollContainerElement.getBoundingClientRect();
    const rowBoundingClientRect = activeRowElement.getBoundingClientRect();
    if (rowBoundingClientRect.top < containerBoundingClientRect.top + scrollPaddingPixels) {
      const scrollDeltaPixels =
        rowBoundingClientRect.top - containerBoundingClientRect.top - scrollPaddingPixels;
      transcriptScrollContainerElement.scrollTo({
        top: transcriptScrollContainerElement.scrollTop + scrollDeltaPixels,
        behavior: "smooth",
      });
    } else if (
      rowBoundingClientRect.bottom >
      containerBoundingClientRect.bottom - scrollPaddingPixels
    ) {
      const scrollDeltaPixels =
        rowBoundingClientRect.bottom - containerBoundingClientRect.bottom + scrollPaddingPixels;
      transcriptScrollContainerElement.scrollTo({
        top: transcriptScrollContainerElement.scrollTop + scrollDeltaPixels,
        behavior: "smooth",
      });
    }
  }, [activeCueIndex]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-zinc-800 bg-zinc-950/40">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-100">スクリプト（全文）</h2>
        <p className="text-xs text-zinc-500">
          行をクリックでシーク。日本語は取得できたトラック（YouTube 自動翻訳含む）をそのまま表示します。
        </p>
      </div>
      <div
        ref={transcriptScrollContainerElementRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2"
      >
        <ol className="space-y-2">
          {bilingualCueList.map((bilingualCue, cueIndex) => {
            const isActiveRow = cueIndex === activeCueIndex;
            const effectiveEnglishLineText = bilingualCue.englishText;
            const englishWordTokenList =
              splitEnglishSubtitleLineIntoWordTokens(effectiveEnglishLineText);
            const englishLineReactNodeList: ReactNode[] = [];
            let englishLineCursorIndex = 0;
            for (const wordToken of englishWordTokenList) {
              if (wordToken.startIndexInclusive > englishLineCursorIndex) {
                englishLineReactNodeList.push(
                  <span key={`${cueIndex}-gap-${englishLineCursorIndex}`}>
                    {effectiveEnglishLineText.slice(
                      englishLineCursorIndex,
                      wordToken.startIndexInclusive,
                    )}
                  </span>,
                );
              }
              englishLineReactNodeList.push(
                <button
                  key={`${cueIndex}-w-${wordToken.startIndexInclusive}`}
                  type="button"
                  className="inline rounded px-0.5 hover:bg-red-900/40"
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    onEnglishWordClick({
                      headword: wordToken.surfaceForm,
                      surroundingSentenceEnglish: effectiveEnglishLineText,
                    });
                  }}
                >
                  {effectiveEnglishLineText.slice(
                    wordToken.startIndexInclusive,
                    wordToken.endIndexExclusive,
                  )}
                </button>,
              );
              englishLineCursorIndex = wordToken.endIndexExclusive;
            }
            if (englishLineCursorIndex < effectiveEnglishLineText.length) {
              englishLineReactNodeList.push(
                <span key={`${cueIndex}-gap-${englishLineCursorIndex}`}>
                  {effectiveEnglishLineText.slice(englishLineCursorIndex)}
                </span>,
              );
            }
            return (
              <li key={`${bilingualCue.startSeconds}-${cueIndex}`}>
                <div
                  role="button"
                  tabIndex={0}
                  ref={isActiveRow ? activeRowElementRef : undefined}
                  onClick={() => onSeekToCueStartSeconds(bilingualCue.startSeconds)}
                  onKeyDown={(keyboardEvent) => {
                    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                      keyboardEvent.preventDefault();
                      onSeekToCueStartSeconds(bilingualCue.startSeconds);
                    }
                  }}
                  className={
                    isActiveRow
                      ? "w-full cursor-pointer rounded-lg border border-red-700/60 bg-red-950/30 p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                      : "w-full cursor-pointer rounded-lg border border-transparent p-3 text-left outline-none hover:border-zinc-700 hover:bg-zinc-900/40 focus-visible:ring-2 focus-visible:ring-zinc-600"
                  }
                >
                  <p className="text-zinc-500 [font-size:var(--watch-subtitle-script-timestamp-font-size)]">
                    {bilingualCue.startSeconds.toFixed(1)}s — {bilingualCue.endSeconds.toFixed(1)}s
                  </p>
                  <p className="mt-1 text-zinc-100 [font-size:var(--watch-subtitle-script-english-font-size)]">
                    {englishWordTokenList.length === 0
                      ? effectiveEnglishLineText || "（英語なし）"
                      : englishLineReactNodeList}
                  </p>
                  <p className="mt-1 text-zinc-400 [font-size:var(--watch-subtitle-script-japanese-font-size)]">
                    {bilingualCue.japaneseText ??
                      (bilingualCue.missingJapanese ? "" : "")}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/*
 * ファイル概要: スクリプト右ペイン
 * 入出力の概要: cues + state → UI、操作は親へ
 * 依存関係の一覧: react, @/types/*, @/lib/watch/splitEnglishSubtitleLineIntoWordTokens
 */
