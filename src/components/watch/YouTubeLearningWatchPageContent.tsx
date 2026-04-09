/**
 * 目的: 視聴ページのクライアント側状態（字幕・再生位置・単語解析 LLM・シーク）を統合する
 * 主な役割: /api/captions と単語解析 LLM API の呼び出し、レイアウト構成
 * 他ファイルとの関係: app/watch/[youtubeVideoId]/page.tsx から描画
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BilingualTranscriptCue,
  WordAnalysisResult,
} from "@/types/youtubeEnglishLearningViewer";
import { findActiveBilingualCueIndex } from "@/lib/watch/findActiveBilingualCueIndex";
import { YouTubeIframePlayer } from "@/components/watch/YouTubeIframePlayer";
import {
  SubtitleOverlayPanel,
  type SubtitleDisplayMode,
} from "@/components/watch/SubtitleOverlayPanel";
import { TranscriptScriptPane } from "@/components/watch/TranscriptScriptPane";
import { WordAnalysisSidePanel } from "@/components/watch/WordAnalysisSidePanel";
import { logClientYouTubeCaptionPipelineDebug } from "@/lib/debug/logYouTubeCaptionPipelineDebugOnClientIfEnabled";

type YouTubeLearningWatchPageContentProperties = {
  readonly youtubeVideoId: string;
};

/**
 * 目的: 視聴ページ UI を提供する
 * 入力: youtubeVideoId
 * 出力: React 要素
 * 副作用: fetch、タイマー（子の Player）
 * エラー発生時の挙動: メッセージ表示で復旧可能にする
 */
export function YouTubeLearningWatchPageContent({
  youtubeVideoId,
}: YouTubeLearningWatchPageContentProperties) {
  const [bilingualCueList, setBilingualCueList] = useState<readonly BilingualTranscriptCue[]>([]);
  const [captionsLoadErrorMessage, setCaptionsLoadErrorMessage] = useState<string | null>(null);
  const [japaneseIsYoutubeAutoTranslation, setJapaneseIsYoutubeAutoTranslation] = useState(false);
  const [japaneseIsMachineTranslationFallback, setJapaneseIsMachineTranslationFallback] =
    useState(false);
  const [japaneseMachineTranslationProvider, setJapaneseMachineTranslationProvider] = useState<
    null | "local_nllb"
  >(null);

  const [currentPlaybackTimeSeconds, setCurrentPlaybackTimeSeconds] = useState(0);
  const [seekCommand, setSeekCommand] = useState<{
    readonly targetSeconds: number;
    readonly requestId: number;
  } | null>(null);
  const nextSeekRequestIdReference = useRef(0);
  const [subtitleDisplayMode, setSubtitleDisplayMode] = useState<SubtitleDisplayMode>("both");
  const [isJapaneseLineHiddenForLearning, setIsJapaneseLineHiddenForLearning] = useState(false);

  const [selectedHeadword, setSelectedHeadword] = useState<string | null>(null);
  const [isWordAnalysisLoading, setIsWordAnalysisLoading] = useState(false);
  const [wordAnalysisErrorMessage, setWordAnalysisErrorMessage] = useState<string | null>(null);
  const [wordAnalysisResult, setWordAnalysisResult] = useState<WordAnalysisResult | null>(null);

  useEffect(() => {
    let isCancelled = false;
    async function loadCaptions() {
      setCaptionsLoadErrorMessage(null);
      setJapaneseIsYoutubeAutoTranslation(false);
      setJapaneseIsMachineTranslationFallback(false);
      setJapaneseMachineTranslationProvider(null);
      try {
        const captionsRequestUrl = `/api/captions?videoId=${encodeURIComponent(youtubeVideoId)}`;
        logClientYouTubeCaptionPipelineDebug("fetch 開始", { youtubeVideoId, captionsRequestUrl });
        const response = await fetch(captionsRequestUrl);
        const responseJsonUnknown: unknown = await response.json();
        logClientYouTubeCaptionPipelineDebug("fetch 応答（HTTP）", {
          youtubeVideoId,
          httpStatus: response.status,
          responseOk: response.ok,
        });
        if (!response.ok) {
          const errorPayload = responseJsonUnknown as { errorMessage?: string };
          logClientYouTubeCaptionPipelineDebug("fetch 失敗ペイロード", {
            youtubeVideoId,
            errorMessageFromApi: errorPayload.errorMessage ?? null,
          });
          throw new Error(errorPayload.errorMessage ?? "字幕の取得に失敗しました。");
        }
        const successPayload = responseJsonUnknown as {
          bilingualCueList: BilingualTranscriptCue[];
          japaneseIsYoutubeAutoTranslation?: boolean;
          japaneseIsMachineTranslationFallback?: boolean;
          japaneseMachineTranslationProvider?: null | "local_nllb";
        };
        const firstCueEnglishTextPreview =
          successPayload.bilingualCueList[0]?.englishText?.slice(0, 80) ?? null;
        logClientYouTubeCaptionPipelineDebug("fetch 成功・state 反映前", {
          youtubeVideoId,
          bilingualCueCount: successPayload.bilingualCueList.length,
          japaneseIsYoutubeAutoTranslation: successPayload.japaneseIsYoutubeAutoTranslation === true,
          japaneseIsMachineTranslationFallback:
            successPayload.japaneseIsMachineTranslationFallback === true,
          japaneseMachineTranslationProvider:
            successPayload.japaneseMachineTranslationProvider ?? null,
          firstCueEnglishTextPreview,
        });
        if (!isCancelled) {
          setBilingualCueList(successPayload.bilingualCueList);
          setJapaneseIsYoutubeAutoTranslation(
            successPayload.japaneseIsYoutubeAutoTranslation === true,
          );
          setJapaneseIsMachineTranslationFallback(
            successPayload.japaneseIsMachineTranslationFallback === true,
          );
          const providerFromApi = successPayload.japaneseMachineTranslationProvider;
          setJapaneseMachineTranslationProvider(
            providerFromApi === "local_nllb" ? providerFromApi : null,
          );
        }
      } catch (unknownError) {
        if (!isCancelled) {
          const message =
            unknownError instanceof Error ? unknownError.message : "字幕の取得に失敗しました。";
          logClientYouTubeCaptionPipelineDebug("fetch 例外（UI にエラー表示）", {
            youtubeVideoId,
            errorMessageForUser: message,
          });
          setCaptionsLoadErrorMessage(message);
        }
      }
    }
    void loadCaptions();
    return () => {
      isCancelled = true;
    };
  }, [youtubeVideoId]);

  useEffect(() => {
    const activeCueIndexAtPlaybackZeroSeconds = findActiveBilingualCueIndex(
      bilingualCueList,
      0,
    );
    logClientYouTubeCaptionPipelineDebug("bilingualCueList 更新（0 秒時点のアクティブ行 index）", {
      youtubeVideoId,
      bilingualCueCount: bilingualCueList.length,
      activeCueIndexAtPlaybackZeroSeconds,
    });
  }, [bilingualCueList, youtubeVideoId]);

  const activeCueIndex = useMemo(() => {
    return findActiveBilingualCueIndex(bilingualCueList, currentPlaybackTimeSeconds);
  }, [bilingualCueList, currentPlaybackTimeSeconds]);

  const activeCueForOverlay = useMemo(() => {
    if (activeCueIndex < 0) {
      return null;
    }
    const baseCue = bilingualCueList[activeCueIndex];
    if (!baseCue) {
      return null;
    }
    return baseCue;
  }, [activeCueIndex, bilingualCueList]);

  const handleSeekToCueStartSeconds = useCallback((cueStartSeconds: number) => {
    nextSeekRequestIdReference.current += 1;
    setSeekCommand({
      targetSeconds: cueStartSeconds,
      requestId: nextSeekRequestIdReference.current,
    });
  }, []);

  const handleEnglishWordClick = useCallback(
    async (input: { readonly headword: string; readonly surroundingSentenceEnglish: string }) => {
      setSelectedHeadword(input.headword);
      setIsWordAnalysisLoading(true);
      setWordAnalysisErrorMessage(null);
      setWordAnalysisResult(null);
      try {
        const response = await fetch("/api/llm/word-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            headword: input.headword,
            surroundingSentenceEnglish: input.surroundingSentenceEnglish,
          }),
        });
        const responseJsonUnknown: unknown = await response.json();
        if (!response.ok) {
          const errorPayload = responseJsonUnknown as { errorMessage?: string };
          throw new Error(errorPayload.errorMessage ?? "解析に失敗しました。");
        }
        setWordAnalysisResult(responseJsonUnknown as WordAnalysisResult);
      } catch (unknownError) {
        const message =
          unknownError instanceof Error ? unknownError.message : "解析に失敗しました。";
        setWordAnalysisErrorMessage(message);
      } finally {
        setIsWordAnalysisLoading(false);
      }
    },
    [],
  );

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <header className="z-20 shrink-0 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-100 hover:underline"
            >
              ← 検索へ戻る
            </Link>
            <p className="text-sm font-semibold">視聴: {youtubeVideoId}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
            <label className="flex items-center gap-2">
              表示
              <select
                value={subtitleDisplayMode}
                onChange={(event) =>
                  setSubtitleDisplayMode(event.target.value as SubtitleDisplayMode)
                }
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
              >
                <option value="english_only">英語のみ</option>
                <option value="japanese_only">日本語のみ</option>
                <option value="both">英語+日本語</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isJapaneseLineHiddenForLearning}
                onChange={(event) => setIsJapaneseLineHiddenForLearning(event.target.checked)}
                className="accent-red-600"
              />
              学習: 日本語を弱表示（ホバーで確認）
            </label>
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-cols-1 grid-rows-[minmax(0,auto)_minmax(0,1fr)] gap-4 overflow-hidden px-4 py-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:grid-rows-[minmax(0,1fr)]">
        <section className="min-h-0 min-w-0 space-y-4 overflow-y-auto overscroll-y-contain xl:max-h-full xl:pr-1">
          <YouTubeIframePlayer
            youtubeVideoId={youtubeVideoId}
            onCurrentPlaybackTimeSeconds={setCurrentPlaybackTimeSeconds}
            seekCommand={seekCommand}
          />
          {japaneseIsYoutubeAutoTranslation && bilingualCueList.length > 0 ? (
            <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400">
              日本語は YouTube の自動翻訳字幕です（投稿者提供の日本語トラックはありません）。
            </div>
          ) : null}
          {japaneseIsMachineTranslationFallback && bilingualCueList.length > 0 ? (
            <div className="rounded-lg border border-blue-900/50 bg-blue-950/30 px-3 py-2 text-xs text-blue-200/90">
              {japaneseMachineTranslationProvider === "local_nllb"
                ? "欠損していた日本語は、このマシン上のローカルモデル（NLLB / transformers.js）で英語から補いました。初回はモデル取得で時間がかかります。"
                : "欠損していた日本語はサーバー側のローカル翻訳で英語から補いました。"}
            </div>
          ) : null}
          {captionsLoadErrorMessage ? (
            <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">
              {captionsLoadErrorMessage}
            </div>
          ) : null}
          <SubtitleOverlayPanel
            activeCue={activeCueForOverlay}
            subtitleDisplayMode={subtitleDisplayMode}
            isJapaneseLineHiddenForLearning={isJapaneseLineHiddenForLearning}
            onEnglishWordClick={handleEnglishWordClick}
          />
        </section>

        <aside className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <TranscriptScriptPane
              bilingualCueList={bilingualCueList}
              activeCueIndex={activeCueIndex}
              onSeekToCueStartSeconds={handleSeekToCueStartSeconds}
              onEnglishWordClick={handleEnglishWordClick}
            />
          </div>
          <div className="max-h-[min(280px,38vh)] shrink-0 overflow-y-auto overscroll-y-contain xl:max-h-[min(320px,32vh)]">
            <WordAnalysisSidePanel
              selectedHeadword={selectedHeadword}
              isAnalysisLoading={isWordAnalysisLoading}
              analysisErrorMessage={wordAnalysisErrorMessage}
              wordAnalysisResult={wordAnalysisResult}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

/*
 * ファイル概要: 視聴ページのクライアント統合
 * 入出力の概要: videoId → プレイヤー + 字幕 + スクリプト + 単語解析
 * 依存関係の一覧: next/link, react, 子コンポーネント, @/lib/watch/findActiveBilingualCueIndex, @/types/*
 */
