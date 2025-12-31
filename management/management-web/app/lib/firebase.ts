import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

declare global {
  interface Window {
    __FIREBASE_CONFIG__?: {
      apiKey: string
      authDomain: string
      projectId: string
    }
    __APP_URL__?: string
  }
}

function getFirebaseConfig() {
  if (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__) {
    return window.__FIREBASE_CONFIG__
  }
  // フォールバック（開発用）
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  }
}

export function getAppUrl(): string {
  if (typeof window !== 'undefined') {
    return window.__APP_URL__ || window.location.origin
  }
  return ''
}

// クライアントサイドのみで初期化（遅延初期化）
let _app: FirebaseApp | null = null
let _auth: Auth | null = null

function getFirebaseApp(): FirebaseApp {
  if (typeof window === 'undefined') {
    throw new Error('Firebase can only be initialized on the client side')
  }
  if (!_app) {
    const firebaseConfig = getFirebaseConfig()
    if (!firebaseConfig.apiKey) {
      throw new Error('Firebase API key is not configured')
    }
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  }
  return _app
}

export function getFirebaseAuth(): Auth {
  if (!_auth) {
    _auth = getAuth(getFirebaseApp())
  }
  return _auth
}
