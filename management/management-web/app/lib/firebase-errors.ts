/**
 * Firebase Auth エラーコードを日本語のユーザーフレンドリーなメッセージにマッピングします
 */

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  // 認証エラー
  'auth/invalid-email': 'メールアドレスの形式が正しくありません',
  'auth/user-disabled': 'このアカウントは無効化されています',
  'auth/user-not-found': 'このメールアドレスは登録されていません',
  'auth/wrong-password': 'パスワードが正しくありません',
  'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
  'auth/weak-password': 'パスワードが弱すぎます。より強力なパスワードを設定してください',
  'auth/operation-not-allowed': 'この操作は許可されていません',
  'auth/account-exists-with-different-credential': '同じメールアドレスで別の認証方法が既に登録されています',
  
  // メールリンク認証エラー
  'auth/invalid-action-code': '認証リンクが無効です。既に使用済みか、有効期限が切れています',
  'auth/expired-action-code': '認証リンクの有効期限が切れています。新しいリンクをリクエストしてください',
  'auth/invalid-continue-uri': '不正な継続URLです',
  'auth/unauthorized-continue-uri': '継続URLが許可されていません',
  'auth/missing-continue-uri': '継続URLが指定されていません',
  
  // ネットワーク・接続エラー
  'auth/network-request-failed': 'ネットワークエラーが発生しました。接続を確認してください',
  'auth/timeout': 'リクエストがタイムアウトしました。もう一度お試しください',
  'auth/too-many-requests': 'リクエストが多すぎます。しばらく時間をおいてから再度お試しください',
  
  // その他のエラー
  'auth/invalid-api-key': 'APIキーが無効です',
  'auth/app-deleted': 'アプリケーションが削除されています',
  'auth/invalid-user-token': 'ユーザートークンが無効です。再度ログインしてください',
  'auth/user-token-expired': 'セッションの有効期限が切れました。再度ログインしてください',
  'auth/null-user': 'ユーザーが見つかりません',
  'auth/invalid-tenant-id': 'テナントIDが無効です',
  'auth/tenant-id-mismatch': 'テナントIDが一致しません',
  'auth/requires-recent-login': 'この操作には再ログインが必要です',
  'auth/credential-already-in-use': 'この認証情報は既に別のアカウントに関連付けられています',
  'auth/invalid-credential': '認証情報が無効です',
  'auth/missing-email': 'メールアドレスが指定されていません',
  'auth/internal-error': '内部エラーが発生しました。しばらく時間をおいてから再度お試しください',
  'auth/admin-restricted-operation': '管理者のみが実行できる操作です',
}

/**
 * Firebase Auth エラーを日本語メッセージに変換します
 * @param error - Firebase Auth エラーオブジェクト
 * @returns 日本語のエラーメッセージ
 */
export function getFirebaseErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return '予期しないエラーが発生しました'
  }

  const err = error as { code?: string; message?: string }
  
  // Firebase エラーコードからメッセージを取得
  if (err.code && err.code in FIREBASE_ERROR_MESSAGES) {
    return FIREBASE_ERROR_MESSAGES[err.code]
  }

  // エラーコードが未定義の場合は、エラーメッセージをそのまま返す
  // ただし、Firebase エラーの場合はもう少しユーザーフレンドリーなメッセージにする
  if (err.code && err.code.startsWith('auth/')) {
    return `認証エラーが発生しました (${err.code})`
  }

  // その他のエラー
  return err.message || '予期しないエラーが発生しました'
}
