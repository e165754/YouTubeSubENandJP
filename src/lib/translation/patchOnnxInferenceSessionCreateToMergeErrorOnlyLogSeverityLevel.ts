/**
 * 目的: `@xenova/transformers` が `InferenceSession.create` に渡す `SessionOptions` に `logSeverityLevel` を足す
 * 主な役割: モデルロード時の `CleanUnusedInitializers...`（WARNING）が macOS の Node バインドで NSLog へ流れる問題の緩和
 * 他ファイルとの関係: `translateEnglishTextListToJapaneseWithLocalNllbPipeline.ts` が `@xenova/transformers` 直後に本モジュールの関数を 1 回だけ呼ぶ
 *
 * 注意:
 * - `ORT_LOG_*` だけではネイティブ初期化タイミングにより効かないことがある。`SessionOptions.logSeverityLevel` は Node バインドで解釈される（onnxruntime-common の型コメント参照）。
 * - 本パッチは **推論セッション作成のたび**にオプションへマージする。`transformers` が使う `(buffer, { executionProviders })` 形を主対象とする。
 */

import { InferenceSession } from "onnxruntime-node";

/**
 * ONNX Runtime のセッションログのうち ERROR 未満を出さないレベル（数値は C API の OrtLoggingLevel に準拠）
 * 役割: graph 最適化の WARNING を抑止する
 * 想定値: 3（ERROR）
 * 型: リテラル union に合わせた数値
 */
const onnxRuntimeSessionLogSeverityLevelErrorNumeric = 3 as const;

/** 二重パッチ防止（同一プロセスで複数回 import されても create を積み重ねない） */
let isOnnxInferenceSessionCreatePatchAlreadyApplied = false;

/**
 * 目的: `InferenceSession.create` をラップし、ユーザー指定の `SessionOptions` に `logSeverityLevel` をマージする
 * 入力: なし（`InferenceSession` は onnxruntime-node のシングルトンを参照）
 * 出力: なし
 * 副作用: `InferenceSession.create` を置き換える（1 プロセス 1 回のみ）
 * エラー発生時の挙動: パッチ適用前に例外が出た場合はそのまま伝播
 */
function isPlainObjectSessionOptionsCandidate(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return false;
  }
  if (value instanceof Uint8Array) {
    return false;
  }
  if (value instanceof ArrayBuffer) {
    return false;
  }
  if (typeof SharedArrayBuffer !== "undefined" && value instanceof SharedArrayBuffer) {
    return false;
  }
  return true;
}

/**
 * 目的: 公開 API として、翻訳モジュール読み込み時に 1 回だけパッチを適用する
 * 入力: なし
 * 出力: なし
 * 副作用: 上記ラップ
 * エラー発生時の挙動: なし（冪等）
 */
export function applyOnnxInferenceSessionCreateLogSeverityPatchIfNotYetApplied(): void {
  if (isOnnxInferenceSessionCreatePatchAlreadyApplied) {
    return;
  }
  isOnnxInferenceSessionCreatePatchAlreadyApplied = true;

  const originalInferenceSessionCreate = InferenceSession.create.bind(
    InferenceSession,
  ) as typeof InferenceSession.create;

  InferenceSession.create = (async (...args: Parameters<typeof InferenceSession.create>) => {
    const nextArgumentList = [...args];
    const lastArgumentIndex = nextArgumentList.length - 1;
    const lastArgument = nextArgumentList[lastArgumentIndex];

    if (isPlainObjectSessionOptionsCandidate(lastArgument)) {
      nextArgumentList[lastArgumentIndex] = {
        ...lastArgument,
        logSeverityLevel: onnxRuntimeSessionLogSeverityLevelErrorNumeric,
      } as (typeof nextArgumentList)[number];
      return originalInferenceSessionCreate(...(nextArgumentList as Parameters<typeof InferenceSession.create>));
    }

    if (nextArgumentList.length === 1) {
      nextArgumentList.push({
        logSeverityLevel: onnxRuntimeSessionLogSeverityLevelErrorNumeric,
      });
      return originalInferenceSessionCreate(...(nextArgumentList as Parameters<typeof InferenceSession.create>));
    }

    return originalInferenceSessionCreate(...args);
  }) as typeof InferenceSession.create;
}

/*
 * ファイル概要: ONNX `InferenceSession.create` へ ERROR ログ閾値をマージするランタイムパッチ
 * 入出力の概要: なし（モジュール副作用は export 関数経由のみ）
 * 依存関係の一覧: onnxruntime-node
 */
