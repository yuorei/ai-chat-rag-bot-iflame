import { getAuditLogs } from '@/lib/bigquery';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  let logs: Awaited<ReturnType<typeof getAuditLogs>> = [];
  let error: string | null = null;

  try {
    logs = await getAuditLogs(200);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load audit logs';
  }

  function getStatusColor(status: number) {
    if (status >= 200 && status < 300) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    } else if (status >= 400) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    }
    return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400';
  }

  function getMethodColor(method: string) {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'text-blue-600 dark:text-blue-400';
      case 'POST':
        return 'text-green-600 dark:text-green-400';
      case 'PUT':
      case 'PATCH':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'DELETE':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-zinc-600 dark:text-zinc-400';
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          監査ログ
        </h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          管理操作の履歴
        </p>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    日時
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    ユーザー
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    アクション
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    リソース
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    ステータス
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    パス
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400"
                    >
                      監査ログがありません
                    </td>
                  </tr>
                ) : (
                  logs.map((log, index) => (
                    <tr
                      key={`${log.timestamp}-${index}`}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {new Date(log.timestamp).toLocaleString('ja-JP')}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-mono text-zinc-900 dark:text-white">
                          {log.user_id || '-'}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {log.action}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-zinc-900 dark:text-white">
                          {log.resource_type}
                        </div>
                        {log.resource_id && (
                          <div className="max-w-xs truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {log.resource_id}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(log.response_status)}`}
                        >
                          {log.response_status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className={`font-mono ${getMethodColor(log.request_method)}`}>
                          {log.request_method}
                        </span>{' '}
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {log.request_path}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-zinc-100 px-6 py-3 dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              最新 {logs.length} 件を表示中
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
