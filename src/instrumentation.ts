/**
 * 目的: サーバー起動直後に一度だけ実行し、ネイティブ依存のログ・衝突を抑える
 * 主な役割: ONNX Runtime の冗長 WARNING 抑制（字幕ローカル翻訳でモデル読込時に大量出力されうる）
 * 他ファイルとの関係: Next.js が自動で本ファイルの `register` を呼ぶ（設定不要・v15 以降安定）
 */

/**
 * 目的: Node ランタイム上で、onnxruntime-node がロードされる前に環境変数を整える
 * 入力: なし（Next が起動時に呼び出す）
 * 出力: なし
 * 副作用: `process.env` を未設定時のみ書き換える・dev 時は stderr フィルタを動的 import
 * エラー発生時の挙動: 動的 import 失敗時はログ抑制のみスキップし、以降の env 設定は続行
 */
export async function register(): Promise<void> {
  /**
   * Next の慣例: `NEXT_RUNTIME === "edge"` のときだけ Edge。Node では **未設定**のことが多く、
   * `=== "nodejs"` を要求すると register 全体がスキップされ stderr フィルタも効かない。
   * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
   */
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }
  /**
   * macOS では `graph.cc` の WARNING が環境変数・SessionOptions を経由しても stderr に残ることがあるため、
   * development のみ該当行を間引く（無効化: `DISABLE_ONNX_CLEAN_UNUSED_INITIALIZER_STDERR_FILTER`）。
   * 静的 import すると Edge 用バンドル解析に引っかかるため **動的 import** とする。
   */
  try {
    const { installOnnxRuntimeCleanUnusedInitializerWarningStderrFilterInDevelopmentIfEnabled } =
      await import(
        "@/lib/translation/installOnnxRuntimeCleanUnusedInitializerWarningStderrFilterInDevelopmentIfEnabled"
      );
    installOnnxRuntimeCleanUnusedInitializerWarningStderrFilterInDevelopmentIfEnabled();
  } catch {
    /* stderr フィルタは補助。失敗してもアプリ起動は続ける */
  }
  /**
   * ONNX Runtime の既定は WARNING まで表示する。
   * NLLB 読込時に `CleanUnusedInitializers...` が大量に出るため、未設定なら ERROR 以上に抑える。
   * 数値: 0=VERBOSE, 1=INFO, 2=WARNING, 3=ERROR, 4=FATAL
   */
  if (process.env.ORT_LOG_SEVERITY_LEVEL === undefined) {
    process.env.ORT_LOG_SEVERITY_LEVEL = "3";
  }
  if (process.env.ORT_LOG_LEVEL === undefined) {
    process.env.ORT_LOG_LEVEL = "3";
  }
}

/*
 * ファイル概要: Next.js instrumentation フック
 * 入出力の概要: 起動時に副作用のみ（環境変数・dev 時 stderr フィルタ）
 * 依存関係の一覧: next（規約）, @/lib/translation/installOnnxRuntimeCleanUnusedInitializerWarningStderrFilterInDevelopmentIfEnabled
 */
