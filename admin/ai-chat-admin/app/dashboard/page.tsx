import { getStats } from '@/lib/management-api';

async function StatsCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string | number;
  description?: string;
}) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-900">
      <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {title}
      </h3>
      <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
        {value}
      </p>
      {description && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  let stats = { users_count: 0, chats_count: 0, knowledge_count: 0 };
  let error: string | null = null;

  try {
    stats = await getStats();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load stats';
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          ダッシュボード
        </h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          AI Chatプラットフォーム管理
        </p>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <StatsCard
            title="ユーザー数"
            value={stats.users_count.toLocaleString()}
            description="登録ユーザー"
          />
          <StatsCard
            title="チャット数"
            value={stats.chats_count.toLocaleString()}
            description="チャット設定"
          />
          <StatsCard
            title="ナレッジ数"
            value={stats.knowledge_count.toLocaleString()}
            description="登録されたドキュメント"
          />
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
            クイックアクション
          </h2>
          <div className="space-y-2">
            <a
              href="/dashboard/users"
              className="block rounded-lg bg-zinc-50 p-3 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              ユーザー一覧
            </a>
            <a
              href="/dashboard/chats"
              className="block rounded-lg bg-zinc-50 p-3 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              チャット管理
            </a>
            <a
              href="/dashboard/analytics"
              className="block rounded-lg bg-zinc-50 p-3 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              分析
            </a>
            <a
              href="/dashboard/audit"
              className="block rounded-lg bg-zinc-50 p-3 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              監査ログ
            </a>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
            システム状態
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">
                Management API
              </span>
              <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                接続中
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">BigQuery</span>
              <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                利用可能
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
