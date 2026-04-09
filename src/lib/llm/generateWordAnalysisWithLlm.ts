/**
 * 目的: クリックされた語を文脈込みで解析し学習表示用の構造化情報を返す
 * 主な役割: LLM プロンプトと JSON パース
 * 他ファイルとの関係: word-analysis API から呼ばれる
 */

import type { WordAnalysisResult } from "@/types/youtubeEnglishLearningViewer";
import { requestOpenAiCompatibleChatCompletionText } from "@/lib/llm/openAiCompatibleClient";

/**
 * 目的: 単語解析結果を生成する
 * 入力: headword, surroundingSentenceEnglish
 * 出力: WordAnalysisResult
 * 副作用: LLM API
 * エラー発生時の挙動: Error
 */
export async function generateWordAnalysisWithLlm(input: {
  readonly headword: string;
  readonly surroundingSentenceEnglish: string;
}): Promise<WordAnalysisResult> {
  const systemPrompt = [
    "あなたは英語学習用の辞書アシスタントです。",
    "JSON のみを返してください。キーは次の通り:",
    "headword, meaningNaturalJapanese, meaningLiteralJapanese, partOfSpeechEnglish, pronunciationIpaHint, contextualMeaningJapanese, relatedPhrasesEnglish（文字列の配列、最大5件）",
    "relatedPhrasesEnglish には句動詞・イディオム・よくある固定表現の候補を入れてください（該当がなければ空配列）。",
  ].join("\n");

  const userPrompt = [
    `単語/フレーズ: ${input.headword}`,
    "",
    "文脈（英語）:",
    input.surroundingSentenceEnglish,
  ].join("\n");

  const assistantPlainText = await requestOpenAiCompatibleChatCompletionText([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  const jsonMatch = assistantPlainText.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch ? jsonMatch[0] : assistantPlainText;
  const parsedUnknown: unknown = JSON.parse(jsonText);
  const parsed = parsedUnknown as {
    headword?: string;
    meaningNaturalJapanese?: string;
    meaningLiteralJapanese?: string;
    partOfSpeechEnglish?: string;
    pronunciationIpaHint?: string;
    contextualMeaningJapanese?: string;
    relatedPhrasesEnglish?: unknown;
  };

  const relatedPhrasesRaw = Array.isArray(parsed.relatedPhrasesEnglish)
    ? parsed.relatedPhrasesEnglish
    : [];

  return {
    headword: String(parsed.headword ?? input.headword),
    meaningNaturalJapanese: String(parsed.meaningNaturalJapanese ?? ""),
    meaningLiteralJapanese: String(parsed.meaningLiteralJapanese ?? ""),
    partOfSpeechEnglish: String(parsed.partOfSpeechEnglish ?? ""),
    pronunciationIpaHint: String(parsed.pronunciationIpaHint ?? ""),
    contextualMeaningJapanese: String(parsed.contextualMeaningJapanese ?? ""),
    relatedPhrasesEnglish: relatedPhrasesRaw.map((phrase) => String(phrase)).filter(Boolean),
  };
}

/*
 * ファイル概要: 単語解析 LLM
 * 入出力の概要: 語 + 文脈 → WordAnalysisResult
 * 依存関係の一覧: @/types/youtubeEnglishLearningViewer, ./openAiCompatibleClient
 */
