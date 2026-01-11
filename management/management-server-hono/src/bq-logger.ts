/**
 * BigQuery logger for Cloudflare Workers
 * Uses BigQuery REST API with service account authentication
 */

export interface AuditEvent {
  event_id: string
  event_timestamp: string
  user_id: string
  user_email: string
  action: string
  resource_type: string
  resource_id?: string
  chat_id?: string
  request_method: string
  request_path: string
  response_status: number
  response_duration_ms: number
  changes_summary?: string
  client_ip?: string
  user_agent?: string
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

export class BigQueryLogger {
  private projectId: string
  private datasetId: string
  private tableId: string
  private credentials: ServiceAccountCredentials | null
  private accessToken: string | null = null
  private tokenExpiry: number = 0
  private buffer: AuditEvent[] = []
  private readonly maxBufferSize = 50

  constructor(
    projectId: string,
    datasetId: string,
    tableId: string,
    serviceAccountKeyJson: string | undefined
  ) {
    this.projectId = projectId
    this.datasetId = datasetId
    this.tableId = tableId

    if (serviceAccountKeyJson) {
      try {
        this.credentials = JSON.parse(serviceAccountKeyJson)
      } catch {
        console.error('Failed to parse service account key JSON')
        this.credentials = null
      }
    } else {
      this.credentials = null
    }
  }

  isEnabled(): boolean {
    return this.credentials !== null && this.projectId !== ''
  }

  async log(event: AuditEvent): Promise<void> {
    if (!this.isEnabled()) return

    this.buffer.push(event)
    if (this.buffer.length >= this.maxBufferSize) {
      await this.flush()
    }
  }

  async flush(): Promise<void> {
    if (!this.isEnabled() || this.buffer.length === 0) return

    const events = [...this.buffer]
    this.buffer = []

    try {
      const accessToken = await this.getAccessToken()
      if (!accessToken) {
        console.error('Failed to get access token for BigQuery')
        return
      }

      const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${this.projectId}/datasets/${this.datasetId}/tables/${this.tableId}/insertAll`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rows: events.map((event) => ({
            insertId: event.event_id,
            json: event,
          })),
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error(`BigQuery insert failed: ${response.status} ${error}`)
      } else {
        const result = (await response.json()) as { insertErrors?: unknown[] }
        if (result.insertErrors && result.insertErrors.length > 0) {
          console.error('BigQuery insert errors:', JSON.stringify(result.insertErrors))
        }
      }
    } catch (err) {
      console.error('BigQuery flush error:', err)
      // Don't re-add to buffer to avoid infinite loop
    }
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
        console.error('OAuth token request failed:', await response.text())
        return null
      }

      const data = (await response.json()) as { access_token: string; expires_in: number }
      this.accessToken = data.access_token
      this.tokenExpiry = Date.now() + data.expires_in * 1000
      return this.accessToken
    } catch (err) {
      console.error('Failed to get OAuth token:', err)
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
      scope: 'https://www.googleapis.com/auth/bigquery.insertdata',
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
    // Parse PEM to get the raw key
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

// Helper to create audit event
export function createAuditEvent(params: {
  userId: string
  userEmail: string
  action: string
  resourceType: string
  resourceId?: string
  chatId?: string
  requestMethod: string
  requestPath: string
  responseStatus: number
  responseDurationMs: number
  changesSummary?: string
  clientIp?: string
  userAgent?: string
}): AuditEvent {
  return {
    event_id: crypto.randomUUID(),
    event_timestamp: new Date().toISOString(),
    user_id: params.userId,
    user_email: params.userEmail,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    chat_id: params.chatId,
    request_method: params.requestMethod,
    request_path: params.requestPath,
    response_status: params.responseStatus,
    response_duration_ms: params.responseDurationMs,
    changes_summary: params.changesSummary,
    client_ip: params.clientIp,
    user_agent: params.userAgent,
  }
}
