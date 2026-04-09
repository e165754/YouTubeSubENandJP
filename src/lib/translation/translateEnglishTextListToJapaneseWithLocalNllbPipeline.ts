/**
 * 目的: 外部翻訳 API キーなしで、サーバー上の ONNX モデル（NLLB）により英語→日本語に翻訳する
 * 主な役割: 字幕欠損行の補完（@xenova/transformers）
 * 他ファイルとの関係: fillMissingJapaneseInBilingualTranscriptCueListWithMachineTranslation から利用
 *
 * 注意:
 * - 初回実行時に Hugging Face からモデルファイルをダウンロードする（課金 API ではないがネットワークは使用）。
 * - キャッシュは `/.cache/transformers-js`（プロジェクト直下）に保存される。
 * - メモリ・CPU を多く使う。Vercel 等のサーバーレスではタイムアウトしうる。
 */

import "./applyOnnxRuntimeLogSeverityDefaultsBeforeTransformersNativeBinding";
import path from "node:path";
import { env, pipeline } from "@xenova/transformers";
import { applyOnnxInferenceSessionCreateLogSeverityPatchIfNotYetApplied } from "./patchOnnxInferenceSessionCreateToMergeErrorOnlyLogSeverityLevel";

/**
 * transformers は `InferenceSession.create(buffer, { executionProviders })` のみ渡すため、
 * ネイティブ側のグラフ最適化 WARNING が環境変数だけでは抑えきれないことがある。セッション単位の logSeverity をマージする。
 */
applyOnnxInferenceSessionCreateLogSeverityPatchIfNotYetApplied();

/** onnxruntime-common の既定は warning。併用で wasm 経路の冗長ログも下げられる */
env.backends.onnx.logLevel = "error";

/** 量子化版。英語学習向けに一般的な en→ja ペア */
const localNllbTranslationModelId = "Xenova/nllb-200-distilled-600M";

/** NLLB の英語（ラテン文字）トークン */
const nllbSourceLanguageTokenEngLatn = "eng_Latn";

/** NLLB の日本語（日本語文字）トークン */
const nllbTargetLanguageTokenJpnJpan = "jpn_Jpan";

/** 1 行あたりの最大文字数（トークン爆発・遅延防止） */
const maximumInputCharacterCountPerSubtitleLine = 480;

type TranslationPipelineInstance = Awaited<ReturnType<typeof pipeline>>;

/**
 * @xenova/transformers の `pipeline` 戻り型が全タスクの巨大な union のため、
 * translation 呼び出しの第 2 引数が型チェックに通らない。実行時は translation としてのみ使う。
 */
type NllbTranslationPipelineCallable = (
  text: string,
  options: { src_lang: string; tgt_lang: string; max_new_tokens: number },
) => Promise<unknown>;

let englishToJapaneseNllbPipelinePromise: Promise<TranslationPipelineInstance> | null = null;

/**
 * 目的: 翻訳パイプラインを 1 つだけ生成し再利用する（ロードコストが大きいため）
 * 入力: なし
 * 出力: pipeline インスタンス
 * 副作用: 初回にモデル取得・キャッシュ書き込み
 * エラー発生時の挙動: 例外をそのまま伝播
 */
function getOrCreateEnglishToJapaneseNllbPipelinePromise(): Promise<TranslationPipelineInstance> {
  if (!englishToJapaneseNllbPipelinePromise) {
    env.cacheDir = path.join(process.cwd(), ".cache", "transformers-js");
    englishToJapaneseNllbPipelinePromise = pipeline(
      "translation",
      localNllbTranslationModelId,
      { quantized: true },
    ) as Promise<TranslationPipelineInstance>;
  }
  return englishToJapaneseNllbPipelinePromise;
}

/**
 * 目的: pipeline の戻り値から翻訳文字列だけを取り出す
 * 入力: pipeline の戻り（配列またはオブジェクト）
 * 出力: 整形済み文字列または null
 * 副作用: なし
 * エラー発生時の挙動: null
 */
function extractTranslationTextFromNllbPipelineOutput(outputUnknown: unknown): string | null {
  if (Array.isArray(outputUnknown) && outputUnknown.length > 0) {
    const firstRecord = outputUnknown[0] as { translation_text?: string };
    if (typeof firstRecord.translation_text === "string") {
      return firstRecord.translation_text.trim();
    }
  }
  if (
    outputUnknown &&
    typeof outputUnknown === "object" &&
    "translation_text" in outputUnknown
  ) {
    const translationText = (outputUnknown as { translation_text?: string }).translation_text;
    if (typeof translationText === "string") {
      return translationText.trim();
    }
  }
  return null;
}

/**
 * 目的: 英語字幕行を順に日本語へ翻訳する（逐次・API キー不要）
 * 入力: englishTextList
 * 出力: 入力と同じ長さの配列（失敗要素は null）
 * 副作用: ONNX 推論（CPU/GPU 負荷）
 * エラー発生時の挙動: 1 行失敗時はその要素を null とし、全体は続行
 */
export async function translateEnglishTextListToJapaneseWithLocalNllbPipeline(input: {
  readonly englishTextList: readonly string[];
}): Promise<readonly (string | null)[]> {
  const translator = await getOrCreateEnglishToJapaneseNllbPipelinePromise();
  const translatedTextResultList: (string | null)[] = [];

  for (const rawEnglishLine of input.englishTextList) {
    const trimmedEnglishLine = rawEnglishLine.trim();
    if (!trimmedEnglishLine) {
      translatedTextResultList.push(null);
      continue;
    }
    const truncatedEnglishLine =
      trimmedEnglishLine.length > maximumInputCharacterCountPerSubtitleLine
        ? trimmedEnglishLine.slice(0, maximumInputCharacterCountPerSubtitleLine)
        : trimmedEnglishLine;

    try {
      const nllbCallable = translator as unknown as NllbTranslationPipelineCallable;
      const pipelineOutputUnknown = await nllbCallable(truncatedEnglishLine, {
        src_lang: nllbSourceLanguageTokenEngLatn,
        tgt_lang: nllbTargetLanguageTokenJpnJpan,
        max_new_tokens: 256,
      });
      translatedTextResultList.push(
        extractTranslationTextFromNllbPipelineOutput(pipelineOutputUnknown),
      );
    } catch {
      translatedTextResultList.push(null);
    }
  }

  return translatedTextResultList;
}

/**
 * 目的: テストやメモリ解放用にシングルトンをリセットする（通常は使わない）
 * 入力: なし
 * 出力: なし
 * 副作用: 次回 get で再ロード
 * エラー発生時の挙動: なし
 */
export function resetEnglishToJapaneseNllbPipelineForTests(): void {
  englishToJapaneseNllbPipelinePromise = null;
}

/*
 * ファイル概要: ローカル NLLB による en→ja 翻訳
 * 入出力の概要: string[] → (string|null)[]
 * 依存関係の一覧: @xenova/transformers, onnxruntime-node（パッチ経由）, node:path
 */
