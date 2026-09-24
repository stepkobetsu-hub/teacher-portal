/** Staff session guard used by the student QR administration API. */
function requireQrStaffSession_(data) {
  const token = String((data && data.sessionToken) || '').trim();
  const staffLoginId = String((data && data.staffLoginId) || '').trim();
  if (!token || !staffLoginId) throw new Error('スタッフログインが必要です。');
  const response = UrlFetchApp.fetch('https://script.google.com/macros/s/AKfycbypkUc0MqZ07E7pZRglNPeRM56WbCcuWaLpRzi9bVFcPklHDxaaLC7GfzG6ozTGCbEX/exec', {
    method: 'post',
    contentType: 'text/plain;charset=utf-8',
    payload: JSON.stringify({ action: String((data && data.staffSessionKind) || '') === 'systemPortal' ? 'verifySystemPortal' : 'studentQrVerify', sessionToken: token }),
    muteHttpExceptions: true,
    followRedirects: true
  });
  let verified;
  try { verified = JSON.parse(response.getContentText()); } catch (error) { verified = null; }
  const permissionLevel = String((verified && verified.permissionLevel) || '').trim();
  if (!verified || !verified.success ||
      String(verified.loginId || verified.code || '').trim() !== staffLoginId ||
      ['2', '3', '4'].indexOf(permissionLevel) < 0) {
    throw new Error('スタッフログインの有効期限が切れました。もう一度ログインしてください。');
  }
  return verified;
}
