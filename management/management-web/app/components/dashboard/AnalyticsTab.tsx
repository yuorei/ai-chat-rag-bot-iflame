import { useState, useEffect, useCallback } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Calendar,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Globe,
  Smartphone,
  Monitor,
  Coins,
} from "lucide-react";
import type { ChatProfile, AnalyticsSummary, AnalyticsOverview, HourlyDistribution, DomainBreakdown, DeviceBreakdown } from "../../lib/types";
import {
  fetchAnalyticsSummary,
  fetchAnalyticsOverview,
  fetchHourlyDistribution,
  fetchDomainBreakdown,
  fetchDeviceBreakdown,
} from "../../lib/api";

type DateRangePreset = "last7days" | "last30days" | "last90days" | "custom";

type AnalyticsTabProps = {
  activeChat: ChatProfile | null;
  activeChatId: string;
};

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getDateRange(preset: DateRangePreset): { start: string; end: string } {
  const end = new Date();
  const start = new Date();

  switch (preset) {
    case "last7days":
      start.setDate(end.getDate() - 7);
      break;
    case "last30days":
      start.setDate(end.getDate() - 30);
      break;
    case "last90days":
      start.setDate(end.getDate() - 90);
      break;
    default:
      start.setDate(end.getDate() - 7);
  }

  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function AnalyticsTab({ activeChat, activeChatId }: AnalyticsTabProps) {
  const [preset, setPreset] = useState<DateRangePreset>("last7days");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [summary, setSummary] = useState<AnalyticsSummary[]>([]);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [hourly, setHourly] = useState<HourlyDistribution[]>([]);
  const [domains, setDomains] = useState<DomainBreakdown[]>([]);
  const [devices, setDevices] = useState<DeviceBreakdown[]>([]);

  const loadData = useCallback(async () => {
    if (!activeChatId) return;

    setLoading(true);
    setError(null);

    let startDate: string;
    let endDate: string;

    if (preset === "custom" && customStartDate && customEndDate) {
      startDate = customStartDate;
      endDate = customEndDate;
    } else {
      const range = getDateRange(preset);
      startDate = range.start;
      endDate = range.end;
    }

    try {
      const [summaryData, overviewData, hourlyData, domainsData, devicesData] = await Promise.all([
        fetchAnalyticsSummary(activeChatId, startDate, endDate),
        fetchAnalyticsOverview(activeChatId, startDate, endDate),
        fetchHourlyDistribution(activeChatId, startDate, endDate),
        fetchDomainBreakdown(activeChatId, startDate, endDate),
        fetchDeviceBreakdown(activeChatId, startDate, endDate),
      ]);

      setSummary(summaryData);
      setOverview(overviewData);
      setHourly(hourlyData);
      setDomains(domainsData);
      setDevices(devicesData);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setError((err as Error).message || "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [activeChatId, preset, customStartDate, customEndDate]);

  useEffect(() => {
    if (activeChatId) {
      loadData();
    }
  }, [activeChatId, loadData]);

  // Initialize custom dates when switching to custom mode
  useEffect(() => {
    if (preset === "custom" && !customStartDate && !customEndDate) {
      const range = getDateRange("last7days");
      setCustomStartDate(range.start);
      setCustomEndDate(range.end);
    }
  }, [preset, customStartDate, customEndDate]);

  if (!activeChatId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <MessageSquare className="w-12 h-12 mb-4 text-gray-300" />
        <p className="text-lg font-medium">チャットを選択してください</p>
        <p className="text-sm mt-1">左のサイドバーから対象のチャットを選択すると、アナリティクスが表示されます</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">アナリティクス</h2>
          {activeChat && (
            <p className="text-sm text-gray-500 mt-1">{activeChat.display_name}</p>
          )}
        </div>

        {/* Date Range Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as DateRangePreset)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          >
            <option value="last7days">過去7日間</option>
            <option value="last30days">過去30日間</option>
            <option value="last90days">過去90日間</option>
            <option value="custom">カスタム</option>
          </select>

          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
              <span className="text-gray-400">〜</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            更新
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}

      {!loading && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <OverviewCard
              icon={<MessageSquare className="w-5 h-5" />}
              label="総メッセージ数"
              value={formatNumber(overview?.totalMessages || 0)}
              color="blue"
            />
            <OverviewCard
              icon={<Coins className="w-5 h-5" />}
              label="総トークン使用量"
              value={formatNumber(overview?.totalTokensUsed || 0)}
              color="green"
            />
            <OverviewCard
              icon={<AlertCircle className="w-5 h-5" />}
              label="エラー率"
              value={formatPercent(overview?.errorRate || 0)}
              color="red"
            />
            <OverviewCard
              icon={<CheckCircle className="w-5 h-5" />}
              label="コンテキスト取得率"
              value={formatPercent(overview?.contextFoundRate || 0)}
              color="purple"
            />
          </div>

          {/* Charts Row - Message & Token Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Message Trend Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">メッセージ数の推移</h3>
              {summary.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={summary}>
                    <defs>
                      <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => value.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => [value, "メッセージ数"]}
                      labelFormatter={(label) => `日付: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="totalMessages"
                      stroke="#3B82F6"
                      fill="url(#colorMessages)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="データがありません" />
              )}
            </div>

            {/* Token Usage Trend Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Coins className="w-4 h-4" />
                トークン使用量の推移
              </h3>
              {summary.length > 0 && summary.some((s) => s.totalTokensUsed > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={summary}>
                    <defs>
                      <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => value.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => formatNumber(value)} />
                    <Tooltip
                      formatter={(value: number) => [formatNumber(value), "トークン"]}
                      labelFormatter={(label) => `日付: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="totalTokensUsed"
                      stroke="#10B981"
                      fill="url(#colorTokens)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="トークンデータがありません" />
              )}
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hourly Distribution Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">時間帯別アクセス</h3>
              {hourly.length > 0 && hourly.some((h) => h.messageCount > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={hourly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `${value}時`}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => [value, "メッセージ数"]}
                      labelFormatter={(label) => `${label}時台`}
                    />
                    <Bar dataKey="messageCount" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="データがありません" />
              )}
            </div>
          </div>

          {/* Visual Breakdowns Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Domain Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                ドメイン別利用状況
              </h3>
              {domains.length > 0 ? (
                <div className="space-y-3">
                  {(() => {
                    const maxCount = Math.max(...domains.map(d => d.messageCount));
                    const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];
                    return domains.map((domain, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-700 truncate max-w-[200px]" title={domain.originDomain}>
                            {domain.originDomain}
                          </span>
                          <span className="font-medium text-gray-900 ml-2">
                            {formatNumber(domain.messageCount)}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(domain.messageCount / maxCount) * 100}%`,
                              backgroundColor: colors[index % colors.length],
                            }}
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Globe className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>データがありません</p>
                </div>
              )}
            </div>

            {/* Device Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                デバイス・ブラウザ別利用状況
              </h3>
              {devices.length > 0 ? (
                <div className="space-y-3">
                  {(() => {
                    const maxCount = Math.max(...devices.map(d => d.messageCount));
                    const browserColors: Record<string, string> = {
                      Chrome: "#4285F4",
                      Safari: "#000000",
                      Firefox: "#FF7139",
                      Edge: "#0078D4",
                      Other: "#6B7280",
                    };
                    return devices.map((device, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              device.deviceType === "Mobile"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                            }`}>
                              {device.deviceType === "Mobile" ? (
                                <Smartphone className="w-3 h-3" />
                              ) : (
                                <Monitor className="w-3 h-3" />
                              )}
                              {device.deviceType}
                            </span>
                            <span className="text-gray-700">{device.browser}</span>
                          </div>
                          <span className="font-medium text-gray-900">
                            {formatNumber(device.messageCount)}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(device.messageCount / maxCount) * 100}%`,
                              backgroundColor: browserColors[device.browser] || browserColors.Other,
                            }}
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Smartphone className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>データがありません</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Overview Card Component
function OverviewCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "blue" | "red" | "purple" | "green";
}) {
  const colorStyles = {
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
    green: "bg-green-50 text-green-600",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorStyles[color]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 truncate">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

// Empty Chart Component
function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[250px] text-gray-400">
      <Calendar className="w-8 h-8 mb-2" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
