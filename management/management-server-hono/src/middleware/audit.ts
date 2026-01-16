/**
 * Audit logging middleware for Hono
 * Logs all mutating operations to BigQuery
 */

import type { Context, Next } from 'hono'
import { BigQueryLogger, createAuditEvent } from '../bq-logger'

type FirebaseUser = {
  uid: string
  email: string
  email_verified: boolean
}

// Map HTTP method to action
function methodToAction(method: string): string {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'create'
    case 'PUT':
    case 'PATCH':
      return 'update'
    case 'DELETE':
      return 'delete'
    default:
      return 'read'
  }
}

// Extract resource type from path
function extractResourceType(path: string): string {
  const patterns: [RegExp, string][] = [
    [/^\/api\/chats\/[^/]+\/ui-settings/, 'ui_settings'],
    [/^\/api\/chats\/[^/]+\/button-image/, 'button_image'],
    [/^\/api\/chats\/[^/]+\/suggestions/, 'suggestions'],
    [/^\/api\/chats/, 'chat'],
    [/^\/api\/knowledge\/files/, 'knowledge_file'],
    [/^\/api\/knowledge\/urls/, 'knowledge_url'],
    [/^\/api\/knowledge\/texts/, 'knowledge_text'],
    [/^\/api\/knowledge/, 'knowledge'],
  ]

  for (const [pattern, type] of patterns) {
    if (pattern.test(path)) {
      return type
    }
  }
  return 'unknown'
}

// Extract resource ID from path
function extractResourceId(path: string): string | undefined {
  // Match paths like /api/chats/:id or /api/knowledge/:id
  const match = path.match(/\/api\/(?:chats|knowledge)\/([^/]+)(?:\/|$)/)
  if (match && match[1]) {
    // Don't return if it's a sub-resource path like /files, /urls, /texts
    if (['files', 'urls', 'texts', 'ui-settings', 'button-image', 'suggestions'].includes(match[1])) {
      return undefined
    }
    return match[1]
  }
  return undefined
}

export function createAuditMiddleware(logger: BigQueryLogger) {
  return async (c: Context, next: Next) => {
    const startTime = Date.now()
    const method = c.req.method
    const path = c.req.path

    // Execute the handler first
    await next()

    // Only log mutating operations
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return
    }

    // Skip health checks and auth endpoints
    if (path === '/health' || path.startsWith('/api/auth/')) {
      return
    }

    // Get user from context (set by authentication middleware)
    const user = c.get('user') as FirebaseUser | undefined
    if (!user) {
      // Only log authenticated requests
      return
    }

    const event = createAuditEvent({
      userId: user.uid,
      userEmail: user.email,
      action: methodToAction(method),
      resourceType: extractResourceType(path),
      resourceId: extractResourceId(path),
      chatId: c.req.query('chat_id') || extractResourceId(path),
      requestMethod: method,
      requestPath: path,
      responseStatus: c.res.status,
      responseDurationMs: Date.now() - startTime,
      clientIp: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '',
      userAgent: c.req.header('User-Agent') || '',
    })

    // Non-blocking log - use waitUntil to ensure it completes
    c.executionCtx.waitUntil(
      logger.log(event).then(() => logger.flush())
    )
  }
}
