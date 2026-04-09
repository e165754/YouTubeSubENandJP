# YouTube 英語学習ビュワー

Next.js（App Router）製の YouTube 検索・視聴・字幕・単語解析アプリです。

## 必要な環境

- Node.js / npm
- `.env.local`（テンプレは [`.env.example`](./.env.example)）

## 開発

```bash
npm install
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## 本番ビルド

```bash
npm run build
npm run start
```

## オンラインデプロイ

**[docs/デプロイ手順.md](./docs/デプロイ手順.md)** を参照してください。Vercel への Git 連携手順と、本番用環境変数の一覧をまとめています。

## ドキュメント

- [docs/仕様書.md](./docs/仕様書.md) — 仕様・API・データ・ファイル一覧（**最初に読むならここ**）
- [docs/設計_MVP_v1.md](./docs/設計_MVP_v1.md) — アーキテクチャ・処理フロー・設計判断
- [docs/デプロイ手順.md](./docs/デプロイ手順.md)
- [docs/ローカル字幕翻訳_NLLB.md](./docs/ローカル字幕翻訳_NLLB.md) — 欠損日本語のローカル翻訳（API キー不要）
- [docs/変更履歴.md](./docs/変更履歴.md)
