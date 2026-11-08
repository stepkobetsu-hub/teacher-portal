# 授業報告の保存確認

対象は講師ポータルの `script.js` の `API_URL`。既存デプロイを更新する。保存先は「講師出勤確認（回答）」の「フォームの回答 1」A〜H列。既存の `submitAttendanceApi_` で追加し、照合は H/C/D/E/G 列を使う。備考は重複判定の対象外。

## Apps Scriptの更新

1. [既存プロジェクト](https://script.google.com/home/projects/129pV3ximCdST0nWMJAXu8yvCgtFNx6zKc8QBaDcRMo6ks8hmSRK41_9E/edit) に `attendance-sheet-verification.gs` を追加する。
2. 既存 `doGet` の `submitAttendance` 分岐内の呼び出しを `attendanceLegacySubmit_(params)` に変更する。既存の `getTeacher`、`saveQrData`、`submitAttendanceApi_` は維持する。
3. 既存デプロイIDを新バージョンへ更新し、`attendanceHealth` のPOSTと本人の履歴照会を確認する。その後、GitHub Pagesの画面を更新する。
4. 切り戻す際は画面側を先に戻す。既存クライアントは旧ルートで利用できる。

履歴と新しい送信ルートは講師マスターAJ列のパスワードで認証する。端末には90日有効の署名付きセッションを保持する。パスワード変更により既発行セッションが失効する。ログアウト時は端末からセッションを削除する。入退室との互換性のため、既存のコードベースのQR関連ルートと旧報告送信ルートは存続する。

同じ講師・日付・校舎・コマ数・授業の組み合わせは既存の報告として扱う。送信中に応答が途切れた場合、ブラウザーは照合だけを行う。
