import { getChats } from '@/lib/management-api';

export const dynamic = 'force-dynamic';

export default async function ChatsPage() {
  let chats: Awaited<ReturnType<typeof getChats>> = [];
  let error: string | null = null;

  try {
    chats = await getChats();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load chats';
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          チャット
        </h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          すべてのチャット設定
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
                    表示名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    ターゲット
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    タイプ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    オーナー
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    作成日
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {chats.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400"
                    >
                      チャットがありません
                    </td>
                  </tr>
                ) : (
                  chats.map((chat) => (
                    <tr
                      key={chat.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-medium text-zinc-900 dark:text-white">
                          {chat.display_name}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {chat.id}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {chat.targets.length > 0
                          ? chat.targets.slice(0, 2).join(', ')
                          : chat.target}
                        {chat.targets.length > 2 && (
                          <span className="ml-1 text-zinc-400">
                            +{chat.targets.length - 2}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {chat.target_type}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-zinc-600 dark:text-zinc-400">
                        {chat.owner_user_id || '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {new Date(chat.created_at).toLocaleDateString('ja-JP')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-zinc-100 px-6 py-3 dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              合計: {chats.length} 件
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
