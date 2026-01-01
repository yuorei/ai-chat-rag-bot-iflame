import { Menu } from "lucide-react";
import type { ChatProfile } from "../../lib/types";

type HeaderProps = {
  activeTab: "chats" | "knowledge" | "ui-editor";
  chats: ChatProfile[];
  activeChatId: string;
  setActiveChatId: (id: string) => void;
  setSidebarOpen: (open: boolean) => void;
};

export function Header({
  activeTab,
  chats,
  activeChatId,
  setActiveChatId,
  setSidebarOpen,
}: HeaderProps) {
  const getTabContent = () => {
    switch (activeTab) {
      case "chats":
        return {
          title: "チャット管理",
          description: "チャットAIの登録・編集・削除を行います",
        };
      case "knowledge":
        return {
          title: "ナレッジ投入",
          description: "選択したチャットにナレッジを追加します",
        };
      case "ui-editor":
        return {
          title: "デザイン編集",
          description: "チャットUIの外観をカスタマイズします",
        };
    }
  };

  const tabContent = getTabContent();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-8 sticky top-0 z-10">
      <div className="flex items-center justify-between w-full gap-4">
        <div className="flex items-center gap-3">
          {/* モバイルメニューボタン */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl lg:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg lg:text-xl font-bold text-gray-900">
              {tabContent.title}
            </h1>
            <p className="text-xs lg:text-sm text-gray-500 hidden sm:block">
              {tabContent.description}
            </p>
          </div>
        </div>

        {/* 操作対象チャット */}
        {activeTab === "knowledge" && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-blue-50 px-3 lg:px-4 py-2 rounded-xl">
              <span className="text-xs lg:text-sm text-blue-600 font-medium hidden sm:inline">
                操作対象:
              </span>
              <select
                className="bg-transparent border-none text-xs lg:text-sm font-semibold text-blue-700 focus:outline-none cursor-pointer max-w-[120px] lg:max-w-none"
                value={activeChatId}
                onChange={(e) => setActiveChatId(e.target.value)}
              >
                <option value="">チャットを選択</option>
                {chats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name || c.id}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
