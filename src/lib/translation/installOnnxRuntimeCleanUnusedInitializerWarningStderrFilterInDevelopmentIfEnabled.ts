/**
 * 目的: macOS 等で ONNX ネイティブが `graph.cc` の `CleanUnusedInitializers...` をターミナルへ出し続ける問題に対し、開発時だけ該当行を間引く
 * 主な役割: `process.stderr.write` と `process.stdout.write` をラップし、特定サブストリングを含むチャンクを破棄する
 * 他ファイルとの関係: `src/instrumentation.ts` の `register()` から **動的 import** で NLLB より前に呼ぶ（Edge バンドルから除外するため）
 *
 * 注意:
 * - `SessionOptions.logSeverityLevel` や `ORT_LOG_*` が効かない経路のログ向け。**本番ではインストールしない**（`NODE_ENV === "development"` のみ）。
 * - チャンク分割で 1 行が複数 `write` に分かれると取りこぼす可能性がある（現状の ONNX 出力ではほぼ 1 チャンク＝1 行）。
 * - NSLog / fd 直書きで stream をバイパスする場合は効かない。**macOS の実効対策は `scripts/next-dev-filter-onnx-clean-unused-initializer-lines-on-stderr.sh`（npm run dev）。**
 */

import type { WriteStream } from "node:tty";

/** フィルタ対象を一意に特定する（誤って他の ONNX エラーを隠さないため） */
const onnxRuntimeCleanUnusedInitializersLogSubstringToken =
  "CleanUnusedInitializersAndNodeArgs";

/** 二重ラップ防止 */
let isOnnxCleanUnusedInitializerStandardStreamFilterAlreadyInstalled = false;

/**
 * 目的: `write` に渡したチャンクを UTF-8 文字列として解釈できるときだけ返す
 * 入力: chunk（標準ストリームに渡る値）
 * 出力: 文字列、または解釈不能なら null
 * 副作用: なし
 * エラー発生時の挙動: なし（null を返す）
 */
function tryConvertStandardStreamWriteChunkToUtf8String(chunk: unknown): string | null {
  if (typeof chunk === "string") {
    return chunk;
  }
  if (Buffer.isBuffer(chunk)) {
    return chunk.toString("utf8");
  }
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk).toString("utf8");
  }
  return null;
}

/**
 * 目的: 1 本の WriteStream に ONNX 冗長行フィルタを付与する
 * 入力: targetStandardStream（stderr または stdout）
 * 出力: なし
 * 副作用: `targetStandardStream.write` を置き換える
 * エラー発生時の挙動: なし
 */
function installOnnxCleanUnusedInitializerFilterOnNodeWriteStream(
  targetStandardStream: WriteStream,
): void {
  const originalStreamWrite = targetStandardStream.write.bind(targetStandardStream);

  targetStandardStream.write = function streamWriteWithOnnxCleanUnusedFilter(
    chunk: unknown,
    encodingOrCallback?: unknown,
    callback?: unknown,
  ): boolean {
    const chunkAsUtf8String = tryConvertStandardStreamWriteChunkToUtf8String(chunk);
    if (
      chunkAsUtf8String !== null &&
      chunkAsUtf8String.includes(onnxRuntimeCleanUnusedInitializersLogSubstringToken)
    ) {
      if (typeof encodingOrCallback === "function") {
        queueMicrotask(() => {
          (encodingOrCallback as (error?: Error | null) => void)();
        });
      } else if (typeof callback === "function") {
        queueMicrotask(() => {
          (callback as (error?: Error | null) => void)();
        });
      }
      return true;
    }
    if (typeof encodingOrCallback === "function") {
      return originalStreamWrite(
        chunk as string | Uint8Array,
        encodingOrCallback as (error?: Error | null) => void,
      );
    }
    if (callback !== undefined) {
      return originalStreamWrite(
        chunk as string | Uint8Array,
        encodingOrCallback as BufferEncoding,
        callback as (error?: Error | null) => void,
      );
    }
    if (encodingOrCallback !== undefined) {
      return originalStreamWrite(
        chunk as string | Uint8Array,
        encodingOrCallback as BufferEncoding,
      );
    }
    return originalStreamWrite(chunk as string | Uint8Array);
  } as typeof targetStandardStream.write;
}

/**
 * 目的: Next.js dev で NLLB 初回ロード時のターミナル洪水を止める（本番では何もしない）
 * 入力: なし
 * 出力: なし
 * 副作用: `process.stderr` / `process.stdout` の `write` を置き換える（development で最大 1 回ずつ）
 * エラー発生時の挙動: なし
 */
export function installOnnxRuntimeCleanUnusedInitializerWarningStderrFilterInDevelopmentIfEnabled(): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  const isUserRequestedDisableStandardStreamFilter =
    process.env.DISABLE_ONNX_CLEAN_UNUSED_INITIALIZER_STDERR_FILTER === "1" ||
    process.env.DISABLE_ONNX_CLEAN_UNUSED_INITIALIZER_STDERR_FILTER === "true";
  if (isUserRequestedDisableStandardStreamFilter) {
    return;
  }
  if (isOnnxCleanUnusedInitializerStandardStreamFilterAlreadyInstalled) {
    return;
  }
  isOnnxCleanUnusedInitializerStandardStreamFilterAlreadyInstalled = true;

  installOnnxCleanUnusedInitializerFilterOnNodeWriteStream(process.stderr);
  installOnnxCleanUnusedInitializerFilterOnNodeWriteStream(process.stdout);
}

/*
 * ファイル概要: dev 限定で ONNX graph 最適化 WARNING 行を標準出力・標準エラーから間引く
 * 入出力の概要: なし（副作用のみ）
 * 依存関係の一覧: node:tty（型のみ）
 */
