/**
 * 目的: `@xenova/transformers` が `onnxruntime-node` のネイティブバインドをロードする**より前**に実行する
 * 主な役割: ONNX Runtime の既定ログが WARNING のため、`CleanUnusedInitializers...` が大量にターミナルへ出るのを抑える
 * 他ファイルとの関係: `translateEnglishTextListToJapaneseWithLocalNllbPipeline.ts` で本ファイルを **@xenova/transformers より先**に import する
 *
 * 注意:
 * - Next.js の `instrumentation.ts` の `register()` だけでは、dev のバンドル評価順序により **手遅れ**になりうる。
 * - バージョンにより解釈される環境変数名が異なる場合があるため、複数を未設定時のみセットする。
 * - macOS では `[W:onnxruntime:, graph.cc:...]` が stream をバイパスして出る。確実な対策は `scripts/next-dev-filter-onnx-clean-unused-initializer-lines-on-stderr.sh`（`npm run dev` 経由）。
 * - `patchOnnxInferenceSessionCreateToMergeErrorOnlyLogSeverityLevel.ts` は補助（効かない環境あり）。
 */

/** ONNX の OrtLoggingLevel: ERROR（WARNING 以下を表示しない） */
const onnxRuntimeErrorOnlySeverityLevelNumericString = "3";

if (process.env.ORT_LOG_SEVERITY_LEVEL === undefined) {
  process.env.ORT_LOG_SEVERITY_LEVEL = onnxRuntimeErrorOnlySeverityLevelNumericString;
}

/** 一部ビルドで参照される別名（数値は ORT と同じスケール） */
if (process.env.ORT_LOG_LEVEL === undefined) {
  process.env.ORT_LOG_LEVEL = onnxRuntimeErrorOnlySeverityLevelNumericString;
}

/*
 * ファイル概要: ONNX ログ既定の早期適用（副作用のみ）
 * 入出力の概要: なし（process.env のみ）
 * 依存関係の一覧: なし
 */
