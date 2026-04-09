/**
 * 目的: クリック語の解析を LLM で返す API 境界
 * 主な役割: 入力検証と generateWordAnalysisWithLlm の呼び出し
 * 他ファイルとの関係: 視聴ページ右ペインから POST
 */

import { NextResponse } from "next/server";
import { generateWordAnalysisWithLlm } from "@/lib/llm/generateWordAnalysisWithLlm";

type WordAnalysisRequestBody = {
  readonly headword?: string;
  readonly surroundingSentenceEnglish?: string;
};

/**
 * 目的: POST で語と文脈を受け取り解析 JSON を返す
 * 入力: JSON body
 * 出力: WordAnalysisResult
 * 副作用: LLM API
 * エラー発生時の挙動: 400/502
 */
export async function POST(request: Request): Promise<NextResponse> {
  let requestBodyUnknown: unknown;
  try {
    requestBodyUnknown = await request.json();
  } catch {
    return NextResponse.json({ errorMessage: "JSON が不正です。" }, { status: 400 });
  }

  const requestBody = requestBodyUnknown as WordAnalysisRequestBody;
  const headword = String(requestBody.headword ?? "").trim();
  const surroundingSentenceEnglish = String(requestBody.surroundingSentenceEnglish ?? "").trim();

  if (!headword) {
    return NextResponse.json({ errorMessage: "headword は必須です。" }, { status: 400 });
  }

  try {
    const analysisResult = await generateWordAnalysisWithLlm({
      headword,
      surroundingSentenceEnglish,
    });
    return NextResponse.json(analysisResult);
  } catch (unknownError) {
    const message =
      unknownError instanceof Error ? unknownError.message : "解析に失敗しました。";
    return NextResponse.json({ errorMessage: message }, { status: 502 });
  }
}

/*
 * ファイル概要: 単語解析 API
 * 入出力の概要: POST JSON → WordAnalysisResult
 * 依存関係の一覧: next/server, @/lib/llm/generateWordAnalysisWithLlm
 */
