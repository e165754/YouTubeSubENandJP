/**
 * 目的: YouTube英語学習ビュワー全体で共有する型定義を集約する
 * 主な役割: APIレスポンス・字幕・UI状態の契約を明示する
 * 他ファイルとの関係: lib・components・route handlers から import される
 */

/** 検索結果の1動画（一覧表示用） */
export type YouTubeSearchResultVideoItem = {
  readonly videoId: string;
  readonly title: string;
  readonly channelTitle: string;
  readonly thumbnailUrl: string;
  readonly publishedAt: string;
  readonly durationIso8601: string;
  readonly descriptionSnippet: string;
};

/** 字幕の1行（再生位置と同期） */
export type TranscriptCue = {
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly text: string;
};

/** 日英ペア（同期表示・欠損補完の判定に使用） */
export type BilingualTranscriptCue = {
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly englishText: string;
  readonly japaneseText: string | null;
  readonly missingJapanese: boolean;
  readonly missingEnglish: boolean;
};

/** 単語解析APIの戻り値 */
export type WordAnalysisResult = {
  readonly headword: string;
  readonly meaningNaturalJapanese: string;
  readonly meaningLiteralJapanese: string;
  readonly partOfSpeechEnglish: string;
  readonly pronunciationIpaHint: string;
  readonly contextualMeaningJapanese: string;
  readonly relatedPhrasesEnglish: readonly string[];
};

/*
 * ファイル概要: ドメイン型の単一ソース
 * 入出力の概要: 型のみ（実行時の入出力なし）
 * 依存関係の一覧: なし
 */
