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
