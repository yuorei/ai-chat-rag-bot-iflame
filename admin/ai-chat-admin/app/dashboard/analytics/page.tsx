import {
  getDailySummary,
  getOverallStats,
  getDomainBreakdown,
} from '@/lib/bigquery';

function formatDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

export default async function AnalyticsPage() {
  const endDate = formatDate(0);
  const startDate = formatDate(30);

  let dailyData: Awaited<ReturnType<typeof getDailySummary>> = [];
  let overallStats: Awaited<ReturnType<typeof getOverallStats>> | null = null;
  let domainData: Awaited<ReturnType<typeof getDomainBreakdown>> = [];
  let error: string | null = null;

  try {
    [dailyData, overallStats, domainData] = await Promise.all([
      getDailySummary(startDate, endDate),
      getOverallStats(startDate, endDate),
      getDomainBreakdown(startDate, endDate),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load analytics';
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          分析
        </h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          チャット利用統計（過去30日間）
        </p>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      ) : (
        <>
          {/* Overview Stats */}
          {overallStats && (
            <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-900">
                <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  総メッセージ数
                </h3>
                <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
                  {overallStats.total_messages.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-900">
                <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  ユニークセッション数
                </h3>
                <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
                  {overallStats.unique_sessions.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-900">
                <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  平均応答時間
                </h3>
                <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
                  {Math.round(overallStats.avg_response_time_ms)}ms
                </p>
              </div>
              <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-900">
                <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  コンテキスト発見率
                </h3>
                <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
                  {overallStats.context_found_rate.toFixed(1)}%
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Daily Summary Table */}
            <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-900">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
                日別サマリー
              </h2>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-white dark:bg-zinc-900">
                    <tr>
                      <th className="pb-2 text-left text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                        日付
                      </th>
                      <th className="pb-2 text-right text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                        メッセージ
                      </th>
                      <th className="pb-2 text-right text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                        セッション
                      </th>
                      <th className="pb-2 text-right text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                        エラー
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {dailyData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-4 text-center text-zinc-500 dark:text-zinc-400"
                        >
                          データがありません
                        </td>
                      </tr>
                    ) : (
                      dailyData.map((day) => (
                        <tr key={day.date}>
                          <td className="py-2 text-sm text-zinc-900 dark:text-white">
                            {day.date}
                          </td>
                          <td className="py-2 text-right text-sm text-zinc-600 dark:text-zinc-400">
                            {day.total_messages.toLocaleString()}
                          </td>
                          <td className="py-2 text-right text-sm text-zinc-600 dark:text-zinc-400">
                            {day.unique_sessions.toLocaleString()}
                          </td>
                          <td className="py-2 text-right text-sm text-zinc-600 dark:text-zinc-400">
                            {day.error_count}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Domain Breakdown */}
            <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-900">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
                ドメイン別ランキング
              </h2>
              <div className="space-y-3">
                {domainData.length === 0 ? (
                  <p className="py-4 text-center text-zinc-500 dark:text-zinc-400">
                    ドメインデータがありません
                  </p>
                ) : (
                  domainData.slice(0, 10).map((domain, index) => {
                    const maxCount = domainData[0]?.message_count || 1;
                    const percentage = (domain.message_count / maxCount) * 100;
                    return (
                      <div key={domain.domain}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="font-medium text-zinc-900 dark:text-white">
                            {index + 1}. {domain.domain}
                          </span>
                          <span className="text-zinc-600 dark:text-zinc-400">
                            {domain.message_count.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
