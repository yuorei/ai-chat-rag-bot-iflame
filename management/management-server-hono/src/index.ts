import { Hono, Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { Auth, WorkersKVStoreSingle } from 'firebase-auth-cloudflare-workers'
import {
  DEFAULT_COLORS,
  DEFAULT_LABELS,
  DEFAULT_WIDGET_BUTTON,
  DEFAULT_WIDGET_WINDOW,
  DEFAULT_WIDGET_BANNER,
  ThemeSettings,
  WidgetSettings,
  ChatUISettings,
} from '../../../shared/constants/ui-defaults'

type D1Result<T = unknown> = {
  results?: T[]
  success: boolean
  error?: string
  meta?: {
    duration?: number
    changes?: number
    last_row_id?: number
  }
}

type D1PreparedStatement = {
  bind: (...values: any[]) => D1PreparedStatement
  first: <T = unknown>() => Promise<T | null>
  all: <T = unknown>() => Promise<D1Result<T>>
  run: <T = unknown>() => Promise<D1Result<T>>
}

type D1Database = {
  prepare: (query: string) => D1PreparedStatement
  batch: <T = unknown>(statements: D1PreparedStatement[]) => Promise<D1Result<T>[]>
}

type Bindings = {
  DB: D1Database
  FIREBASE_AUTH_CACHE: KVNamespace
  FIREBASE_PROJECT_ID: string
  MGMT_ADMIN_API_KEY?: string
  MGMT_FLASK_BASE_URL?: string
  MGMT_ALLOWED_ORIGINS?: string
  MGMT_COOKIE_SECURE?: string
  MGMT_MAX_UPLOAD_MB?: string
  MGMT_HTTP_TIMEOUT_SEC?: string
  ASSETS_BUCKET: R2Bucket
  ASSETS_PUBLIC_URL?: string
}

type Variables = {
  user?: FirebaseUser
  config?: Config
}

type Config = {
  adminAPIKey: string
  flaskBaseURL: string
  maxUploadBytes: number
  requestTimeoutSec: number
  allowedOrigins: string[]
  cookieSecure: boolean
}

type FirebaseUser = {
  uid: string
  email: string
  email_verified: boolean
}

type ChatProfile = {
  id: string
  target: string
  targets: string[]
  target_type: string
  display_name: string
  system_prompt: string
  created_at: string
  updated_at: string
}

type KnowledgeAsset = {
  id: string
  chat_id: string
  type: string
  title?: string
  source_url?: string
  original_filename?: string
  storage_path?: string
  status: string
  embedding_count: number
  error_message?: string
  created_at: string
  updated_at: string
}

// ChatUISettings, ThemeSettings, WidgetSettings are imported from shared/constants/ui-defaults

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', async (c, next) => {
  c.set('config', loadConfig(c.env))
  const cfg = getConfig(c)
  const origin = c.req.header('Origin') || ''
  if (originAllowed(origin, cfg.allowedOrigins)) {
    c.header('Access-Control-Allow-Origin', origin)
    c.header('Access-Control-Allow-Credentials', 'true')
  }
  c.header('Vary', 'Origin')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-API-Key')
  c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204)
  }
  return next()
})

app.get('/health', (c) => c.json({ status: 'ok' }))

app.get('/api/auth/me', async (c) => {
  const user = await authenticate(c)
  if (!user) {
    return jsonError(c, 401, 'unauthorized')
  }
  return c.json({
    user: {
      id: user.uid,
      email: user.email
    }
  })
})

app.post('/api/auth/logout', (c) => {
  clearSessionCookie(c)
  return c.json({ ok: true })
})

app.get('/api/chats', async (c) => {
  const authResult = await ensureAdminOrUser(c)
  if (authResult instanceof Response) return authResult

  try {
    // API Key: 全件取得（server-to-server用）、Firebase認証: 自分のデータのみ
    const userId = authResult.isApiKey ? null : (c.get('user') as FirebaseUser).uid
    const chats = await fetchChats(c, userId)
    return c.json({ chats })
  } catch (err) {
    console.error(err)
    return serverError(c)
  }
})

app.post('/api/chats', async (c) => {
  const guard = await ensureAuthenticatedUser(c)
  if (guard) return guard
  const user = c.get('user') as FirebaseUser

  const payload = await readJson<{
    id: string
    target?: string
    targets?: string[]
    target_type?: string
    display_name?: string
    system_prompt?: string
  }>(c)
  if (!payload) {
    return jsonError(c, 400, 'invalid json')
  }

  const id = sanitizeAlias(payload.id)
  if (!id) {
    return jsonError(c, 400, 'id is required')
  }
  const targetType = normalizeTargetType(payload.target_type)
  const targets = normalizeTargets(payload.targets, payload.target, targetType)
  if (targets.length === 0) {
    return jsonError(c, 400, 'at least one target is required')
  }
  const displayName = (payload.display_name || '').trim() || id
  const systemPrompt = payload.system_prompt || ''
  const ownerUserId = user.uid

  try {
    const statements = [
      c.env.DB.prepare(
        `INSERT INTO chat_profiles (id, target, target_type, display_name, system_prompt, owner_user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind(id, targets[0], targetType, displayName, systemPrompt, ownerUserId),
      ...targets.map((t) =>
        c.env.DB.prepare(
          `INSERT INTO chat_targets (chat_id, target, created_at)
           VALUES (?, ?, datetime('now'))`
        ).bind(id, t)
      )
    ]
    await c.env.DB.batch(statements)
    const chat = await fetchChat(c, id)
    return c.json(chat, 201)
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return jsonError(c, 409, 'id or target already exists')
    }
    console.error(err)
    return serverError(c)
  }
})

app.get('/api/chats/:id', async (c) => {
  const guard = await ensureAuthenticatedUser(c)
  if (guard) return guard
  const user = c.get('user') as FirebaseUser
  const id = sanitizeAlias(c.req.param('id'))
  try {
    const chat = await fetchChatIfOwned(c, id, user.uid)
    if (!chat) {
      return jsonError(c, 404, 'chat not found')
    }
    return c.json(chat)
  } catch (err) {
    console.error(err)
    return serverError(c)
  }
})

app.put('/api/chats/:id', async (c) => {
  const guard = await ensureAuthenticatedUser(c)
  if (guard) return guard
  const user = c.get('user') as FirebaseUser
  const id = sanitizeAlias(c.req.param('id'))
  const payload = await readJson<{
    target?: string
    targets?: string[]
    target_type?: string
    display_name?: string
    system_prompt?: string
  }>(c)
  if (!payload) {
    return jsonError(c, 400, 'invalid json')
  }

  try {
    // 所有者チェック
    const current = await fetchChatIfOwned(c, id, user.uid)
    if (!current) {
      return jsonError(c, 404, 'chat not found')
    }

    const sets: string[] = []
    const params: any[] = []
    let nextTargetType = current.target_type
    let targetsProvided = false
    let newTargets: string[] = []

    if (payload.target_type !== undefined) {
      nextTargetType = normalizeTargetType(payload.target_type)
      sets.push('target_type = ?')
      params.push(nextTargetType)
    }
    if (payload.targets !== undefined) {
      targetsProvided = true
      newTargets = normalizeTargets(payload.targets, undefined, nextTargetType)
    }
    if (payload.target !== undefined) {
      targetsProvided = true
      newTargets = normalizeTargets(undefined, payload.target, nextTargetType)
    }
    if (targetsProvided && newTargets.length === 0) {
      return jsonError(c, 400, 'at least one target is required')
    }
    if (targetsProvided) {
      sets.push('target = ?')
      params.push(newTargets[0])
    }
    if (payload.display_name !== undefined) {
      sets.push('display_name = ?')
      params.push((payload.display_name || '').trim())
    }
    if (payload.system_prompt !== undefined) {
      sets.push('system_prompt = ?')
      params.push(payload.system_prompt || '')
    }

    if (sets.length === 0) {
      return c.json({ updated: false })
    }
    sets.push("updated_at = datetime('now')")
    // 所有者チェック付きで更新
    const sql = `UPDATE chat_profiles SET ${sets.join(', ')} WHERE id = ? AND owner_user_id = ?`
    params.push(id, user.uid)

    const res = await c.env.DB.prepare(sql).bind(...params).run()
    if (res.meta?.changes === 0) {
      return jsonError(c, 404, 'chat not found')
    }

    if (targetsProvided) {
      await replaceTargets(c, id, newTargets)
    }

    const chat = await fetchChatIfOwned(c, id, user.uid)
    return c.json(chat)
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return jsonError(c, 409, 'target already exists')
    }
    console.error(err)
    return serverError(c)
  }
})

app.delete('/api/chats/:id', async (c) => {
  const guard = await ensureAuthenticatedUser(c)
  if (guard) return guard
  const user = c.get('user') as FirebaseUser
  const id = sanitizeAlias(c.req.param('id'))

  try {
    // 所有者チェック付きで削除
    const res = await c.env.DB.prepare('DELETE FROM chat_profiles WHERE id = ? AND owner_user_id = ?').bind(id, user.uid).run()
    if (!res.meta || res.meta.changes === 0) {
      return jsonError(c, 404, 'chat not found')
    }
    return c.json({ deleted: true })
  } catch (err) {
    console.error(err)
    return serverError(c)
  }
})

// UI Settings endpoints
app.get('/api/chats/:id/ui-settings', async (c) => {
  const guard = await ensureAuthenticatedUser(c)
  if (guard) return guard
  const user = c.get('user') as FirebaseUser
  const id = sanitizeAlias(c.req.param('id'))

  try {
    // 所有者チェック
    const chat = await fetchChatIfOwned(c, id, user.uid)
    if (!chat) {
      return jsonError(c, 404, 'chat not found')
    }

    const settings = await fetchUISettings(c, id)
    return c.json(settings || getDefaultUISettings(id))
  } catch (err) {
    console.error(err)
    return serverError(c)
  }
})

app.put('/api/chats/:id/ui-settings', async (c) => {
  const guard = await ensureAuthenticatedUser(c)
  if (guard) return guard
  const user = c.get('user') as FirebaseUser
  const id = sanitizeAlias(c.req.param('id'))

  const payload = await readJson<{
    theme_settings?: ThemeSettings
    widget_settings?: WidgetSettings
  }>(c)
  if (!payload) {
    return jsonError(c, 400, 'invalid json')
  }

  try {
    // 所有者チェック
    const chat = await fetchChatIfOwned(c, id, user.uid)
    if (!chat) {
      return jsonError(c, 404, 'chat not found')
    }

    await upsertUISettings(c, id, payload.theme_settings || {}, payload.widget_settings || {})
    const settings = await fetchUISettings(c, id)
    return c.json(settings)
  } catch (err) {
    console.error(err)
    return serverError(c)
  }
})

// Button Image Upload
app.post('/api/chats/:id/button-image', async (c) => {
  const guard = await ensureAuthenticatedUser(c)
  if (guard) return guard
  const user = c.get('user') as FirebaseUser
  const chatId = sanitizeAlias(c.req.param('id'))

  try {
    const chat = await fetchChatIfOwned(c, chatId, user.uid)
    if (!chat) {
      return jsonError(c, 404, 'chat not found')
    }

    const form = await c.req.formData()
    const image = form.get('image')
    if (!(image instanceof File)) {
      return jsonError(c, 400, 'image file is required')
    }

    const maxSize = 1024 * 1024 // 1MB
    if (image.size > maxSize) {
      return jsonError(c, 400, 'image size must be under 1MB')
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(image.type)) {
      return jsonError(c, 400, 'invalid image format (allowed: png, jpg, gif, webp, svg)')
    }

    const extMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg'
    }
    const ext = extMap[image.type] || 'png'

    // Delete old images first
    const extensions = ['png', 'jpg', 'gif', 'webp', 'svg']
    for (const oldExt of extensions) {
      try {
        await c.env.ASSETS_BUCKET.delete(`chat/${chatId}/button.${oldExt}`)
      } catch {
        // Ignore delete errors
      }
    }

    const key = `chat/${chatId}/button.${ext}`
    await c.env.ASSETS_BUCKET.put(key, await image.arrayBuffer(), {
      httpMetadata: { contentType: image.type }
    })

    // Generate public URL
    const publicUrl = c.env.ASSETS_PUBLIC_URL
      ? `${c.env.ASSETS_PUBLIC_URL}/${key}`
      : `https://ai-chat-assets.${c.env.FIREBASE_PROJECT_ID || 'default'}.r2.cloudflarestorage.com/${key}`

    // Update widget_settings with imageUrl
    const settings = await fetchUISettings(c, chatId) || getDefaultUISettings(chatId)
    const widgetSettings = settings.widget_settings || {}
    widgetSettings.button = { ...widgetSettings.button, imageUrl: publicUrl }
    await upsertUISettings(c, chatId, settings.theme_settings || {}, widgetSettings)

    return c.json({ imageUrl: publicUrl, size: image.size })
  } catch (err) {
    console.error(err)
    return serverError(c)
  }
})

// Button Image Delete
app.delete('/api/chats/:id/button-image', async (c) => {
  const guard = await ensureAuthenticatedUser(c)
  if (guard) return guard
  const user = c.get('user') as FirebaseUser
  const chatId = sanitizeAlias(c.req.param('id'))

  try {
    const chat = await fetchChatIfOwned(c, chatId, user.uid)
    if (!chat) {
      return jsonError(c, 404, 'chat not found')
    }

    // Delete all possible image extensions
    const extensions = ['png', 'jpg', 'gif', 'webp', 'svg']
    for (const ext of extensions) {
      try {
        await c.env.ASSETS_BUCKET.delete(`chat/${chatId}/button.${ext}`)
      } catch {
        // Ignore delete errors
      }
    }

    // Clear imageUrl from widget_settings
    const settings = await fetchUISettings(c, chatId)
    if (settings) {
      const widgetSettings = settings.widget_settings || {}
      if (widgetSettings.button) {
        delete widgetSettings.button.imageUrl
      }
      await upsertUISettings(c, chatId, settings.theme_settings || {}, widgetSettings)
    }

    return c.json({ deleted: true })
  } catch (err) {
    console.error(err)
    return serverError(c)
  }
})

app.get('/api/knowledge', async (c) => {
  const guard = await ensureAuthenticatedUser(c)
  if (guard) return guard
  const user = c.get('user') as FirebaseUser
  const chatId = (c.req.query('chat_id') || '').trim()

  try {
    const items = await listKnowledge(c, chatId, user.uid)
    return c.json({ items })
  } catch (err) {
    console.error(err)
    return serverError(c)
  }
})

app.post('/api/knowledge/files', async (c) => {
  const guard = await ensureAuthenticatedUser(c)
  if (guard) return guard
  const user = c.get('user') as FirebaseUser
  const cfg = getConfig(c)

  try {
    const form = await c.req.formData()
    const chatKey = pickFirstNonEmpty([
      form.get('chat_id'),
      form.get('domain'),
      form.get('target')
    ])
    const titleRaw = form.get('title')
    const title = typeof titleRaw === 'string' ? titleRaw.trim() : ''
    if (!chatKey || typeof chatKey !== 'string') {
      return jsonError(c, 400, 'chat_id or target is required')
    }
    // 所有者チェック
    const chat = await resolveChatIfOwned(c, chatKey, user.uid)
    if (!chat) {
      return jsonError(c, 404, 'chat not found')
    }

    const file = form.get('file')
    if (!(file instanceof File)) {
      return jsonError(c, 400, 'file is required')
    }
    if (file.size > cfg.maxUploadBytes) {
      return jsonError(c, 400, 'ファイルサイズが大きすぎます')
    }

    const recordId = await insertKnowledge(
      c,
      chat.id,
      'file',
      title,
      '',
      file.name,
      file.name,
      'pending'
    )
    await updateKnowledgeStatus(c, recordId, 'processing', '', file.name)

    try {
      const backend = await forwardFileToFlask(c, chat.id, file)
      await updateKnowledgeStatus(c, recordId, 'succeeded', '', file.name)
      return c.json({ id: recordId, status: 'succeeded', backend })
    } catch (err) {
      await updateKnowledgeStatus(c, recordId, 'failed', (err as Error).message, file.name)
      return jsonError(c, 502, 'Pythonサーバーへの送信に失敗しました: ' + (err as Error).message)
    }
  } catch (err) {
    console.error(err)
    return serverError(c)
  }
})

app.post('/api/knowledge/urls', async (c) => {
  const guard = await ensureAuthenticatedUser(c)
  if (guard) return guard
  const user = c.get('user') as FirebaseUser

  const payload = await readJson<{
    chat_id?: string
    url?: string
    title?: string
    target?: string
  }>(c)
  if (!payload) {
    return jsonError(c, 400, 'invalid json')
  }
  const key = (payload.chat_id || payload.target || '').trim()
  if (!key || !payload.url || !payload.url.trim()) {
    return jsonError(c, 400, 'chat_id (or target) and url are required')
  }

  try {
    // 所有者チェック
    const chat = await resolveChatIfOwned(c, key, user.uid)
    if (!chat) {
      return jsonError(c, 404, 'chat not found')
    }
    const recordId = await insertKnowledge(
      c,
      chat.id,
      'url',
      payload.title || '',
      payload.url,
      '',
      '',
      'processing'
    )
    try {
      const backend = await forwardJSONToFlask(c, '/api/fetch_url', {
        chat_id: chat.id,
        url: payload.url,
        title: payload.title || ''
      })
      await updateKnowledgeStatus(c, recordId, 'succeeded', '', '')
      return c.json({ id: recordId, status: 'succeeded', backend })
    } catch (err) {
      await updateKnowledgeStatus(c, recordId, 'failed', (err as Error).message, '')
      return jsonError(c, 502, 'Pythonサーバーへの送信に失敗しました: ' + (err as Error).message)
    }
  } catch (err) {
    console.error(err)
    return serverError(c)
  }
})

app.post('/api/knowledge/texts', async (c) => {
  const guard = await ensureAuthenticatedUser(c)
  if (guard) return guard
  const user = c.get('user') as FirebaseUser

  const payload = await readJson<{
    chat_id?: string
    target?: string
    title?: string
    content?: string
    category?: string
    tags?: string[]
  }>(c)
  if (!payload) {
    return jsonError(c, 400, 'invalid json')
  }
  const key = (payload.chat_id || payload.target || '').trim()
  if (!key || !payload.content || !payload.content.trim()) {
    return jsonError(c, 400, 'chat_id (or target) and content are required')
  }

  try {
    // 所有者チェック
    const chat = await resolveChatIfOwned(c, key, user.uid)
    if (!chat) {
      return jsonError(c, 404, 'chat not found')
    }
    const recordId = await insertKnowledge(
      c,
      chat.id,
      'text',
      payload.title || '',
      '',
      '',
      '',
      'processing'
    )
    try {
      const backend = await forwardJSONToFlask(c, '/api/add_knowledge', {
        chat_id: chat.id,
        title: payload.title || '',
        content: payload.content || '',
        category: payload.category || '',
        tags: payload.tags || []
      })
      await updateKnowledgeStatus(c, recordId, 'succeeded', '', '')
      return c.json({ id: recordId, status: 'succeeded', backend })
    } catch (err) {
      await updateKnowledgeStatus(c, recordId, 'failed', (err as Error).message, '')
      return jsonError(c, 502, 'Pythonサーバーへの送信に失敗しました: ' + (err as Error).message)
    }
  } catch (err) {
    console.error(err)
    return serverError(c)
  }
})

export default app

// --- helpers ---

function getConfig(c: any): Config {
  const cached = typeof c.get === 'function' ? c.get('config') : undefined
  if (cached) return cached
  const loaded = loadConfig(c.env)
  if (typeof c.set === 'function') {
    c.set('config', loaded)
  }
  return loaded
}

function loadConfig(env: Bindings): Config {
  const get = (key: keyof Bindings, def: string) => {
    const raw = env[key]
    if (typeof raw === 'string' && raw.trim() !== '') {
      return raw.trim()
    }
    return def
  }
  const getBool = (key: keyof Bindings, def: boolean) => {
    const raw = get(key, '')
    if (!raw) return def
    if (['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())) return true
    if (['0', 'false', 'no', 'off'].includes(raw.toLowerCase())) return false
    return def
  }
  const getInt = (key: keyof Bindings, def: number) => {
    const raw = get(key, '')
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : def
  }

  const maxUploadMB = getInt('MGMT_MAX_UPLOAD_MB', 50)
  return {
    adminAPIKey: get('MGMT_ADMIN_API_KEY', ''),
    flaskBaseURL: get('MGMT_FLASK_BASE_URL', 'http://localhost:8000').replace(/\/+$/, ''),
    maxUploadBytes: maxUploadMB * 1024 * 1024,
    requestTimeoutSec: getInt('MGMT_HTTP_TIMEOUT_SEC', 120),
    allowedOrigins: parseOrigins(get('MGMT_ALLOWED_ORIGINS', 'http://localhost:5173')),
    cookieSecure: getBool('MGMT_COOKIE_SECURE', false)
  }
}

async function readJson<T>(c: { req: Request }): Promise<T | null> {
  try {
    return await c.req.json<T>()
  } catch (err) {
    console.error('failed to parse json', err)
    return null
  }
}

function jsonError(c: any, status: number, message: string) {
  return c.json({ error: message }, status)
}

function serverError(c: any) {
  return jsonError(c, 500, 'internal server error')
}

function validateEmailVerified(user: FirebaseUser, c: any): Response | null {
  if (!user.email_verified) {
    return jsonError(c, 403, 'email verification required')
  }
  return null
}

// API Key または Firebase 認証を許可（GET用 - server-to-server通信対応）
async function ensureAdminOrUser(c: any): Promise<{ isApiKey: boolean } | Response> {
  const cfg = getConfig(c)
  const provided = c.req.header('X-Admin-API-Key') || c.req.query('admin_api_key') || ''
  if (cfg.adminAPIKey && provided === cfg.adminAPIKey) {
    return { isApiKey: true }
  }
  const user = await authenticate(c)
  if (!user) {
    return jsonError(c, 401, 'login required')
  }
  const verificationError = validateEmailVerified(user, c)
  if (verificationError) return verificationError
  c.set('user', user)
  return { isApiKey: false }
}

// Firebase 認証のみ必須（変更操作用）
async function ensureAuthenticatedUser(c: any): Promise<Response | null> {
  const user = await authenticate(c)
  if (!user) {
    return jsonError(c, 401, 'login required')
  }
  const verificationError = validateEmailVerified(user, c)
  if (verificationError) return verificationError
  c.set('user', user)
  return null
}

function getFirebaseAuth(env: Bindings): Auth {
  const keyStore = WorkersKVStoreSingle.getOrInitialize('firebase_public_keys', env.FIREBASE_AUTH_CACHE)
  return Auth.getOrInitialize(env.FIREBASE_PROJECT_ID, keyStore)
}

async function authenticate(c: any): Promise<FirebaseUser | null> {
  const authHeader = c.req.header('Authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return null
  }
  const idToken = authHeader.slice(7).trim()
  if (!idToken) {
    return null
  }

  try {
    const auth = getFirebaseAuth(c.env)
    const decodedToken = await auth.verifyIdToken(idToken)
    return {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      email_verified: decodedToken.email_verified || false
    }
  } catch (err) {
    console.error('Firebase token verification failed:', err)
    return null
  }
}

function clearSessionCookie(c: any) {
  deleteCookie(c, 'mgmt_session', { path: '/' })
}

// userId を指定するとそのユーザーのチャットのみ、null なら全件（API Key用）
async function fetchChats(c: any, userId: string | null): Promise<ChatProfile[]> {
  const baseQuery = `SELECT cp.id, cp.target, cp.target_type, cp.display_name, cp.system_prompt, cp.created_at, cp.updated_at,
            GROUP_CONCAT(DISTINCT ct.target) AS targets
     FROM chat_profiles cp
     LEFT JOIN chat_targets ct ON ct.chat_id = cp.id`

  let result
  if (userId) {
    result = await c.env.DB.prepare(
      `${baseQuery}
       WHERE cp.owner_user_id = ?
       GROUP BY cp.id, cp.target, cp.target_type, cp.display_name, cp.system_prompt, cp.created_at, cp.updated_at
       ORDER BY cp.created_at ASC`
    ).bind(userId).all<any>()
  } else {
    result = await c.env.DB.prepare(
      `${baseQuery}
       GROUP BY cp.id, cp.target, cp.target_type, cp.display_name, cp.system_prompt, cp.created_at, cp.updated_at
       ORDER BY cp.created_at ASC`
    ).all<any>()
  }
  const rows = result.results || []
  return rows.map(mapChatRow)
}

async function fetchChat(c: any, id: string): Promise<ChatProfile | null> {
  const row = await c.env.DB.prepare(
    `SELECT cp.id, cp.target, cp.target_type, cp.display_name, cp.system_prompt, cp.created_at, cp.updated_at,
            GROUP_CONCAT(DISTINCT ct.target) AS targets
     FROM chat_profiles cp
     LEFT JOIN chat_targets ct ON ct.chat_id = cp.id
     WHERE cp.id = ?
     GROUP BY cp.id, cp.target, cp.target_type, cp.display_name, cp.system_prompt, cp.created_at, cp.updated_at`
  )
    .bind(id)
    .first<any>()
  if (!row) return null
  return mapChatRow(row)
}

// 所有者チェック付きでチャットを取得
async function fetchChatIfOwned(c: any, id: string, userId: string): Promise<ChatProfile | null> {
  const row = await c.env.DB.prepare(
    `SELECT cp.id, cp.target, cp.target_type, cp.display_name, cp.system_prompt, cp.created_at, cp.updated_at,
            GROUP_CONCAT(DISTINCT ct.target) AS targets
     FROM chat_profiles cp
     LEFT JOIN chat_targets ct ON ct.chat_id = cp.id
     WHERE cp.id = ? AND cp.owner_user_id = ?
     GROUP BY cp.id, cp.target, cp.target_type, cp.display_name, cp.system_prompt, cp.created_at, cp.updated_at`
  )
    .bind(id, userId)
    .first<any>()
  if (!row) return null
  return mapChatRow(row)
}

async function fetchChatByTarget(c: any, target: string): Promise<ChatProfile | null> {
  const row = await c.env.DB.prepare(
    `SELECT cp.id, cp.target, cp.target_type, cp.display_name, cp.system_prompt, cp.created_at, cp.updated_at,
            GROUP_CONCAT(DISTINCT ct.target) AS targets
     FROM chat_targets ct
     JOIN chat_profiles cp ON cp.id = ct.chat_id
     WHERE ct.target = ?
     GROUP BY cp.id, cp.target, cp.target_type, cp.display_name, cp.system_prompt, cp.created_at, cp.updated_at`
  )
    .bind(target)
    .first<any>()
  if (!row) return null
  return mapChatRow(row)
}

// 所有者チェック付きでターゲットからチャットを取得
async function fetchChatByTargetIfOwned(c: any, target: string, userId: string): Promise<ChatProfile | null> {
  const row = await c.env.DB.prepare(
    `SELECT cp.id, cp.target, cp.target_type, cp.display_name, cp.system_prompt, cp.created_at, cp.updated_at,
            GROUP_CONCAT(DISTINCT ct.target) AS targets
     FROM chat_targets ct
     JOIN chat_profiles cp ON cp.id = ct.chat_id
     WHERE ct.target = ? AND cp.owner_user_id = ?
     GROUP BY cp.id, cp.target, cp.target_type, cp.display_name, cp.system_prompt, cp.created_at, cp.updated_at`
  )
    .bind(target, userId)
    .first<any>()
  if (!row) return null
  return mapChatRow(row)
}

async function resolveChat(c: any, key: string): Promise<ChatProfile | null> {
  const sanitized = sanitizeAlias(key)
  if (sanitized) {
    const byId = await fetchChat(c, sanitized)
    if (byId) return byId
  }
  const normalizedTarget = normalizeTarget(key, 'web')
  if (normalizedTarget) {
    const byTarget = await fetchChatByTarget(c, normalizedTarget)
    if (byTarget) return byTarget
  }
  return null
}

// 所有者チェック付きでチャットを解決
async function resolveChatIfOwned(c: any, key: string, userId: string): Promise<ChatProfile | null> {
  const sanitized = sanitizeAlias(key)
  if (sanitized) {
    const byId = await fetchChatIfOwned(c, sanitized, userId)
    if (byId) return byId
  }
  const normalizedTarget = normalizeTarget(key, 'web')
  if (normalizedTarget) {
    const byTarget = await fetchChatByTargetIfOwned(c, normalizedTarget, userId)
    if (byTarget) return byTarget
  }
  return null
}

function mapChatRow(row: any): ChatProfile {
  const targetsRaw = (row.targets as string) || ''
  const targets = targetsRaw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  return {
    id: row.id as string,
    target: row.target as string,
    target_type: row.target_type as string,
    display_name: row.display_name as string,
    system_prompt: row.system_prompt as string,
    targets,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  }
}

async function replaceTargets(c: any, chatId: string, targets: string[]) {
  const statements = [
    c.env.DB.prepare('DELETE FROM chat_targets WHERE chat_id = ?').bind(chatId),
    ...targets.map((t) =>
      c.env.DB.prepare(
        `INSERT INTO chat_targets (chat_id, target, created_at)
         VALUES (?, ?, datetime('now'))`
      ).bind(chatId, t)
    )
  ]
  await c.env.DB.batch(statements)
}

// userId を指定するとそのユーザーのチャットに紐づくナレッジのみ取得
async function listKnowledge(c: any, chatId: string, userId: string): Promise<KnowledgeAsset[]> {
  const base = `SELECT ka.id, ka.chat_id, ka.type, ka.title, ka.source_url, ka.original_filename,
                       ka.storage_path, ka.status, ka.embedding_count, ka.error_message, ka.created_at, ka.updated_at
                FROM knowledge_assets ka
                JOIN chat_profiles cp ON cp.id = ka.chat_id
                WHERE cp.owner_user_id = ?`

  let stmt
  if (chatId && chatId.trim() !== '') {
    stmt = c.env.DB.prepare(`${base} AND ka.chat_id = ? ORDER BY ka.created_at DESC LIMIT 200`).bind(userId, chatId)
  } else {
    stmt = c.env.DB.prepare(`${base} ORDER BY ka.created_at DESC LIMIT 200`).bind(userId)
  }

  const result = await stmt.all<any>()
  const rows = result.results || []
  return rows.map((row) => ({
    id: row.id as string,
    chat_id: row.chat_id as string,
    type: row.type as string,
    title: row.title || undefined,
    source_url: row.source_url || undefined,
    original_filename: row.original_filename || undefined,
    storage_path: row.storage_path || undefined,
    status: row.status as string,
    embedding_count: Number(row.embedding_count ?? 0),
    error_message: row.error_message || undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  }))
}

async function insertKnowledge(
  c: any,
  chatId: string,
  kind: string,
  title: string,
  srcURL: string,
  origName: string,
  storagePath: string,
  status: string
): Promise<string> {
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO knowledge_assets (id, chat_id, type, title, source_url, original_filename, storage_path, status, created_at, updated_at)
     VALUES (?, ?, ?, NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''), ?, datetime('now'), datetime('now'))`
  )
    .bind(id, chatId, kind, title, srcURL, origName, storagePath, status)
    .run()
  return id
}

async function updateKnowledgeStatus(
  c: any,
  id: string,
  status: string,
  errMsg: string,
  storagePath: string
): Promise<void> {
  await c.env.DB.prepare(
    `UPDATE knowledge_assets
     SET status = ?,
         error_message = NULLIF(?, ''),
         storage_path = COALESCE(NULLIF(?, ''), storage_path),
         updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(status, errMsg, storagePath, id)
    .run()
}

async function forwardFileToFlask(c: any, chatId: string, file: File) {
  const cfg = getConfig(c)
  const form = new FormData()
  form.append('file', file, file.name)
  form.append('chat_id', chatId)

  const reqInit: RequestInit = {
    method: 'POST',
    body: form,
    headers: {}
  }
  return doRequest(c, cfg.flaskBaseURL + '/api/upload_file', reqInit)
}

async function forwardJSONToFlask(c: any, path: string, payload: Record<string, any>) {
  const cfg = getConfig(c)
  const reqInit: RequestInit = {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  }
  return doRequest(c, cfg.flaskBaseURL + path, reqInit)
}

async function doRequest(c: any, url: string, init: RequestInit) {
  const cfg = getConfig(c)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.requestTimeoutSec * 1000)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    const text = await res.text()
    const parsed = text ? safeParseJSON(text) : null
    if (!res.ok) {
      const msg = (parsed && parsed.error) || res.statusText
      throw new Error(`backend returned ${res.status}: ${msg}`)
    }
    return parsed
  } finally {
    clearTimeout(timer)
  }
}

function safeParseJSON(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function normalizeTargetType(kind?: string): string {
  const val = (kind || '').trim().toLowerCase()
  if (!val) return 'web'
  if (val === 'web' || val === 'line' || val === 'custom') return val
  return 'custom'
}

function normalizeTarget(target: string | undefined, targetType: string): string {
  const kind = normalizeTargetType(targetType)
  if (kind === 'web') {
    return normalizeDomain(target || '')
  }
  return (target || '').trim()
}

function normalizeTargets(list?: string[], fallback?: string, targetType?: string): string[] {
  const kind = normalizeTargetType(targetType)
  const values = [...(list || []), fallback || '']
  const seen = new Set<string>()
  const out: string[] = []
  for (const val of values) {
    const norm = normalizeTarget(val, kind)
    if (!norm || seen.has(norm)) continue
    seen.add(norm)
    out.push(norm)
  }
  return out
}

function normalizeDomain(value: string): string {
  let v = value.trim().toLowerCase()
  if (!v) return ''
  v = v.replace(/^https?:\/\//, '')
  if (v.includes('/')) v = v.split('/')[0]
  if (v.includes(':')) v = v.split(':')[0]
  v = v.replace(/^\.+/, '')
  if (v.startsWith('www.')) v = v.slice(4)
  return v
}

function sanitizeAlias(id: string | undefined): string {
  if (!id) return ''
  let v = id.trim().toLowerCase()
  v = v.replace(/[\\/]/g, '-')
  v = v.replace(/\s+/g, '-')
  return v
}

function parseOrigins(raw: string): string[] {
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) {
    return ['http://localhost:5173']
  }
  return Array.from(new Set(parts))
}

function originAllowed(origin: string, allowed: string[]): boolean {
  if (!origin) return false
  return allowed.includes('*') || allowed.includes(origin)
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes('unique')
}

function pickFirstNonEmpty(values: (FormDataEntryValue | null)[]): FormDataEntryValue | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim() !== '') return v
    if (v instanceof File && v.name) return v
  }
  return null
}

// --- UI Settings helpers ---

function getDefaultThemeSettings(): ThemeSettings {
  return {
    colors: DEFAULT_COLORS,
    labels: DEFAULT_LABELS
  }
}

function getDefaultWidgetSettings(): WidgetSettings {
  return {
    button: DEFAULT_WIDGET_BUTTON,
    window: DEFAULT_WIDGET_WINDOW,
    banner: DEFAULT_WIDGET_BANNER
  }
}

async function fetchUISettings(c: any, chatId: string): Promise<ChatUISettings | null> {
  const row = await c.env.DB.prepare(
    `SELECT id, chat_id, theme_settings, widget_settings, created_at, updated_at
     FROM chat_ui_settings
     WHERE chat_id = ?`
  )
    .bind(chatId)
    .first<any>()

  if (!row) return null

  // Parse theme_settings with proper error handling
  const parsedTheme = safeParseJSON(row.theme_settings || '{}')
  if (!parsedTheme) {
    console.error(`Failed to parse theme_settings for chatId: ${chatId}, using defaults`)
  }
  // Use parsed settings only if they exist and are non-empty, otherwise use defaults
  const theme_settings = (parsedTheme && Object.keys(parsedTheme).length > 0) 
    ? parsedTheme 
    : getDefaultThemeSettings()

  // Parse widget_settings with proper error handling
  const parsedWidget = safeParseJSON(row.widget_settings || '{}')
  if (!parsedWidget) {
    console.error(`Failed to parse widget_settings for chatId: ${chatId}, using defaults`)
  }
  // Use parsed settings only if they exist and are non-empty, otherwise use defaults
  const widget_settings = (parsedWidget && Object.keys(parsedWidget).length > 0) 
    ? parsedWidget 
    : getDefaultWidgetSettings()

  return {
    id: row.id as string,
    chat_id: row.chat_id as string,
    theme_settings,
    widget_settings,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  }
}

function getDefaultUISettings(chatId: string): ChatUISettings {
  return {
    id: '',
    chat_id: chatId,
    theme_settings: getDefaultThemeSettings(),
    widget_settings: getDefaultWidgetSettings(),
    created_at: '',
    updated_at: ''
  }
}

async function upsertUISettings(
  ctx: Context<{ Bindings: Bindings; Variables: Variables }>,
  chatId: string,
  themeSettings: ThemeSettings,
  widgetSettings: WidgetSettings
): Promise<void> {
  const existing = await fetchUISettings(ctx, chatId)
  const themeJson = JSON.stringify(themeSettings)
  const widgetJson = JSON.stringify(widgetSettings)

  if (existing) {
    await ctx.env.DB.prepare(
      `UPDATE chat_ui_settings
       SET theme_settings = ?, widget_settings = ?, updated_at = datetime('now')
       WHERE chat_id = ?`
    )
      .bind(themeJson, widgetJson, chatId)
      .run()
  } else {
    const id = crypto.randomUUID()
    await ctx.env.DB.prepare(
      `INSERT INTO chat_ui_settings (id, chat_id, theme_settings, widget_settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
      .bind(id, chatId, themeJson, widgetJson)
      .run()
  }
}
