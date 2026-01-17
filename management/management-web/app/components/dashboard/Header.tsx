import { Menu } from "lucide-react";

type HeaderProps = {
  activeTab: "chats" | "knowledge" | "ui-editor" | "analytics";
  setSidebarOpen: (open: boolean) => void;
};

export function Header({
  activeTab,
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
      case "analytics":
        return {
          title: "アナリティクス",
          description: "チャットの利用状況を分析します",
        };
      default:
        return {
          title: "管理画面",
          description: "ダッシュボード",
        };
    }
  };

  const tabContent = getTabContent();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-8 sticky top-0 z-10">
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
    </header>
  );
}
