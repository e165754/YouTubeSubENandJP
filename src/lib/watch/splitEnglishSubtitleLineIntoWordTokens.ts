/**
 * 目的: 英語字幕行をクリック可能な単語トークンへ分割する
 * 主な役割: 品詞解析は行わず、表面形の連続アルファベット（アポストロフィ含む）を抽出
 * 他ファイルとの関係: TranscriptScriptPane / SubtitleOverlayPanel から利用
 */

export type EnglishSubtitleWordToken = {
  readonly surfaceForm: string;
  readonly startIndexInclusive: number;
  readonly endIndexExclusive: number;
};

const englishWordLikePattern = /[A-Za-z]+(?:'[A-Za-z]+)?/g;

/**
 * 目的: 英語行から単語トークン配列を生成する
 * 入力: englishSubtitleLine — 字幕1行（string）
 * 出力: EnglishSubtitleWordToken の配列（左から順）
 * 副作用: なし
 * エラー発生時の挙動: 空行なら空配列
 */
export function splitEnglishSubtitleLineIntoWordTokens(
  englishSubtitleLine: string,
): EnglishSubtitleWordToken[] {
  const wordTokenList: EnglishSubtitleWordToken[] = [];
  let patternMatch: RegExpExecArray | null;
  const reusablePattern = new RegExp(englishWordLikePattern);
  while ((patternMatch = reusablePattern.exec(englishSubtitleLine)) !== null) {
    wordTokenList.push({
      surfaceForm: patternMatch[0],
      startIndexInclusive: patternMatch.index,
      endIndexExclusive: patternMatch.index + patternMatch[0].length,
    });
  }
  return wordTokenList;
}

/*
 * ファイル概要: 英語字幕の単語分割
 * 入出力の概要: string → token[]
 * 依存関係の一覧: なし
 */
