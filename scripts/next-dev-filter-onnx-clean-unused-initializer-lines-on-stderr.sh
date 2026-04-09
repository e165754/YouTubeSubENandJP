#!/usr/bin/env bash
# 目的: macOS で onnxruntime ネイティブが NSLog / fd 2 直書きする行を、Node の process.stderr では捕捉できないため、
#       next dev プロセス全体の stderr をシェルでフィルタしてから端末へ渡す
# 使い方: package.json の `dev` / `dev:turbo` から `dev --webpack` 等の引数をそのまま渡す
# 無効化: DISABLE_ONNX_CLEAN_UNUSED_INITIALIZER_STDERR_FILTER=1（生ログを見るとき）

set -euo pipefail

readonly projectRootAbsolutePath="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${projectRootAbsolutePath}"

export ORT_LOG_SEVERITY_LEVEL="${ORT_LOG_SEVERITY_LEVEL:-3}"
export ORT_LOG_LEVEL="${ORT_LOG_LEVEL:-3}"

readonly nextLocalBinaryPath="${projectRootAbsolutePath}/node_modules/.bin/next"
readonly onnxGraphCleanUnusedInitializerLogSubstringToken="CleanUnusedInitializersAndNodeArgs"

if [[ ! -x "${nextLocalBinaryPath}" ]]; then
  echo "next が見つかりません: ${nextLocalBinaryPath}（npm install 済みか確認）" >&2
  exit 1
fi

if [[ "${DISABLE_ONNX_CLEAN_UNUSED_INITIALIZER_STDERR_FILTER:-}" == "1" || "${DISABLE_ONNX_CLEAN_UNUSED_INITIALIZER_STDERR_FILTER:-}" == "true" ]]; then
  exec "${nextLocalBinaryPath}" "$@"
fi

# fd 3 に「本物の stderr」（端末）を退避。next の stderr はパイプへ。フィルタが &3 へだけ書く（ループ防止）
exec 3>&2
exec "${nextLocalBinaryPath}" "$@" 2> >(
  while IFS= read -r standardErrorLine || [[ -n "${standardErrorLine}" ]]; do
    if [[ "${standardErrorLine}" == *"${onnxGraphCleanUnusedInitializerLogSubstringToken}"* ]]; then
      continue
    fi
    printf '%s\n' "${standardErrorLine}" >&3
  done
)
