import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { 
  DEFAULT_COLORS, 
  DEFAULT_LABELS, 
  DEFAULT_WIDGET_BUTTON, 
  DEFAULT_WIDGET_WINDOW 
} from '../../shared/constants/ui-defaults'

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
// CORS Middleware
// ---------------------------------------------------------------------------
app.use('*', cors({
  origin: (origin, c) => {
    // If no origin (e.g., server-to-server requests), allow
    if (!origin) return '*'

    const allowedOrigins = c.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return origin
    }

    // Check for wildcard patterns (e.g., *.example.com)
    for (const allowed of allowedOrigins) {
      if (allowed === '*') {
        return origin
      }
      if (allowed.startsWith('*.')) {
        const suffix = allowed.slice(1) // Remove the *
        if (origin.endsWith(suffix) || origin === `https://${allowed.slice(2)}` || origin === `http://${allowed.slice(2)}`) {
          return origin
        }
      }
    }

    // Not allowed - return null to block
    return null
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: true,
}))

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
// GET /ui-settings - Get UI settings for a chat (public endpoint for iframe)
// Query params: chatId or target
// ---------------------------------------------------------------------------
app.get('/ui-settings', async (c) => {
  const chatId = c.req.query('chatId')
  const target = c.req.query('target') || c.req.header('Origin') || c.req.header('Referer')

  let resolvedChatId = chatId

  // Resolve chatId from target if not provided
  if (!resolvedChatId && target) {
    const profile = await resolveChatProfile(c.env.DB, target)
    if (profile) {
      resolvedChatId = profile.id
    }
  }

  if (!resolvedChatId) {
    return c.json({ error: 'chatId or target is required' }, 400)
  }

  try {
    const settings = await c.env.DB
      .prepare('SELECT theme_settings, widget_settings FROM chat_ui_settings WHERE chat_id = ?')
      .bind(resolvedChatId)
      .first<{ theme_settings: string; widget_settings: string }>()

    if (!settings) {
      // Return default settings if none configured
      return c.json({
        theme: {
          colors: DEFAULT_COLORS,
          labels: DEFAULT_LABELS
        },
        widget: {
          button: DEFAULT_WIDGET_BUTTON,
          window: DEFAULT_WIDGET_WINDOW
        }
      })
    }

    return c.json({
      theme: safeParseJSON(settings.theme_settings) || {
        colors: DEFAULT_COLORS,
        labels: DEFAULT_LABELS
      },
      widget: safeParseJSON(settings.widget_settings) || {
        button: DEFAULT_WIDGET_BUTTON,
        window: DEFAULT_WIDGET_WINDOW
      }
    })
  } catch (error) {
    console.error('Error in /ui-settings:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// Helper: Safe JSON parse
// ---------------------------------------------------------------------------
function safeParseJSON(text: string | null | undefined): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

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
      uiSettings: 'GET /ui-settings?chatId=<id> or ?target=<domain>',
    },
  })
})

export default app
