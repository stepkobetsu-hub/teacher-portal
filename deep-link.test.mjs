import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const script=fs.readFileSync(new URL('./script.js',import.meta.url),'utf8');

test('授業報告と出退くんQRをviewパラメータで直接起動できる',()=>{
  assert.match(script,/view === "attendance"\) showAttendance\(\)/);
  assert.match(script,/view === "qr"\) showNyutaikun\(\)/);
});

test('view未指定時は既存トップ表示を変更しない',()=>{
  assert.match(script,/if \(view === "attendance"\)/);
  assert.match(script,/if \(view === "qr"\)/);
  assert.doesNotMatch(script,/else show/);
});

test('トップへ戻ると直接起動指定をURLから外す',()=>{
  assert.match(script,/history\.replaceState\(null, "", window\.location\.pathname\)/);
  assert.match(script,/function backHome\(\) \{\s*clearRequestedView\(\)/);
});
