import { useEffect, useRef } from "react";
import { X, AlertTriangle, AlertCircle, Info } from "lucide-react";

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
};

const variantStyles = {
  danger: {
    icon: AlertTriangle,
    iconBg: "bg-red-50",
    iconColor: "text-red-600",
    confirmBg: "bg-red-600 hover:bg-red-700",
    confirmText: "text-white",
  },
  warning: {
    icon: AlertCircle,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    confirmBg: "bg-amber-600 hover:bg-amber-700",
    confirmText: "text-white",
  },
  info: {
    icon: Info,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    confirmBg: "bg-blue-600 hover:bg-blue-700",
    confirmText: "text-white",
  },
};

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "確認",
  cancelLabel = "キャンセル",
  variant = "warning",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const styles = variantStyles[variant];
  const IconComponent = styles.icon;

  // Keyboard handling - Escape to close and Tab for focus trap
  useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Escape key
      if (e.key === "Escape") {
        onCancel();
        return;
      }

      // Handle Tab key for focus trap
      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Focus the cancel button by default (safer option)
    firstElement?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${styles.iconBg}`}>
              <IconComponent className={`w-5 h-5 ${styles.iconColor}`} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-600">{message}</p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${styles.confirmBg} ${styles.confirmText}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
