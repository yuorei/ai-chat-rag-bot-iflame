import { CheckCircle2, AlertCircle, X } from "lucide-react";

type NotificationBannerProps = {
  status: string | null;
  error: string | null;
  onClose: () => void;
};

export function NotificationBanner({ status, error, onClose }: NotificationBannerProps) {
  if (!status && !error) return null;

  return (
    <div className="px-4 lg:px-8 pt-4">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
          status
            ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
            : "bg-red-50 border border-red-200 text-red-800"
        }`}
      >
        {status ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        )}
        <span className="text-sm font-medium">{status || error}</span>
        <button
          onClick={onClose}
          className="ml-auto p-1 hover:bg-black/5 rounded-lg transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
