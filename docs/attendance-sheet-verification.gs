/**
 * 個別指導STEP 授業報告の保存先照合 (Apps Script 追加用)
 * 注意: このファイルだけでは機能しません。既存 doGet の action 分岐へ
 *   if (action === "verifyAttendanceSaved") return jsonpOutput_(verifyAttendanceSaved_(e.parameter), e.parameter.callback);
 * を組み込む必要があります。既存 JSONP 応答関数の名前に合わせてください。
 *
 * 対象: 講師給与シートの「完成版」タブ T～AA列。
 * T 氏名, U 出勤日, V 授業, W コマ数, X 備考, Y 勤務場所, Z タイムスタンプ, AA 講師コード
 * 応答は boolean と状態コードのみ。氏名・他講師の記録は公開しません。
 * 既存の認証/アクセス制御を必ず通した後に呼び出してください。
 */
function verifyAttendanceSaved_(params) {
  const code = String(params.code || '').trim();
  const workDate = String(params.workDate || '').trim(); // YYYY-MM-DD
  const place = String(params.place || '').trim();
  const koma = String(params.koma === 'その他' ? params.komaOther : params.koma || '').trim();
  const lessons = String(params.lessons || '').trim();
  if (!/^\d{4,8}$/.test(code) || !/^\d{4}-\d{2}-\d{2}$/.test(workDate) ||
      !place || !koma || !lessons) {
    return {ok:false, verified:false, status:'invalid_request'};
  }
  const ss = SpreadsheetApp.openById('1L5aFDXAmfUDkBg8d7X3WqJgMhdMq5tM5sfUZ2G-M58E');
  const sheet = ss.getSheetByName('完成版');
  if (!sheet) return {ok:false, verified:false, status:'sheet_unavailable'};
  const last = sheet.getLastRow();
  if (last < 2) return {ok:true, verified:false, status:'not_found'};
  const rows = sheet.getRange(2,20,last-1,8).getDisplayValues();
  const [, y, m, d] = workDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dateMatcher = new RegExp('^(?:'+Number(m)+'|'+m+')\\/(?:'+Number(d)+'|'+d+')$');
  const timeSegments = lessons.split('/').map(s=>s.trim().slice(0,5)).filter(Boolean);
  for (let i=rows.length-1; i>=0; i--) {
    const row=rows[i];
    if (String(row[7]).trim() !== code) continue;
    const rawDate=String(row[1]||'').trim();
    if (!(dateMatcher.test(rawDate) || rawDate===workDate || rawDate===y+'/'+Number(m)+'/'+Number(d))) continue;
    if (String(row[5]||'').trim() !== place) continue;
    if (String(row[3]||'').trim() !== koma) continue;
    const storedLessons=String(row[2]||'');
    if (!timeSegments.every(t=>storedLessons.includes(t.slice(0,5)))) continue;
    const stamp=String(row[6]||'');
    // 年が異なる同月同日を誤認しない。タイムスタンプに年がある場合のみ確定。
    const stampYear=(stamp.match(/(?:^|\D)(20\d{2})(?:\D|$)/)||[])[1] ||
      (stamp.match(/\/(20\d{2})(?:\s|$)/)||[])[1];
    if (!stampYear || stampYear !== y) continue;
    return {ok:true, verified:true, status:'saved'};
  }
  return {ok:true, verified:false, status:'not_found'};
}

/*
 * フロントエンド接続時に必要な条件
 * - APIの認証と既存のJSONP出力に統合してから有効化
 * - submitAttendance の成功応答だけで「シート保存確認済み」としない
 * - verifyAttendanceSaved の verified===true でのみ「保存先シート確認済み」と表示
 * - not_found は「未確認」と表示 (未送信とは断定しない)
 * - ログインが講師コードだけの場合、推測可能なコードで照会できないよう認証強化を検討
 * - 実際の送信先と同じスプレッドシート/タブか、導入前に突合
 */
