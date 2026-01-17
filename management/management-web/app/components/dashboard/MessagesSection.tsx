import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  CheckCircle,
  XCircle,
  MessageSquare,
  Bot,
  RefreshCw,
  Calendar,
  User,
} from "lucide-react";
import type { ChatMessage } from "../../lib/types";
import { fetchMessages } from "../../lib/api";

type MessagesSectionProps = {
  chatId: string;
  startDate: string;
  endDate: string;
};

type DatePreset = "today" | "yesterday" | "last7days" | "last30days" | "custom";

const PAGE_SIZE = 50;

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getPresetDates(preset: DatePreset): { start: string; end: string } {
  const today = new Date();
  const end = new Date(today);
  const start = new Date(today);

  switch (preset) {
    case "today":
      break;
    case "yesterday":
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
      break;
    case "last7days":
      start.setDate(today.getDate() - 7);
      break;
    case "last30days":
      start.setDate(today.getDate() - 30);
      break;
    default:
      break;
  }

  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatShortTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTokens(input: number | null, output: number | null): string {
  const total = (input || 0) + (output || 0);
  if (total === 0) return "-";
  return `${total.toLocaleString()}`;
}

export function MessagesSection({ chatId, startDate: initialStartDate, endDate: initialEndDate }: MessagesSectionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date range state
  const [datePreset, setDatePreset] = useState<DatePreset>("last7days");
  const [localStartDate, setLocalStartDate] = useState(initialStartDate);
  const [localEndDate, setLocalEndDate] = useState(initialEndDate);

  // Sync with parent dates on initial load
  useEffect(() => {
    setLocalStartDate(initialStartDate);
    setLocalEndDate(initialEndDate);
  }, [initialStartDate, initialEndDate]);

  const loadMessages = useCallback(async (newOffset: number, search?: string, start?: string, end?: string) => {
    if (!chatId) return;

    const startDate = start || localStartDate;
    const endDate = end || localEndDate;

    if (!startDate || !endDate) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchMessages(
        chatId,
        startDate,
        endDate,
        PAGE_SIZE,
        newOffset,
        search
      );
      setMessages(result.messages);
      setTotalCount(result.totalCount);
      setHasMore(result.hasMore);
      setOffset(newOffset);
    } catch (err) {
      console.error("Failed to load messages:", err);
      setError((err as Error).message || "メッセージの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [chatId, localStartDate, localEndDate]);

  // Load messages when chatId changes
  useEffect(() => {
    if (chatId && localStartDate && localEndDate) {
      setOffset(0);
      setSearchQuery("");
      setSearchInput("");
      loadMessages(0, "", localStartDate, localEndDate);
    }
  }, [chatId]);

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== "custom") {
      const { start, end } = getPresetDates(preset);
      setLocalStartDate(start);
      setLocalEndDate(end);
      setOffset(0);
      loadMessages(0, searchQuery, start, end);
    }
  };

  const handleDateChange = () => {
    setDatePreset("custom");
    setOffset(0);
    loadMessages(0, searchQuery, localStartDate, localEndDate);
  };

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setOffset(0);
    loadMessages(0, searchInput);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    setOffset(0);
    loadMessages(0, "");
  };

  const handlePrevPage = () => {
    const newOffset = Math.max(0, offset - PAGE_SIZE);
    loadMessages(newOffset, searchQuery);
  };

  const handleNextPage = () => {
    if (hasMore) {
      loadMessages(offset + PAGE_SIZE, searchQuery);
    }
  };

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const rangeStart = totalCount > 0 ? offset + 1 : 0;
  const rangeEnd = Math.min(offset + PAGE_SIZE, totalCount);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            メッセージ履歴
          </h3>
          <button
            onClick={() => loadMessages(offset, searchQuery)}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            更新
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex flex-col gap-3">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div className="flex flex-wrap gap-1">
              {[
                { value: "today" as const, label: "今日" },
                { value: "yesterday" as const, label: "昨日" },
                { value: "last7days" as const, label: "過去7日" },
                { value: "last30days" as const, label: "過去30日" },
              ].map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handlePresetChange(preset.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    datePreset === preset.value
                      ? "bg-blue-100 text-blue-700 border border-blue-200"
                      : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Inputs */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={localStartDate}
              onChange={(e) => {
                setLocalStartDate(e.target.value);
                setDatePreset("custom");
              }}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
            <span className="text-gray-400 text-sm">〜</span>
            <input
              type="date"
              value={localEndDate}
              onChange={(e) => {
                setLocalEndDate(e.target.value);
                setDatePreset("custom");
              }}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
            <button
              onClick={handleDateChange}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              適用
            </button>
          </div>
        </div>
      </div>

      {/* Search and Pagination */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="メッセージを検索..."
              className="w-full pl-9 pr-20 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchInput && (
                <button
                  onClick={handleClearSearch}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleSearch}
                className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded"
              >
                検索
              </button>
            </div>
          </div>

          {/* Pagination Info */}
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={handlePrevPage}
              disabled={offset === 0 || loading}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="min-w-[140px] text-center text-gray-600">
              {totalCount > 0 ? (
                <>
                  <span className="font-medium">{rangeStart}-{rangeEnd}</span>
                  <span className="text-gray-400"> / </span>
                  <span className="font-medium">{totalCount.toLocaleString()}</span>
                  <span className="text-gray-400 text-xs ml-1">件</span>
                </>
              ) : (
                <span className="text-gray-400">0件</span>
              )}
            </span>
            <button
              onClick={handleNextPage}
              disabled={!hasMore || loading}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Active Search Indicator */}
        {searchQuery && (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <span>検索中:</span>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
              "{searchQuery}"
            </span>
            <button
              onClick={handleClearSearch}
              className="text-blue-600 hover:underline"
            >
              クリア
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 my-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
            <span className="text-sm text-gray-500">読み込み中...</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && messages.length === 0 && (
        <div className="text-center py-16">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-gray-500 font-medium">メッセージがありません</p>
          <p className="text-sm text-gray-400 mt-1">指定した期間にメッセージはありませんでした</p>
        </div>
      )}

      {/* Messages List */}
      {!loading && messages.length > 0 && (
        <div className="divide-y divide-gray-100">
          {messages.map((message) => (
            <MessageCard key={message.eventId} message={message} />
          ))}
        </div>
      )}

      {/* Bottom Pagination */}
      {!loading && totalCount > PAGE_SIZE && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-center items-center gap-3">
            <button
              onClick={handlePrevPage}
              disabled={offset === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              前へ
            </button>
            <span className="text-sm text-gray-500">
              <span className="font-medium">{currentPage}</span>
              <span className="text-gray-400"> / </span>
              <span className="font-medium">{totalPages}</span>
              <span className="text-gray-400 ml-1">ページ</span>
            </span>
            <button
              onClick={handleNextPage}
              disabled={!hasMore}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              次へ
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageCard({ message }: { message: ChatMessage }) {
  const hasError = !!message.errorCode;
  const [expanded, setExpanded] = useState(false);

  const userMessage = message.messageContent || "";
  const aiResponse = message.responseContent || "";
  const isLongMessage = userMessage.length > 200 || aiResponse.length > 500;

  return (
    <div
      className={`px-4 py-4 hover:bg-gray-50/50 transition-colors ${
        hasError ? "bg-red-50/30" : ""
      }`}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1 font-medium text-gray-700">
          <Clock className="w-3 h-3" />
          {formatTimestamp(message.eventTimestamp)}
        </span>
        {message.originDomain && (
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3" />
            {message.originDomain}
          </span>
        )}

        {/* Inline Badges */}
        <div className="flex items-center gap-2 ml-auto">
          {message.contextFound !== null && (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                message.contextFound
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {message.contextFound ? (
                <CheckCircle className="w-3 h-3" />
              ) : (
                <XCircle className="w-3 h-3" />
              )}
              {message.contextFound ? "Context" : "No Context"}
            </span>
          )}
          {message.totalDurationMs !== null && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700">
              <Clock className="w-3 h-3" />
              {formatDuration(message.totalDurationMs)}
            </span>
          )}
          {(message.tokensInput || message.tokensOutput) && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-purple-50 text-purple-700">
              {formatTokens(message.tokensInput, message.tokensOutput)} tokens
            </span>
          )}
          {message.errorCode && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700">
              <XCircle className="w-3 h-3" />
              {message.errorCode}
            </span>
          )}
        </div>
      </div>

      {/* Message Content */}
      <div className="space-y-3">
        {/* User Message */}
        {userMessage && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-blue-600 mb-1">ユーザー</p>
              <div className="p-3 bg-blue-50 rounded-lg rounded-tl-none">
                <div className={`text-sm text-gray-800 ${
                  !expanded && userMessage.length > 200 ? "line-clamp-3" : ""
                }`}>
                  <MarkdownContent content={userMessage} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Response */}
        {aiResponse && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
              <Bot className="w-4 h-4 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-purple-600 mb-1">AI</p>
              <div className="p-3 bg-purple-50 rounded-lg rounded-tl-none">
                <div className={`text-sm text-gray-800 ${
                  !expanded && aiResponse.length > 500 ? "line-clamp-5" : ""
                }`}>
                  <MarkdownContent content={aiResponse} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Expand/Collapse Button */}
      {isLongMessage && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 ml-10 text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          {expanded ? "折りたたむ" : "すべて表示"}
        </button>
      )}
    </div>
  );
}

// Markdown rendering component with custom styles
function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        // Headings
        h1: ({ children }) => (
          <h1 className="text-lg font-bold text-gray-900 mt-4 mb-2 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold text-gray-900 mt-3 mb-2 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-bold text-gray-900 mt-2 mb-1 first:mt-0">{children}</h3>
        ),
        // Paragraphs
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
        ),
        // Lists
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-2 space-y-1 pl-2">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-2 space-y-1 pl-2">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),
        // Code
        code: ({ className, children }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="px-1.5 py-0.5 bg-gray-200 text-gray-800 rounded text-xs font-mono">
                {children}
              </code>
            );
          }
          return (
            <code className="block bg-gray-800 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto my-2">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="bg-gray-800 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto my-2">
            {children}
          </pre>
        ),
        // Blockquote
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-gray-300 pl-3 my-2 text-gray-600 italic">
            {children}
          </blockquote>
        ),
        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {children}
          </a>
        ),
        // Strong/Bold
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900">{children}</strong>
        ),
        // Emphasis/Italic
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
        // Horizontal rule
        hr: () => (
          <hr className="my-3 border-gray-300" />
        ),
        // Table
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full border border-gray-300 text-xs">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-gray-100">{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-gray-200">{children}</tbody>
        ),
        tr: ({ children }) => (
          <tr>{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-300">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-gray-800 border-b border-gray-200">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
