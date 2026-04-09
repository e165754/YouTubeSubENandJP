/**
 * 目的: YouTube Data API の ISO8601 duration を一覧表示用の短い文字列にする
 * 主な役割: PT1H2M3S → 1:02:03 のような表記
 * 他ファイルとの関係: searchYouTubeVideos から利用
 */

/**
 * 目的: ISO8601 duration を人間可読な再生時間へ変換する
 * 入力: iso8601Duration — API の contentDetails.duration（string）
 * 出力: "H:MM:SS" または "M:SS"（string）
 * 副作用: なし
 * エラー発生時の挙動: パース不能なら "--:--"
 */
export function formatIso8601DurationForDisplay(iso8601Duration: string): string {
  const match = iso8601Duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) {
    return "--:--";
  }
  const hoursPart = match[1] ? Number.parseInt(match[1], 10) : 0;
  const minutesPart = match[2] ? Number.parseInt(match[2], 10) : 0;
  const secondsPart = match[3] ? Number.parseInt(match[3], 10) : 0;
  const totalMinutes = hoursPart * 60 + minutesPart;
  const paddedSeconds = String(secondsPart).padStart(2, "0");
  if (hoursPart > 0) {
    const paddedMinutes = String(minutesPart).padStart(2, "0");
    return `${hoursPart}:${paddedMinutes}:${paddedSeconds}`;
  }
  return `${totalMinutes}:${paddedSeconds}`;
}

/*
 * ファイル概要: 再生時間フォーマッタ
 * 入出力の概要: ISO string → display string
 * 依存関係の一覧: なし
 */
