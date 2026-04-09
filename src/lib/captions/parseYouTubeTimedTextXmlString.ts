/**
 * 目的: YouTube timedtext（XML）を構造化字幕へ変換する
 * 主な役割: <text start dur> を TranscriptCue 配列にパース
 * 他ファイルとの関係: fetch 層から呼ばれる
 */

import type { TranscriptCue } from "@/types/youtubeEnglishLearningViewer";
import { decodeHtmlEntitiesForTranscriptText } from "@/lib/captions/decodeHtmlEntitiesForTranscriptText";

const transcriptTextElementPattern =
  /<text\s+start="([\d.]+)"\s+dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;

const transcriptParagraphElementPattern =
  /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;

const transcriptParagraphInnerSegmentPattern = /<s[^>]*>([^<]*)<\/s>/g;

/**
 * 目的: InnerTube / format=3 の段落 XML から表示テキストを組み立てる
 * 入力: paragraphInnerHtml — `<p>` 内の HTML 断片
 * 出力: 正規化した1行分の文字列
 * 副作用: なし
 * エラー発生時の挙動: 空文字を返しうる
 */
function buildDisplayTextFromSrv3ParagraphInnerHtml(paragraphInnerHtml: string): string {
  const segmentTextPartList: string[] = [];
  for (const segmentMatch of paragraphInnerHtml.matchAll(transcriptParagraphInnerSegmentPattern)) {
    segmentTextPartList.push(segmentMatch[1] ?? "");
  }
  const textJoinedFromSegments = segmentTextPartList.join("").trim();
  if (textJoinedFromSegments.length > 0) {
    return decodeHtmlEntitiesForTranscriptText(textJoinedFromSegments)
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const textStrippedFromTags = decodeHtmlEntitiesForTranscriptText(
    paragraphInnerHtml.replace(/<[^>]+>/g, ""),
  )
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return textStrippedFromTags;
}

/**
 * 目的: timedtext XML 文字列をパースしてキュー配列にする
 * 入力: timedTextXmlString — YouTube から取得した XML（string）
 * 出力: 時系列の TranscriptCue 配列（末尾で start 昇順ソート）
 * 副作用: なし
 * エラー発生時の挙動: パース不能でも例外にせず空配列を返す（呼び出し側でメッセージ表示）
 */
export function parseYouTubeTimedTextXmlString(
  timedTextXmlString: string,
): TranscriptCue[] {
  const parsedCueList: TranscriptCue[] = [];
  for (const match of timedTextXmlString.matchAll(transcriptTextElementPattern)) {
    const startSeconds = Number.parseFloat(match[1]);
    const durationSeconds = Number.parseFloat(match[2]);
    const rawInnerText = match[3] ?? "";
    const normalizedInnerText = decodeHtmlEntitiesForTranscriptText(rawInnerText)
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (Number.isNaN(startSeconds) || Number.isNaN(durationSeconds)) {
      continue;
    }
    parsedCueList.push({
      startSeconds,
      endSeconds: startSeconds + Math.max(durationSeconds, 0.05),
      text: normalizedInnerText,
    });
  }

  if (parsedCueList.length === 0) {
    for (const match of timedTextXmlString.matchAll(transcriptParagraphElementPattern)) {
      const startTimeMilliseconds = Number.parseInt(match[1], 10);
      const durationMilliseconds = Number.parseInt(match[2], 10);
      const paragraphInnerHtml = match[3] ?? "";
      const normalizedParagraphText =
        buildDisplayTextFromSrv3ParagraphInnerHtml(paragraphInnerHtml);
      if (
        Number.isNaN(startTimeMilliseconds) ||
        Number.isNaN(durationMilliseconds) ||
        !normalizedParagraphText
      ) {
        continue;
      }
      const startSeconds = startTimeMilliseconds / 1000;
      const endSeconds = (startTimeMilliseconds + Math.max(durationMilliseconds, 50)) / 1000;
      parsedCueList.push({
        startSeconds,
        endSeconds,
        text: normalizedParagraphText,
      });
    }
  }

  parsedCueList.sort((firstCue, secondCue) => firstCue.startSeconds - secondCue.startSeconds);
  return parsedCueList;
}

/*
 * ファイル概要: timedtext XML パーサ
 * 入出力の概要: XML string → TranscriptCue[]
 * 依存関係の一覧: @/types/youtubeEnglishLearningViewer, ./decodeHtmlEntitiesForTranscriptText
 */
