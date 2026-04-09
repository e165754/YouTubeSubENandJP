/**
 * 目的: 欠損している片側字幕を、前後文脈付きで LLM により補完する
 * 主な役割: プロンプト構築と JSON 抽出
 * 他ファイルとの関係: API route から呼ばれる
 */

import type { SubtitleCompletionResult } from "@/types/youtubeEnglishLearningViewer";
import { requestOpenAiCompatibleChatCompletionText } from "@/lib/llm/openAiCompatibleClient";

/**
 * 目的: 英→日または日→英の字幕補完を生成する
 * 入力: 文脈テキスト・対象行・方向
 * 出力: SubtitleCompletionResult
 * 副作用: LLM API 呼び出し
 * エラー発生時の挙動: パース失敗や API 失敗で Error
 */
export async function generateSubtitleCompletionWithLlm(input: {
  readonly precedingContextText: string;
  readonly targetLineText: string;
  readonly followingContextText: string;
  readonly translationDirection: "en_to_ja" | "ja_to_en";
}): Promise<SubtitleCompletionResult> {
  const directionInstructionJapanese =
    input.translationDirection === "en_to_ja"
      ? "対象行は英語です。自然な日本語訳（字幕向けに短く）と、直訳寄りの日本語を返してください。"
      : "対象行は日本語です。英語の自然表現（字幕向けに短く）と、直訳寄りの英語を返してください。";

  const systemPrompt = [
    "あなたは英語学習向けの字幕翻訳アシスタントです。",
    "JSON のみを返し、他の文字は出さないでください。",
    'キーは "natural" と "literal" です。',
    directionInstructionJapanese,
  ].join("\n");

  const userPrompt = [
    "【前文】",
    input.precedingContextText || "(なし)",
    "",
    "【対象行】",
    input.targetLineText,
    "",
    "【後文】",
    input.followingContextText || "(なし)",
  ].join("\n");

  const assistantPlainText = await requestOpenAiCompatibleChatCompletionText([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  const jsonMatch = assistantPlainText.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch ? jsonMatch[0] : assistantPlainText;
  const parsedUnknown: unknown = JSON.parse(jsonText);
  const parsed = parsedUnknown as { natural?: string; literal?: string };
  const naturalJapaneseOrEnglish = String(parsed.natural ?? "").trim();
  const literalJapaneseOrEnglish = String(parsed.literal ?? "").trim();
  if (!naturalJapaneseOrEnglish) {
    throw new Error("LLM の JSON に natural が含まれていません。");
  }
  return {
    naturalPrimaryLine: naturalJapaneseOrEnglish,
    literalSecondaryLine: literalJapaneseOrEnglish || naturalJapaneseOrEnglish,
  };
}

/*
 * ファイル概要: 字幕補完 LLM
 * 入出力の概要: 文脈 + 行 → SubtitleCompletionResult
 * 依存関係の一覧: @/types/youtubeEnglishLearningViewer, ./openAiCompatibleClient
 */
