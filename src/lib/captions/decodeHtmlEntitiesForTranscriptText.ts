/**
 * 目的: YouTube timedtext の本文に含まれる HTML 実体参照を人が読める文字へ戻す
 * 主な役割: &amp; 等のデコード（最小限だが実運用で足りる範囲）
 * 他ファイルとの関係: parseYouTubeTimedTextXmlString から利用
 */

/**
 * 目的: timedtext の text ノード内の代表的な実体参照をデコードする
 * 入力: encodedTranscriptText — XML から取り出した生文字列（string）
 * 出力: デコード後の表示用文字列（string）
 * 副作用: なし
 * エラー発生時の挙動: 例外は投げない（未対応参照はそのまま残す）
 */
export function decodeHtmlEntitiesForTranscriptText(
  encodedTranscriptText: string,
): string {
  let decodedText = encodedTranscriptText;
  decodedText = decodedText.replace(/&amp;/g, "&");
  decodedText = decodedText.replace(/&lt;/g, "<");
  decodedText = decodedText.replace(/&gt;/g, ">");
  decodedText = decodedText.replace(/&quot;/g, '"');
  decodedText = decodedText.replace(/&#39;/g, "'");
  decodedText = decodedText.replace(/&nbsp;/g, " ");
  decodedText = decodedText.replace(/&#(\d+);/g, (_, codePointDecimal: string) => {
    const codePointNumber = Number.parseInt(codePointDecimal, 10);
    if (Number.isNaN(codePointNumber)) {
      return _;
    }
    return String.fromCodePoint(codePointNumber);
  });
  decodedText = decodedText.replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
    const codePointNumber = Number.parseInt(hex, 16);
    if (Number.isNaN(codePointNumber)) {
      return _;
    }
    return String.fromCodePoint(codePointNumber);
  });
  return decodedText;
}

/*
 * ファイル概要: 字幕テキストのサニタイズ前処理
 * 入出力の概要: string → string
 * 依存関係の一覧: なし
 */
