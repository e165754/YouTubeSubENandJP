/**
 * 目的: 欠損字幕行の LLM 補完を提供し、キャッシュで再利用する
 * 主な役割: 入力検証 → キャッシュ → generateSubtitleCompletionWithLlm
 * 他ファイルとの関係: 視聴ページのクライアントから POST
 */

import { NextResponse } from "next/server";
import { generateSubtitleCompletionWithLlm } from "@/lib/llm/generateSubtitleCompletionWithLlm";
import {
  buildSubtitleCompletionCacheKey,
  getSubtitleCompletionFromCache,
  setSubtitleCompletionInCache,
} from "@/lib/llm/translationCompletionCache";

type SubtitleCompletionRequestBody = {
  readonly youtubeVideoId?: string;
  readonly startSeconds?: number;
  readonly precedingContextText?: string;
  readonly targetLineText?: string;
  readonly followingContextText?: string;
  readonly translationDirection?: "en_to_ja" | "ja_to_en";
};

/**
 * 目的: POST で文脈と対象行を受け取り補完結果 JSON を返す
 * 入力: JSON body
 * 出力: SubtitleCompletionResult
 * 副作用: LLM / キャッシュ
 * エラー発生時の挙動: 400/502
 */
export async function POST(request: Request): Promise<NextResponse> {
  let requestBodyUnknown: unknown;
  try {
    requestBodyUnknown = await request.json();
  } catch {
    return NextResponse.json({ errorMessage: "JSON が不正です。" }, { status: 400 });
  }

  const requestBody = requestBodyUnknown as SubtitleCompletionRequestBody;
  const youtubeVideoId = String(requestBody.youtubeVideoId ?? "").trim();
  const targetLineText = String(requestBody.targetLineText ?? "").trim();
  const translationDirection = requestBody.translationDirection ?? "en_to_ja";
  const startSeconds =
    typeof requestBody.startSeconds === "number" && Number.isFinite(requestBody.startSeconds)
      ? requestBody.startSeconds
      : 0;

  if (!youtubeVideoId || !targetLineText) {
    return NextResponse.json({ errorMessage: "youtubeVideoId と targetLineText は必須です。" }, { status: 400 });
  }

  const cacheKey = buildSubtitleCompletionCacheKey({
    youtubeVideoId,
    startSeconds,
    sourceText: targetLineText,
    translationDirection,
  });
  const cachedCompletion = getSubtitleCompletionFromCache(cacheKey);
  if (cachedCompletion) {
    return NextResponse.json({ ...cachedCompletion, cacheHit: true });
  }

  try {
    const completionResult = await generateSubtitleCompletionWithLlm({
      precedingContextText: String(requestBody.precedingContextText ?? ""),
      targetLineText,
      followingContextText: String(requestBody.followingContextText ?? ""),
      translationDirection,
    });
    setSubtitleCompletionInCache(cacheKey, completionResult);
    return NextResponse.json({ ...completionResult, cacheHit: false });
  } catch (unknownError) {
    const message =
      unknownError instanceof Error ? unknownError.message : "補完に失敗しました。";
    return NextResponse.json({ errorMessage: message }, { status: 502 });
  }
}

/*
 * ファイル概要: 字幕補完 API
 * 入出力の概要: POST JSON → 補完結果
 * 依存関係の一覧: next/server, @/lib/llm/*
 */
