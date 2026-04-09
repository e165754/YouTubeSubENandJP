/**
 * 目的: テキスト中の先頭 `{` から、文字列内を考慮して対応する `}` までの JSON 部分文字列を切り出す
 * 主な役割: `var ytInitialPlayerResponse = {...};` のような埋め込みからオブジェクト JSON を復元する
 * 他ファイルとの関係: fetchYouTubeCaptionXmlViaWatchPagePlayerResponse から利用
 *
 * 注意: 単純な括弧カウントではなく、二重引用符文字列内の括弧は無視する（エスケープに対応）
 */

/**
 * 目的: startIndex の文字が `{` であることを前提に、対応する閉じ `}` までの部分文字列を返す
 * 入力: sourceText — HTML や JS 断片全体（string）, startIndex — `{` のインデックス（number）
 * 出力: JSON として parse 可能な部分文字列、失敗時 null
 * 副作用: なし
 * エラー発生時の挙動: バランス不能なら null
 */
export function extractBalancedJsonObjectSubstring(
  sourceText: string,
  startIndex: number,
): string | null {
  if (sourceText[startIndex] !== "{") {
    return null;
  }
  let braceNestingDepth = 0;
  let isInsideDoubleQuotedString = false;
  let isInsideSingleQuotedString = false;
  let shouldEscapeNextCharacterInString = false;

  for (let characterIndex = startIndex; characterIndex < sourceText.length; characterIndex += 1) {
    const currentCharacter = sourceText[characterIndex];

    if (shouldEscapeNextCharacterInString) {
      shouldEscapeNextCharacterInString = false;
      continue;
    }

    if (isInsideDoubleQuotedString) {
      if (currentCharacter === "\\") {
        shouldEscapeNextCharacterInString = true;
        continue;
      }
      if (currentCharacter === '"') {
        isInsideDoubleQuotedString = false;
      }
      continue;
    }

    if (isInsideSingleQuotedString) {
      if (currentCharacter === "\\") {
        shouldEscapeNextCharacterInString = true;
        continue;
      }
      if (currentCharacter === "'") {
        isInsideSingleQuotedString = false;
      }
      continue;
    }

    if (currentCharacter === '"') {
      isInsideDoubleQuotedString = true;
      continue;
    }
    if (currentCharacter === "'") {
      isInsideSingleQuotedString = true;
      continue;
    }

    if (currentCharacter === "{") {
      braceNestingDepth += 1;
    } else if (currentCharacter === "}") {
      braceNestingDepth -= 1;
      if (braceNestingDepth === 0) {
        return sourceText.slice(startIndex, characterIndex + 1);
      }
    }
  }

  return null;
}

/*
 * ファイル概要: 埋め込み JSON オブジェクト抽出
 * 入出力の概要: text + `{` index → JSON substring
 * 依存関係の一覧: なし
 */
