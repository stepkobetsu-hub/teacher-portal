# 既存の `コード.gs` への追加箇所

本番の `handleTeacherRegistration_(body)` にだけ以下を反映する。既存の登録・通知関数を置き換えない。

スタッフ認証対象の配列に `teacherRegistrationApprovalPreview` と `teacherRegistrationApproveRequest` を追加する。

```javascript
if(['teacherRegistrationInvite','teacherRegistrationNotificationSettingsGet','teacherRegistrationNotificationSettingsSave','teacherRegistrationApprovalPreview','teacherRegistrationApproveRequest'].includes(action))staff=requireQrStaffSession_(body);
```

`teacherRegistrationNotificationSettingsSave` の分岐の直後に追加する。

```javascript
if(action==='teacherRegistrationSubmitRequest')return taSubmitRequest_(body);
if(action==='teacherRegistrationApprovalPreview')return taApprovalPreview_(body,staff);
if(action==='teacherRegistrationApproveRequest')return taApproveRequest_(body,staff);
```

`TeacherApprovalExtension.gs` は同じApps Scriptプロジェクトに別ファイルとして追加する。
