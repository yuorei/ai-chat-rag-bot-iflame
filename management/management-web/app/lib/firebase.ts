import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getAuth, type Auth } from "firebase/auth"

function getMetaContent(name: string): string {
  if (typeof document === 'undefined') {
    return ''
  }
  // Whitelist of allowed meta tag names for security
  const allowedNames = ['firebase-api-key', 'firebase-auth-domain', 'firebase-project-id', 'app-url']
  if (!allowedNames.includes(name)) {
    return ''
  }
  const meta = document.querySelector(`meta[name="${name}"]`)
  return meta?.getAttribute('content') || ''
}

function getFirebaseConfig() {
  if (typeof window !== 'undefined') {
    const apiKey = getMetaContent('firebase-api-key')
    const authDomain = getMetaContent('firebase-auth-domain')
    const projectId = getMetaContent('firebase-project-id')

    if (apiKey && authDomain && projectId) {
      return { apiKey, authDomain, projectId }
    }
  }
  // フォールバック（開発用）
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  }
}

export function getAppUrl(): string {
  if (typeof window !== 'undefined') {
    const appUrl = getMetaContent('app-url')
    return appUrl || window.location.origin
  }
  return ""
}

// クライアントサイドのみで初期化（遅延初期化）
let _app: FirebaseApp | null = null
let _auth: Auth | null = null

function getFirebaseApp(): FirebaseApp {
  if (typeof window === "undefined") {
    throw new Error("Firebase can only be initialized on the client side")
  }
  if (!_app) {
    const firebaseConfig = getFirebaseConfig()
    if (!firebaseConfig.apiKey) {
      throw new Error("Firebase API key is not configured")
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
