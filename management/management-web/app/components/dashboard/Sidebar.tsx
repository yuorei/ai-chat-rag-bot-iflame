import { useState } from "react";
import { Link } from "react-router";
import {
  MessageSquare,
  Database,
  LogOut,
  Book,
  ChevronDown,
  Bot,
} from "lucide-react";
import type { User } from "../../lib/types";

type SidebarProps = {
  user: User | null;
  activeTab: "chats" | "knowledge";
  setActiveTab: (tab: "chats" | "knowledge") => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  logout: () => void;
};

export function Sidebar({
  user,
  activeTab,
  setActiveTab,
  sidebarOpen,
  setSidebarOpen,
  logout,
}: SidebarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <aside
      className={`w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-50 transition-transform duration-300 lg:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* ロゴ */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900">AI Chat</span>
        </div>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 p-4 space-y-1">
        <button
          onClick={() => {
            setActiveTab("chats");
            setSidebarOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
            activeTab === "chats"
              ? "bg-blue-50 text-blue-700 shadow-sm"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          チャット管理
        </button>
        <button
          onClick={() => {
            setActiveTab("knowledge");
            setSidebarOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
            activeTab === "knowledge"
              ? "bg-blue-50 text-blue-700 shadow-sm"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          <Database className="w-5 h-5" />
          ナレッジ投入
        </button>
        <Link
          to="/docs"
          onClick={() => setSidebarOpen(false)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all"
        >
          <Book className="w-5 h-5" />
          埋め込みガイド
        </Link>
      </nav>

      {/* ユーザー情報 */}
      <div className="p-4 border-t border-gray-200">
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-all"
          >
            <div className="w-9 h-9 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {user?.email?.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.email || "ログイン中..."}
              </p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-gray-500 transition-transform ${
                userMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-all"
              >
                <LogOut className="w-4 h-4" />
                ログアウト
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
