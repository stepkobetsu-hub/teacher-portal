# 講師給与処理 GAS

`salary.html` から参照される給与関連GASのうち、管理者向け「講師給与処理」画面は次の構成です。

- Apps ScriptプロジェクトID: `1kDea6Mg9dhPLFiFjRJ9ynNyYTTG5YOgW7mg0mHXX9V3fecZjLxe3c9Tn`
- 既存の本番デプロイID: `AKfycbxCpmgFEPaEl7EykKO1MrXDCQqg_-ww8AgfVLa6WSpD6sYuUj4pG07DwI0KizIUI7Z9`
- 講師給与処理URL: `https://script.google.com/macros/s/AKfycbxCpmgFEPaEl7EykKO1MrXDCQqg_-ww8AgfVLa6WSpD6sYuUj4pG07DwI0KizIUI7Z9/exec?app=payroll`
- 正本Spreadsheet ID: `1L5aFDXAmfUDkBg8d7X3WqJgMhdMq5tM5sfUZ2G-M58E`
- 正本Spreadsheet URL: `https://docs.google.com/spreadsheets/d/1L5aFDXAmfUDkBg8d7X3WqJgMhdMq5tM5sfUZ2G-M58E/edit`

## 更新方法

1. 上記Apps Scriptプロジェクトを編集する。
2. 動作確認後に新しいバージョンを作成する。
3. 新規デプロイを作らず、上記の既存デプロイIDを新バージョンへ更新する。
4. `?app=payroll` を開き、「Google Sheetで確認・訂正」が正本Spreadsheetを新しいタブで直接開くことを確認する。

右上リンクは、GAS iframeの現在URLや `google.script.run` の完了を使って組み立てず、正本Spreadsheetの通常URLを `<a target="_blank" rel="noopener noreferrer">` に直接指定します。

## 完成版の重複整理（2026-10-01）

本番の `講師給与処理.gs` の `writeCompletedSheet_` は、出力配列の作成後・シートへの書き込み前に `gas/PayrollCompletedDedup.gs` と同じ `deduplicateCompletedRows_` を実行する。

1. A/B/C/T/U/V/W が一致する行は先頭のみ保持する。
2. 残った行の A（講師番号）/C（日付）/W（コマ数）が一致する場合も先頭のみ保持する。別講師・別コマ数は保持する。
3. `originalIndexes` から元の行番号→新しい行番号の対応を作り、フォームのみの黄色背景・判定なし/×のR列背景を更新する。
4. P列の数式を新しい行番号で再作成し、書き込む。
5. 戻り値は `{ rows, removedExact, removedSameDay }`。`buildCompletedSheet_` の完了表示は実際の出力件数と重複整理件数を表示する。

原因は `processGoogleForm_` が同一日の回答をすべて読み込み、`alignRows_` が講師・日付ごとに勤怠とフォームの多い方の件数分を並べること。フォーム回答が勤怠件数を上回ると、空の勤怠と同一の授業回答を持つ追加行を作る。出力前の同一内容確認がなかった。

提供されたAB.xlsxのAに対する検証：320件→221件、重複99件を整理。元A189行（講師7067・2026-09-30）は保持する。Bの220件との差はユーザーが誤って削除したこの1件。勤務時間は元の打刻から再計算する。フォーム回答や元の打刻シートは変更しない。

本番反映：バージョン61（2026-10-01）。アプリの②で2026年9月・221行・重複99行を確認済み。
