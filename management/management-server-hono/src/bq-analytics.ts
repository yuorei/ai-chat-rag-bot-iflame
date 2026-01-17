/**
 * BigQuery Analytics Reader for Cloudflare Workers
 * Uses BigQuery REST API with service account authentication
 */

import * as Sentry from '@sentry/cloudflare'

// Analytics response types
export interface AnalyticsSummary {
  date: string
  totalMessages: number
  uniqueSessions: number
  avgResponseTimeMs: number
  contextFoundRate: number
  errorRate: number
  totalTokensUsed: number
}

export interface AnalyticsOverview {
  totalMessages: number
  totalSessions: number
  avgResponseTimeMs: number
  errorRate: number
  contextFoundRate: number
  totalTokensUsed: number
}

export interface HourlyDistribution {
  hour: number
  messageCount: number
}

export interface DomainBreakdown {
  originDomain: string
  messageCount: number
  avgResponseTimeMs: number
}

export interface DeviceBreakdown {
  deviceType: string
  browser: string
  messageCount: number
}

export interface ChatMessage {
  eventId: string
  eventTimestamp: string
  chatId: string
  messageContent: string | null
  responseContent: string | null
  originDomain: string | null
  totalDurationMs: number | null
  tokensInput: number | null
  tokensOutput: number | null
  contextFound: boolean | null
  errorCode: string | null
}

export interface MessageListResponse {
  messages: ChatMessage[]
  totalCount: number
  hasMore: boolean
  nextOffset: number
}

interface ServiceAccountCredentials {
  type: string
  project_id: string
  private_key_id: string
  private_key: string
  client_email: string
  client_id: string
  auth_uri: string
  token_uri: string
  auth_provider_x509_cert_url: string
  client_x509_cert_url: string
}

interface BigQueryQueryResponse {
  kind: string
  schema?: {
    fields: Array<{ name: string; type: string }>
  }
  jobReference?: {
    projectId: string
    jobId: string
  }
  totalRows?: string
  rows?: Array<{
    f: Array<{ v: string | null }>
  }>
  jobComplete?: boolean
  errors?: Array<{ message: string }>
}

export class BigQueryAnalytics {
  private projectId: string
  private datasetId: string
  private credentials: ServiceAccountCredentials | null
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor(
    projectId: string,
    datasetId: string,
    serviceAccountKeyJson: string | undefined
  ) {
    this.projectId = projectId
    this.datasetId = datasetId

    if (serviceAccountKeyJson) {
      try {
        this.credentials = JSON.parse(serviceAccountKeyJson)
      } catch (err) {
        console.error('Failed to parse service account key JSON')
        Sentry.captureException(err, {
          extra: { context: 'BigQueryAnalytics constructor - service account key parse' },
        })
        this.credentials = null
      }
    } else {
      this.credentials = null
    }
  }

  isEnabled(): boolean {
    return this.credentials !== null && this.projectId !== ''
  }

  async getDailySummary(chatId: string, startDate: string, endDate: string): Promise<AnalyticsSummary[]> {
    if (!this.isEnabled()) return []

    // First try daily_chat_summary table
    const summaryQuery = `
      SELECT
        FORMAT_DATE('%Y-%m-%d', date) as date,
        total_messages,
        unique_sessions,
        avg_response_time_ms,
        context_found_rate,
        error_rate,
        total_tokens_used
      FROM \`${this.projectId}.${this.datasetId}.daily_chat_summary\`
      WHERE chat_id = @chatId
        AND date BETWEEN @startDate AND @endDate
      ORDER BY date ASC
    `

    try {
      const result = await this.executeQuery(summaryQuery, {
        chatId: { value: chatId, type: 'STRING' },
        startDate: { value: startDate, type: 'DATE' },
        endDate: { value: endDate, type: 'DATE' },
      })

      if (result.rows && result.rows.length > 0) {
        return result.rows.map((row) => ({
          date: row.f[0].v || '',
          totalMessages: parseInt(row.f[1].v || '0', 10),
          uniqueSessions: parseInt(row.f[2].v || '0', 10),
          avgResponseTimeMs: parseFloat(row.f[3].v || '0'),
          contextFoundRate: parseFloat(row.f[4].v || '0'),
          errorRate: parseFloat(row.f[5].v || '0'),
          totalTokensUsed: parseInt(row.f[6].v || '0', 10),
        }))
      }
    } catch (err) {
      console.error('daily_chat_summary query failed, falling back to chatbot_events:', err)
    }

    // Fallback: aggregate from chatbot_events
    const fallbackQuery = `
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE(event_timestamp)) as date,
        COUNT(*) as total_messages,
        COUNT(DISTINCT request_id) as unique_sessions,
        AVG(total_duration_ms) as avg_response_time_ms,
        SAFE_DIVIDE(COUNTIF(context_found = true), COUNT(*)) as context_found_rate,
        SAFE_DIVIDE(COUNTIF(error_code IS NOT NULL), COUNT(*)) as error_rate,
        SUM(COALESCE(tokens_input, 0) + COALESCE(tokens_output, 0)) as total_tokens_used
      FROM \`${this.projectId}.${this.datasetId}.chatbot_events\`
      WHERE chat_id = @chatId
        AND DATE(event_timestamp) BETWEEN @startDate AND @endDate
        AND event_type = 'chat_request'
      GROUP BY date
      ORDER BY date ASC
    `

    const result = await this.executeQuery(fallbackQuery, {
      chatId: { value: chatId, type: 'STRING' },
      startDate: { value: startDate, type: 'DATE' },
      endDate: { value: endDate, type: 'DATE' },
    })

    if (!result.rows) return []

    return result.rows.map((row) => ({
      date: row.f[0].v || '',
      totalMessages: parseInt(row.f[1].v || '0', 10),
      uniqueSessions: parseInt(row.f[2].v || '0', 10),
      avgResponseTimeMs: parseFloat(row.f[3].v || '0'),
      contextFoundRate: parseFloat(row.f[4].v || '0'),
      errorRate: parseFloat(row.f[5].v || '0'),
      totalTokensUsed: parseInt(row.f[6].v || '0', 10),
    }))
  }

  async getOverview(chatId: string, startDate: string, endDate: string): Promise<AnalyticsOverview> {
    if (!this.isEnabled()) {
      return {
        totalMessages: 0,
        totalSessions: 0,
        avgResponseTimeMs: 0,
        errorRate: 0,
        contextFoundRate: 0,
        totalTokensUsed: 0,
      }
    }

    const query = `
      SELECT
        COUNT(*) as total_messages,
        COUNT(DISTINCT request_id) as total_sessions,
        AVG(total_duration_ms) as avg_response_time_ms,
        SAFE_DIVIDE(COUNTIF(error_code IS NOT NULL), COUNT(*)) as error_rate,
        SAFE_DIVIDE(COUNTIF(context_found = true), COUNT(*)) as context_found_rate,
        SUM(COALESCE(tokens_input, 0) + COALESCE(tokens_output, 0)) as total_tokens_used
      FROM \`${this.projectId}.${this.datasetId}.chatbot_events\`
      WHERE chat_id = @chatId
        AND DATE(event_timestamp) BETWEEN @startDate AND @endDate
        AND event_type = 'chat_request'
    `

    const result = await this.executeQuery(query, {
      chatId: { value: chatId, type: 'STRING' },
      startDate: { value: startDate, type: 'DATE' },
      endDate: { value: endDate, type: 'DATE' },
    })

    if (!result.rows || result.rows.length === 0) {
      return {
        totalMessages: 0,
        totalSessions: 0,
        avgResponseTimeMs: 0,
        errorRate: 0,
        contextFoundRate: 0,
        totalTokensUsed: 0,
      }
    }

    const row = result.rows[0]
    return {
      totalMessages: parseInt(row.f[0].v || '0', 10),
      totalSessions: parseInt(row.f[1].v || '0', 10),
      avgResponseTimeMs: parseFloat(row.f[2].v || '0'),
      errorRate: parseFloat(row.f[3].v || '0'),
      contextFoundRate: parseFloat(row.f[4].v || '0'),
      totalTokensUsed: parseInt(row.f[5].v || '0', 10),
    }
  }

  async getHourlyDistribution(chatId: string, startDate: string, endDate: string): Promise<HourlyDistribution[]> {
    if (!this.isEnabled()) return []

    const query = `
      SELECT
        EXTRACT(HOUR FROM event_timestamp) as hour,
        COUNT(*) as message_count
      FROM \`${this.projectId}.${this.datasetId}.chatbot_events\`
      WHERE chat_id = @chatId
        AND DATE(event_timestamp) BETWEEN @startDate AND @endDate
        AND event_type = 'chat_request'
      GROUP BY hour
      ORDER BY hour
    `

    const result = await this.executeQuery(query, {
      chatId: { value: chatId, type: 'STRING' },
      startDate: { value: startDate, type: 'DATE' },
      endDate: { value: endDate, type: 'DATE' },
    })

    if (!result.rows) return []

    // Fill in missing hours with 0
    const hourlyMap = new Map<number, number>()
    for (let i = 0; i < 24; i++) {
      hourlyMap.set(i, 0)
    }

    for (const row of result.rows) {
      const hour = parseInt(row.f[0].v || '0', 10)
      const count = parseInt(row.f[1].v || '0', 10)
      hourlyMap.set(hour, count)
    }

    return Array.from(hourlyMap.entries()).map(([hour, messageCount]) => ({
      hour,
      messageCount,
    }))
  }

  async getDomainBreakdown(chatId: string, startDate: string, endDate: string): Promise<DomainBreakdown[]> {
    if (!this.isEnabled()) return []

    const query = `
      SELECT
        COALESCE(origin_domain, 'unknown') as origin_domain,
        COUNT(*) as message_count,
        AVG(total_duration_ms) as avg_response_time_ms
      FROM \`${this.projectId}.${this.datasetId}.chatbot_events\`
      WHERE chat_id = @chatId
        AND DATE(event_timestamp) BETWEEN @startDate AND @endDate
        AND event_type = 'chat_request'
      GROUP BY origin_domain
      ORDER BY message_count DESC
      LIMIT 10
    `

    const result = await this.executeQuery(query, {
      chatId: { value: chatId, type: 'STRING' },
      startDate: { value: startDate, type: 'DATE' },
      endDate: { value: endDate, type: 'DATE' },
    })

    if (!result.rows) return []

    return result.rows.map((row) => ({
      originDomain: row.f[0].v || 'unknown',
      messageCount: parseInt(row.f[1].v || '0', 10),
      avgResponseTimeMs: parseFloat(row.f[2].v || '0'),
    }))
  }

  async getDeviceBreakdown(chatId: string, startDate: string, endDate: string): Promise<DeviceBreakdown[]> {
    if (!this.isEnabled()) return []

    const query = `
      SELECT
        CASE
          WHEN REGEXP_CONTAINS(LOWER(user_agent), r'mobile|android|iphone|ipad|ipod') THEN 'Mobile'
          ELSE 'Desktop'
        END as device_type,
        CASE
          WHEN REGEXP_CONTAINS(LOWER(user_agent), r'edg/') THEN 'Edge'
          WHEN REGEXP_CONTAINS(LOWER(user_agent), r'chrome/') AND NOT REGEXP_CONTAINS(LOWER(user_agent), r'edg/') THEN 'Chrome'
          WHEN REGEXP_CONTAINS(LOWER(user_agent), r'safari/') AND NOT REGEXP_CONTAINS(LOWER(user_agent), r'chrome/') THEN 'Safari'
          WHEN REGEXP_CONTAINS(LOWER(user_agent), r'firefox/') THEN 'Firefox'
          ELSE 'Other'
        END as browser,
        COUNT(*) as message_count
      FROM \`${this.projectId}.${this.datasetId}.chatbot_events\`
      WHERE chat_id = @chatId
        AND DATE(event_timestamp) BETWEEN @startDate AND @endDate
        AND event_type = 'chat_request'
        AND user_agent IS NOT NULL
      GROUP BY device_type, browser
      ORDER BY message_count DESC
    `

    const result = await this.executeQuery(query, {
      chatId: { value: chatId, type: 'STRING' },
      startDate: { value: startDate, type: 'DATE' },
      endDate: { value: endDate, type: 'DATE' },
    })

    if (!result.rows) return []

    return result.rows.map((row) => ({
      deviceType: row.f[0].v || 'Unknown',
      browser: row.f[1].v || 'Unknown',
      messageCount: parseInt(row.f[2].v || '0', 10),
    }))
  }

  async getMessages(
    chatId: string,
    startDate: string,
    endDate: string,
    limit: number = 50,
    offset: number = 0,
    searchQuery?: string
  ): Promise<MessageListResponse> {
    if (!this.isEnabled()) {
      return { messages: [], totalCount: 0, hasMore: false, nextOffset: offset }
    }

    // First, get total count
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM \`${this.projectId}.${this.datasetId}.chatbot_events\`
      WHERE chat_id = @chatId
        AND DATE(event_timestamp) BETWEEN @startDate AND @endDate
        AND event_type = 'chat_request'
        AND (
          @searchQuery IS NULL
          OR @searchQuery = ''
          OR LOWER(COALESCE(message_content, '')) LIKE CONCAT('%', LOWER(@searchQuery), '%')
          OR LOWER(COALESCE(response_content, '')) LIKE CONCAT('%', LOWER(@searchQuery), '%')
        )
    `

    const countResult = await this.executeQuery(countQuery, {
      chatId: { value: chatId, type: 'STRING' },
      startDate: { value: startDate, type: 'DATE' },
      endDate: { value: endDate, type: 'DATE' },
      searchQuery: { value: searchQuery || '', type: 'STRING' },
    })

    const totalCount = countResult.rows?.[0]
      ? parseInt(countResult.rows[0].f[0].v || '0', 10)
      : 0

    // Then get the paginated messages
    const query = `
      SELECT
        event_id,
        event_timestamp,
        chat_id,
        message_content,
        response_content,
        origin_domain,
        total_duration_ms,
        tokens_input,
        tokens_output,
        context_found,
        error_code
      FROM \`${this.projectId}.${this.datasetId}.chatbot_events\`
      WHERE chat_id = @chatId
        AND DATE(event_timestamp) BETWEEN @startDate AND @endDate
        AND event_type = 'chat_request'
        AND (
          @searchQuery IS NULL
          OR @searchQuery = ''
          OR LOWER(COALESCE(message_content, '')) LIKE CONCAT('%', LOWER(@searchQuery), '%')
          OR LOWER(COALESCE(response_content, '')) LIKE CONCAT('%', LOWER(@searchQuery), '%')
        )
      ORDER BY event_timestamp DESC
      LIMIT @limit OFFSET @offset
    `

    const result = await this.executeQuery(query, {
      chatId: { value: chatId, type: 'STRING' },
      startDate: { value: startDate, type: 'DATE' },
      endDate: { value: endDate, type: 'DATE' },
      searchQuery: { value: searchQuery || '', type: 'STRING' },
      limit: { value: limit.toString(), type: 'INT64' },
      offset: { value: offset.toString(), type: 'INT64' },
    })

    const messages: ChatMessage[] = (result.rows || []).map((row) => ({
      eventId: row.f[0].v || '',
      eventTimestamp: row.f[1].v || '',
      chatId: row.f[2].v || '',
      messageContent: row.f[3].v || null,
      responseContent: row.f[4].v || null,
      originDomain: row.f[5].v || null,
      totalDurationMs: row.f[6].v ? parseFloat(row.f[6].v) : null,
      tokensInput: row.f[7].v ? parseInt(row.f[7].v, 10) : null,
      tokensOutput: row.f[8].v ? parseInt(row.f[8].v, 10) : null,
      contextFound: row.f[9].v === 'true',
      errorCode: row.f[10].v || null,
    }))

    const nextOffset = offset + limit
    const hasMore = nextOffset < totalCount

    return {
      messages,
      totalCount,
      hasMore,
      nextOffset,
    }
  }

  private async executeQuery(
    query: string,
    parameters: Record<string, { value: string; type: string }>
  ): Promise<BigQueryQueryResponse> {
    const accessToken = await this.getAccessToken()
    if (!accessToken) {
      throw new Error('Failed to get access token for BigQuery')
    }

    const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${this.projectId}/queries`

    const queryParameters = Object.entries(parameters).map(([name, { value, type }]) => ({
      name,
      parameterType: { type },
      parameterValue: { value },
    }))

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        useLegacySql: false,
        parameterMode: 'NAMED',
        queryParameters,
        timeoutMs: 30000,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`BigQuery query failed: ${response.status} ${error}`)
      Sentry.captureMessage(`BigQuery query failed: ${response.status}`, {
        level: 'error',
        extra: { status: response.status, error, query },
      })
      throw new Error(`BigQuery query failed: ${response.status}`)
    }

    const result = (await response.json()) as BigQueryQueryResponse

    if (result.errors && result.errors.length > 0) {
      console.error('BigQuery query errors:', result.errors)
      throw new Error(result.errors[0].message)
    }

    return result
  }

  private async getAccessToken(): Promise<string | null> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken
    }

    if (!this.credentials) return null

    try {
      const token = await this.generateJWT()
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: token,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('OAuth token request failed:', errorText)
        Sentry.captureMessage('BigQuery Analytics OAuth token request failed', {
          level: 'error',
          extra: { status: response.status, error: errorText },
        })
        return null
      }

      const data = (await response.json()) as { access_token: string; expires_in: number }
      this.accessToken = data.access_token
      this.tokenExpiry = Date.now() + data.expires_in * 1000
      return this.accessToken
    } catch (err) {
      console.error('Failed to get OAuth token:', err)
      Sentry.captureException(err)
      return null
    }
  }

  private async generateJWT(): Promise<string> {
    if (!this.credentials) throw new Error('No credentials')

    const now = Math.floor(Date.now() / 1000)
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    }
    const payload = {
      iss: this.credentials.client_email,
      scope: 'https://www.googleapis.com/auth/bigquery.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }

    const headerBase64 = this.base64UrlEncode(JSON.stringify(header))
    const payloadBase64 = this.base64UrlEncode(JSON.stringify(payload))
    const unsignedToken = `${headerBase64}.${payloadBase64}`

    const signature = await this.signRS256(unsignedToken, this.credentials.private_key)
    return `${unsignedToken}.${signature}`
  }

  private base64UrlEncode(str: string): string {
    const base64 = btoa(str)
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  private async signRS256(data: string, privateKeyPem: string): Promise<string> {
    const pemLines = privateKeyPem.split('\n')
    const pemContent = pemLines
      .filter((line) => !line.startsWith('-----'))
      .join('')

    const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0))

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    )

    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    const signatureBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, dataBuffer)

    const signatureArray = new Uint8Array(signatureBuffer)
    let binaryStr = ''
    for (let i = 0; i < signatureArray.length; i++) {
      binaryStr += String.fromCharCode(signatureArray[i])
    }

    return btoa(binaryStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }
}
