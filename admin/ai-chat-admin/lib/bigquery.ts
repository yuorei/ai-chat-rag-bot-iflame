import { BigQuery } from '@google-cloud/bigquery';

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || '';
const BQ_DATASET_ID = process.env.BQ_DATASET_ID || 'ai_chat_logs';

let bigQueryClient: BigQuery | null = null;

function getBigQueryClient(): BigQuery {
  if (!bigQueryClient) {
    if (GCP_PROJECT_ID.trim() === '') {
      throw new Error(
        'GCP_PROJECT_ID environment variable is not set or is empty. ' +
        'Please set GCP_PROJECT_ID to a valid Google Cloud Platform project ID.'
      );
    }
    bigQueryClient = new BigQuery({
      projectId: GCP_PROJECT_ID,
    });
  }
  return bigQueryClient;
}

export type DailySummary = {
  date: string;
  total_messages: number;
  unique_sessions: number;
  avg_response_time_ms: number;
  error_count: number;
  context_found_count: number;
};

export type HourlyDistribution = {
  hour: number;
  message_count: number;
};

export type DomainBreakdown = {
  domain: string;
  message_count: number;
};

export type ChatMessage = {
  timestamp: string;
  session_id: string;
  chat_id: string;
  query: string;
  response: string;
  response_time_ms: number;
  context_found: boolean;
  error: string | null;
  domain: string;
};

export type AuditLog = {
  timestamp: string;
  user_id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  chat_id: string | null;
  request_method: string;
  request_path: string;
  response_status: number;
  response_duration_ms: number;
  changes_summary: string | null;
  client_ip: string | null;
  user_agent: string | null;
};

export async function getDailySummary(
  startDate: string,
  endDate: string,
  chatId?: string
): Promise<DailySummary[]> {
  const bq = getBigQueryClient();

  let query = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE(event_timestamp)) as date,
      COUNT(*) as total_messages,
      COUNT(DISTINCT request_id) as unique_sessions,
      AVG(total_duration_ms) as avg_response_time_ms,
      COUNTIF(error_code IS NOT NULL AND error_code != '') as error_count,
      COUNTIF(context_found = true) as context_found_count
    FROM \`${GCP_PROJECT_ID}.${BQ_DATASET_ID}.chatbot_events\`
    WHERE DATE(event_timestamp) BETWEEN @startDate AND @endDate
      AND event_type = 'chat_request'
  `;

  const params: { startDate: string; endDate: string; chatId?: string } = {
    startDate,
    endDate,
  };

  if (chatId) {
    query += ` AND chat_id = @chatId`;
    params.chatId = chatId;
  }

  query += ` GROUP BY date ORDER BY date`;

  const [rows] = await bq.query({
    query,
    params,
  });

  return rows as DailySummary[];
}

export async function getHourlyDistribution(
  startDate: string,
  endDate: string,
  chatId?: string
): Promise<HourlyDistribution[]> {
  const bq = getBigQueryClient();

  let query = `
    SELECT
      EXTRACT(HOUR FROM event_timestamp) as hour,
      COUNT(*) as message_count
    FROM \`${GCP_PROJECT_ID}.${BQ_DATASET_ID}.chatbot_events\`
    WHERE DATE(event_timestamp) BETWEEN @startDate AND @endDate
      AND event_type = 'chat_request'
  `;

  const params: { startDate: string; endDate: string; chatId?: string } = {
    startDate,
    endDate,
  };

  if (chatId) {
    query += ` AND chat_id = @chatId`;
    params.chatId = chatId;
  }

  query += ` GROUP BY hour ORDER BY hour`;

  const [rows] = await bq.query({
    query,
    params,
  });

  return rows as HourlyDistribution[];
}

export async function getDomainBreakdown(
  startDate: string,
  endDate: string,
  chatId?: string
): Promise<DomainBreakdown[]> {
  const bq = getBigQueryClient();

  let query = `
    SELECT
      COALESCE(origin_domain, 'unknown') as domain,
      COUNT(*) as message_count
    FROM \`${GCP_PROJECT_ID}.${BQ_DATASET_ID}.chatbot_events\`
    WHERE DATE(event_timestamp) BETWEEN @startDate AND @endDate
      AND event_type = 'chat_request'
  `;

  const params: { startDate: string; endDate: string; chatId?: string } = {
    startDate,
    endDate,
  };

  if (chatId) {
    query += ` AND chat_id = @chatId`;
    params.chatId = chatId;
  }

  query += ` GROUP BY domain ORDER BY message_count DESC LIMIT 20`;

  const [rows] = await bq.query({
    query,
    params,
  });

  return rows as DomainBreakdown[];
}

export async function getRecentMessages(
  limit: number = 100,
  chatId?: string
): Promise<ChatMessage[]> {
  const bq = getBigQueryClient();

  let query = `
    SELECT
      event_timestamp as timestamp,
      request_id as session_id,
      chat_id,
      message_content as query,
      response_content as response,
      total_duration_ms as response_time_ms,
      context_found,
      error_code as error,
      origin_domain as domain
    FROM \`${GCP_PROJECT_ID}.${BQ_DATASET_ID}.chatbot_events\`
    WHERE event_type = 'chat_request'
  `;

  const params: { limit: number; chatId?: string } = { limit };

  if (chatId) {
    query += ` AND chat_id = @chatId`;
    params.chatId = chatId;
  }

  query += ` ORDER BY event_timestamp DESC LIMIT @limit`;

  const [rows] = await bq.query({
    query,
    params,
  });

  return rows as ChatMessage[];
}

export async function getAuditLogs(
  limit: number = 100,
  startDate?: string,
  endDate?: string
): Promise<AuditLog[]> {
  const bq = getBigQueryClient();

  let query = `
    SELECT
      event_timestamp as timestamp,
      user_id,
      user_email,
      action,
      resource_type,
      resource_id,
      chat_id,
      request_method,
      request_path,
      response_status,
      response_duration_ms,
      changes_summary,
      client_ip,
      user_agent
    FROM \`${GCP_PROJECT_ID}.${BQ_DATASET_ID}.management_audit_logs\`
  `;

  const params: { limit: number; startDate?: string; endDate?: string } = { limit };
  const conditions: string[] = [];

  if (startDate) {
    conditions.push('DATE(event_timestamp) >= @startDate');
    params.startDate = startDate;
  }

  if (endDate) {
    conditions.push('DATE(event_timestamp) <= @endDate');
    params.endDate = endDate;
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ` ORDER BY event_timestamp DESC LIMIT @limit`;

  const [rows] = await bq.query({
    query,
    params,
  });

  return rows as AuditLog[];
}

export async function getOverallStats(
  startDate: string,
  endDate: string
): Promise<{
  total_messages: number;
  unique_sessions: number;
  avg_response_time_ms: number;
  error_rate: number;
  context_found_rate: number;
}> {
  const bq = getBigQueryClient();

  const query = `
    SELECT
      COUNT(*) as total_messages,
      COUNT(DISTINCT request_id) as unique_sessions,
      AVG(total_duration_ms) as avg_response_time_ms,
      SAFE_DIVIDE(COUNTIF(error_code IS NOT NULL AND error_code != ''), COUNT(*)) * 100 as error_rate,
      SAFE_DIVIDE(COUNTIF(context_found = true), COUNT(*)) * 100 as context_found_rate
    FROM \`${GCP_PROJECT_ID}.${BQ_DATASET_ID}.chatbot_events\`
    WHERE DATE(event_timestamp) BETWEEN @startDate AND @endDate
      AND event_type = 'chat_request'
  `;

  const [rows] = await bq.query({
    query,
    params: { startDate, endDate },
  });

  const row = rows[0] || {
    total_messages: 0,
    unique_sessions: 0,
    avg_response_time_ms: 0,
    error_rate: 0,
    context_found_rate: 0,
  };

  return row as {
    total_messages: number;
    unique_sessions: number;
    avg_response_time_ms: number;
    error_rate: number;
    context_found_rate: number;
  };
}
