/**
 * 目的: OpenAI 互換の Chat Completions API を叩く薄いクライアント
 * 主な役割: ベースURL・モデル・APIキーを環境変数から解決
 * 他ファイルとの関係: word-analysis から利用
 */

export type ChatCompletionMessage = {
  readonly role: "system" | "user";
  readonly content: string;
};

/**
 * 目的: チャット補完を1回呼び出し、assistant の本文を返す
 * 入力: messageList — 会話メッセージ, responseJsonSchemaHint — 任意の整形ヒント文字列
 * 出力: assistantPlainText（string）
 * 副作用: 外部 LLM API へ POST
 * エラー発生時の挙動: 失敗時は Error を throw
 */
export async function requestOpenAiCompatibleChatCompletionText(
  messageList: readonly ChatCompletionMessage[],
): Promise<string> {
  const openAiCompatibleApiKey = process.env.OPENAI_COMPATIBLE_API_KEY ?? process.env.OPENAI_API_KEY;
  const openAiCompatibleBaseUrl =
    process.env.OPENAI_COMPATIBLE_BASE_URL ?? "https://api.openai.com/v1";
  const openAiCompatibleModelName =
    process.env.OPENAI_COMPATIBLE_MODEL ?? "gpt-4o-mini";

  if (!openAiCompatibleApiKey) {
    throw new Error("OPENAI_COMPATIBLE_API_KEY（または OPENAI_API_KEY）が未設定です。");
  }

  const chatCompletionsUrl = `${openAiCompatibleBaseUrl.replace(/\/$/, "")}/chat/completions`;
  const completionResponse = await fetch(chatCompletionsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiCompatibleApiKey}`,
    },
    body: JSON.stringify({
      model: openAiCompatibleModelName,
      temperature: 0.3,
      messages: messageList,
    }),
  });

  if (!completionResponse.ok) {
    const errorBodyText = await completionResponse.text();
    throw new Error(`LLM API error: ${completionResponse.status} ${errorBodyText}`);
  }

  const completionJsonUnknown: unknown = await completionResponse.json();
  const completionJson = completionJsonUnknown as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const assistantPlainText = completionJson.choices?.[0]?.message?.content ?? "";
  if (!assistantPlainText.trim()) {
    throw new Error("LLM から空の応答が返りました。");
  }
  return assistantPlainText.trim();
}

/*
 * ファイル概要: OpenAI 互換クライアント
 * 入出力の概要: messages → assistant text
 * 依存関係の一覧: なし（fetch）
 */
