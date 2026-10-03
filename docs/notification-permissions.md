# 確認メール送信先設定の中央権限管理

2026-10-04: 講師登録サーバーの既存デプロイをバージョン43に更新。

対象の中央アプリIDは `teacher-registration-notification-settings`。送信先の取得は `view`、保存は `settings` を確認する。認証サーバーで検証したスタッフIDと権限を使い、中央権限管理の保存済み設定を毎回照会する。確認不能の場合は拒否する。初期値は権限2以上。教室限定設定では全教室共通のメール設定を許可しない。

Apps Scriptの `handleTeacherRegistration_` で、NotificationSettingsGet/Saveのみ従来の固定権限判定から分離し、`trCentralNotificationSettings_(body, save)` に振り分ける。この関数はSupabaseの認証済み照会結果が許可の場合のみ既存の `trAuditNotificationSettings_` を呼ぶ。その他の承認処理の権限条件を維持する。

通常の新規登録申請はスタッフ権限不要のまま。公開ブラウザーから中央管理用の秘密キーを扱わない。中継設定・サービスキーはサーバーの保護された設定にのみ保存する。

本番Apps Scriptの統合コードはGitHubの旧版 `gas/TeacherRegistration.gs` と異なるため、旧ファイルを本番へ全体上書きしないこと。
