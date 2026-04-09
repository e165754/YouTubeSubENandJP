# ローカル字幕翻訳（NLLB・API キー不要）

日本語字幕が YouTube から十分取れない行について、**外部の翻訳 API キーは使わず**、サーバー（あなたの PC や自前 Node プロセス）上で ONNX モデルを動かして英語→日本語を補います。

## 仕組み

- ライブラリ: [`@xenova/transformers`](https://www.npmjs.com/package/@xenova/transformers)（Transformers.js）
- モデル: **`Xenova/nllb-200-distilled-600M`**（量子化版）
- 言語指定: ソース `eng_Latn` → ターゲット `jpn_Jpan`（英語学習向けの英→日前提）
- 実装: `src/lib/translation/translateEnglishTextListToJapaneseWithLocalNllbPipeline.ts`

## 初回実行時

1. **Hugging Face Hub** からモデルファイルをダウンロードする（**課金 API ではない**が、インターネット接続は必要）。
2. キャッシュはプロジェクト直下の **`.cache/transformers-js/`** に保存される（`.gitignore` 済み）。
3. ダウンロードと初回ロードで **数分**かかることがある。

## パフォーマンス・制約

- **CPU 推論**のため、行数が多いと `/api/captions` の応答が非常に遅くなる。
- **メモリ**を数百 MB〜1 GB 程度使うことがある。
- **Vercel のサーバーレス**ではタイムアウト・メモリ不足になりやすい。本番で無効化する場合は環境変数を参照。
- **日本語トラックが YouTube から 1 行も取れない**動画では、従来「全英語行が欠損日本語」となり **全文を 1 行ずつ NLLB** していた。長尺では API がタイムアウトし、**英語字幕も表示されなくなる**ため、**既定ではその場合は NLLB を走らせず**英語のみ返す（詳細は下記 `ENABLE_LOCAL_NLLB_FOR_ENGLISH_ONLY_TRANSCRIPTS`）。

## 環境変数（任意）

| 変数 | 値 | 意味 |
|------|-----|------|
| `DISABLE_LOCAL_NLLB_SUBTITLE_TRANSLATION` | `true` または `1` | ローカル NLLB による補完を**行わない**（欠損のまま返す） |
| `ENABLE_LOCAL_NLLB_FOR_ENGLISH_ONLY_TRANSCRIPTS` | `true` または `1` | **日本語が 0 行**の動画でも全文をローカル翻訳しようとする（長尺ではタイムアウトしうる。**既定はオフ**） |
| `DISABLE_ONNX_CLEAN_UNUSED_INITIALIZER_STDERR_FILTER` | `true` または `1` | `next dev` で `CleanUnusedInitializers...` 行の stderr 間引きを**無効化**（生ログを確認するとき） |

未設定時は、**日本語トラックが少なくとも 1 行ある**前提で欠損行があれば（`DISABLE_LOCAL_NLLB...` で無効化していなければ）ローカル翻訳を試みます。日本語が完全に無い動画では既定でスキップします（上記 `ENABLE_...` で明示的に有効化した場合のみ全文翻訳）。

## 関連 API フィールド

- `japaneseIsMachineTranslationFallback`: ローカルで 1 行以上補えたとき `true`
- `japaneseMachineTranslationProvider`: 補完に成功したとき `"local_nllb"`（未使用時は `null`）

## 開発時ターミナルに出やすいメッセージ

| 現象 | 説明 |
|------|------|
| `objc[...]: Class GNotificationCenterDelegate is implemented in both ... libvips...` | `@xenova/transformers` が依存する `sharp` と、Next が使う `sharp` が **別バージョンの libvips** をロードすると macOS で出る。本リポジトリでは `package.json` の **`overrides` で全パッケージの `sharp` を 0.34.5 に統一**し、ネストした古い `sharp` を消している。再び出る場合は `rm -rf node_modules && npm install` を試す。 |
| `[W:onnxruntime:, graph.cc:3490 CleanUnusedInitializers...]` | モデル ONNX に無用な initializer が含まれるときの **警告**。**macOS ではネイティブが NSLog / fd 直書きすることが多く、Node の `process.stderr.write` をラップしても消えない。** そのため本リポジトリの `npm run dev` / `dev:turbo` は **`scripts/next-dev-filter-onnx-clean-unused-initializer-lines-on-stderr.sh`** で `next` の **stderr 全体をシェルが行単位フィルタ**してから端末へ渡す（ここが実効的な対策）。`DISABLE_ONNX_CLEAN_UNUSED_INITIALIZER_STDERR_FILTER=1` で無効化。補助として `instrumentation.ts` から JS 側フィルタも試みるが、環境により効かない。 |
