import { Hono } from 'hono'
import { cors } from 'hono/cors'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Bindings = {
  DB: D1Database
  PYTHON_SERVER_URL: string
  ALLOWED_ORIGINS: string
}

type Variables = {
  chatProfile: ChatProfile | null
}

interface ChatProfile {
  id: string
  target: string
  target_type: string
  display_name: string
  system_prompt: string
  owner_user_id: string | null
  created_at: string
  updated_at: string
}

interface ChatTarget {
  id: number
  chat_id: string
  target: string
  created_at: string
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ---------------------------------------------------------------------------
// Helper: Normalize target (domain)
// ---------------------------------------------------------------------------
function normalizeTarget(target: string): string {
  let normalized = target.toLowerCase().trim()
  // Remove protocol
  normalized = normalized.replace(/^https?:\/\//, '')
  // Remove port
  normalized = normalized.replace(/:\d+$/, '')
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '')
  // Remove www prefix
  normalized = normalized.replace(/^www\./, '')
  return normalized
}

// ---------------------------------------------------------------------------
// Helper: Check if origin is registered in database
// ---------------------------------------------------------------------------
async function isOriginAllowed(db: D1Database, origin: string): Promise<boolean> {
  if (!origin) return false

  const normalized = normalizeTarget(origin)
  if (!normalized) return false

  // Check chat_targets table
  const targetRow = await db
    .prepare('SELECT 1 FROM chat_targets WHERE target = ? LIMIT 1')
    .bind(normalized)
    .first()
  if (targetRow) return true

  // Check chat_profiles.target directly
  const profileRow = await db
    .prepare('SELECT 1 FROM chat_profiles WHERE target = ? AND target_type = ? LIMIT 1')
    .bind(normalized, 'web')
    .first()
  if (profileRow) return true

  return false
}

// ---------------------------------------------------------------------------
// Paths that don't require Origin header (health checks, etc.)
// ---------------------------------------------------------------------------
const PUBLIC_PATHS = ['/', '/health']

// ---------------------------------------------------------------------------
// CORS Middleware - Only allow registered domains
// ---------------------------------------------------------------------------
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin') || ''
  const allowedOrigins = c.env.ALLOWED_ORIGINS
  const path = new URL(c.req.url).pathname

  // If ALLOWED_ORIGINS is '*', check database for registered domains
  if (allowedOrigins === '*') {
    // Allow public paths without Origin (for health checks, monitoring)
    if (!origin && PUBLIC_PATHS.includes(path)) {
      return next()
    }

    // Block requests without Origin header (curl, etc.)
    if (!origin) {
      return c.json({ error: 'Origin header is required' }, 403)
    }

    const isAllowed = await isOriginAllowed(c.env.DB, origin)

    // Block unregistered origins
    if (!isAllowed) {
      return c.json({ error: 'Origin not allowed' }, 403)
    }

    const corsMiddleware = cors({
      origin: origin,
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposeHeaders: ['Content-Length'],
      maxAge: 86400,
      credentials: true,
    })
    return corsMiddleware(c, next)
  }

  // Static list of allowed origins
  const corsMiddleware = cors({
    origin: allowedOrigins.split(','),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
    credentials: true,
  })
  return corsMiddleware(c, next)
})

// ---------------------------------------------------------------------------
// Helper: Resolve chat profile by target/domain
// ---------------------------------------------------------------------------
async function resolveChatProfile(
  db: D1Database,
  target: string
): Promise<ChatProfile | null> {
  const normalized = normalizeTarget(target)

  // 1. Try to find in chat_targets table
  const targetRow = await db
    .prepare('SELECT chat_id FROM chat_targets WHERE target = ?')
    .bind(normalized)
    .first<{ chat_id: string }>()

  if (targetRow) {
    const profile = await db
      .prepare('SELECT * FROM chat_profiles WHERE id = ?')
      .bind(targetRow.chat_id)
      .first<ChatProfile>()
    return profile
  }

  // 2. Try to find in chat_profiles.target directly
  const profile = await db
    .prepare('SELECT * FROM chat_profiles WHERE target = ?')
    .bind(normalized)
    .first<ChatProfile>()

  return profile
}

// ---------------------------------------------------------------------------
// GET /health - Health check
// ---------------------------------------------------------------------------
app.get('/health', async (c) => {
  try {
    // Check D1 connection
    await c.env.DB.prepare('SELECT 1').first()
    return c.json({ status: 'ok', service: 'cfw-iframe-server' })
  } catch (error) {
    return c.json({ status: 'error', message: 'Database connection failed' }, 500)
  }
})

// ---------------------------------------------------------------------------
// GET /init - Get chat profile by domain/target
// Query params: target (domain or origin URL)
// ---------------------------------------------------------------------------
app.get('/init', async (c) => {
  const target = c.req.query('target') || c.req.header('Origin') || c.req.header('Referer')

  if (!target) {
    return c.json(
      { error: 'target parameter or Origin header is required' },
      400
    )
  }

  try {
    const profile = await resolveChatProfile(c.env.DB, target)

    if (!profile) {
      return c.json({ error: 'Chat profile not found for this domain' }, 404)
    }

    // Return public information only (no sensitive data)
    return c.json({
      chat_id: profile.id,
      display_name: profile.display_name,
      target_type: profile.target_type,
    })
  } catch (error) {
    console.error('Error in /init:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// POST /init - Alternative init with body
// ---------------------------------------------------------------------------
app.post('/init', async (c) => {
  let target: string | null = null

  try {
    const body = await c.req.json<{ target?: string; origin?: string }>()
    target = body.target || body.origin || null
  } catch {
    // JSON parse failed, try headers
  }

  if (!target) {
    target = c.req.header('Origin') || c.req.header('Referer') || null
  }

  if (!target) {
    return c.json(
      { error: 'target in body or Origin header is required' },
      400
    )
  }

  try {
    const profile = await resolveChatProfile(c.env.DB, target)

    if (!profile) {
      return c.json({ error: 'Chat profile not found for this domain' }, 404)
    }

    return c.json({
      chat_id: profile.id,
      display_name: profile.display_name,
      target_type: profile.target_type,
    })
  } catch (error) {
    console.error('Error in POST /init:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// POST /chat - Forward chat message to Python server
// ---------------------------------------------------------------------------
app.post('/chat', async (c) => {
  let body: { message?: string; chat_id?: string; target?: string; page_context?: unknown; only_page_context?: boolean }

  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { message, chat_id, target, page_context, only_page_context } = body

  if (!message) {
    return c.json({ error: 'message is required' }, 400)
  }

  // Resolve chat_id from target if not provided
  let resolvedChatId = chat_id
  if (!resolvedChatId && target) {
    const profile = await resolveChatProfile(c.env.DB, target)
    if (profile) {
      resolvedChatId = profile.id
    }
  }

  // If still no chat_id, try to get from Origin header
  if (!resolvedChatId) {
    const origin = c.req.header('Origin') || c.req.header('Referer')
    if (origin) {
      const profile = await resolveChatProfile(c.env.DB, origin)
      if (profile) {
        resolvedChatId = profile.id
      }
    }
  }

  if (!resolvedChatId) {
    return c.json(
      { error: 'chat_id or target is required to identify the chat profile' },
      400
    )
  }

  try {
    // Forward to Python server
    const pythonUrl = `${c.env.PYTHON_SERVER_URL}/api/chat`
    const response = await fetch(pythonUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        chat_id: resolvedChatId,
        page_context,
        only_page_context,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Python server error:', response.status, errorText)
      return c.json(
        { error: 'Chat service unavailable', details: errorText },
        response.status as 400 | 500 | 502 | 503
      )
    }

    const data = await response.json()
    return c.json(data)
  } catch (error) {
    console.error('Error forwarding to Python server:', error)
    return c.json({ error: 'Failed to connect to chat service' }, 502)
  }
})

// ---------------------------------------------------------------------------
// GET /profile/:chatId - Get public profile info by chat ID
// ---------------------------------------------------------------------------
app.get('/profile/:chatId', async (c) => {
  const chatId = c.req.param('chatId')

  try {
    const profile = await c.env.DB
      .prepare('SELECT * FROM chat_profiles WHERE id = ?')
      .bind(chatId)
      .first<ChatProfile>()

    if (!profile) {
      return c.json({ error: 'Chat profile not found' }, 404)
    }

    return c.json({
      chat_id: profile.id,
      display_name: profile.display_name,
      target_type: profile.target_type,
    })
  } catch (error) {
    console.error('Error in /profile/:chatId:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
app.get('/', (c) => {
  return c.json({
    service: 'cfw-iframe-server',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      init: 'GET /init?target=<domain> or POST /init',
      chat: 'POST /chat',
      profile: 'GET /profile/:chatId',
    },
  })
})

export default app
