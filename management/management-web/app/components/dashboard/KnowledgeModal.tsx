import { useState, useEffect, useRef } from "react";
import { X, Save, Edit2, Eye, RefreshCw, AlertCircle } from "lucide-react";
import type { KnowledgeAsset } from "../../lib/types";
import { fetchKnowledgeContent, updateKnowledge } from "../../lib/api";
import { ConfirmModal } from "./ConfirmModal";

type KnowledgeModalProps = {
  knowledge: KnowledgeAsset | null;
  onClose: () => void;
  onSaved: () => void;
  setError: (error: string | null) => void;
  setStatus: (status: string | null) => void;
};

export function KnowledgeModal({
  knowledge,
  onClose,
  onSaved,
  setError,
  setStatus,
}: KnowledgeModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [originalTitle, setOriginalTitle] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [editable, setEditable] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!knowledge) return;

    const loadContent = async () => {
      setLoading(true);
      try {
        const content = await fetchKnowledgeContent(knowledge.id);
        setTitle(content.title || "");
        setText(content.text || "");
        setOriginalTitle(content.title || "");
        setOriginalText(content.text || "");
        setEditable(content.editable ?? false);
      } catch (err) {
        setError((err as Error).message);
        onClose();
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [knowledge, setError, onClose]);

  // Keyboard handling - Escape to close and Tab for focus trap
  useEffect(() => {
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
        onClose();
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
    firstElement?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, loading]);

  const handleSaveClick = () => {
    setShowConfirm(true);
  };

  const executeSave = async () => {
    if (!knowledge) return;
    setShowConfirm(false);
    setSaving(true);
    setError(null);

    try {
      await updateKnowledge(knowledge.id, { title, text });
      setStatus("ナレッジを更新しました");
      setIsEditing(false);
      setOriginalTitle(title);
      setOriginalText(text);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setTitle(originalTitle);
    setText(originalText);
    setIsEditing(false);
  };

  const hasChanges = title !== originalTitle || text !== originalText;

  if (!knowledge) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isEditing ? (
              <Edit2 className="w-5 h-5 text-blue-600" />
            ) : (
              <Eye className="w-5 h-5 text-gray-600" />
            )}
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? "ナレッジを編集" : "ナレッジを表示"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* Not editable warning */}
              {!editable && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-700">
                    <p className="font-medium">このナレッジは編集できません</p>
                    <p className="mt-1 text-amber-600">
                      既存のナレッジです。編集が必要な場合は削除して再登録してください。
                    </p>
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タイトル
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                    placeholder="タイトルを入力..."
                  />
                ) : (
                  <p className="px-4 py-3 bg-gray-50 rounded-xl text-gray-900">
                    {title || "(タイトルなし)"}
                  </p>
                )}
              </div>

              {/* Text Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  内容
                </label>
                {isEditing ? (
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={15}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all resize-none font-mono"
                    placeholder="コンテンツを入力..."
                  />
                ) : text !== null ? (
                  <pre className="px-4 py-3 bg-gray-50 rounded-xl text-gray-900 text-sm whitespace-pre-wrap font-mono max-h-[400px] overflow-auto">
                    {text || "(内容なし)"}
                  </pre>
                ) : (
                  <p className="px-4 py-3 bg-gray-50 rounded-xl text-gray-500 italic">
                    コンテンツを取得できませんでした
                  </p>
                )}
              </div>

              {/* Metadata */}
              <div className="pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
                  <div>
                    <span className="font-medium">タイプ:</span> {knowledge.type}
                  </div>
                  <div>
                    <span className="font-medium">作成日:</span>{" "}
                    {new Date(knowledge.created_at).toLocaleString()}
                  </div>
                  {knowledge.source_url && (
                    <div className="col-span-2">
                      <span className="font-medium">URL:</span>{" "}
                      <a
                        href={knowledge.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all"
                      >
                        {knowledge.source_url}
                      </a>
                    </div>
                  )}
                  {knowledge.original_filename && (
                    <div className="col-span-2">
                      <span className="font-medium">ファイル名:</span>{" "}
                      {knowledge.original_filename}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveClick}
                disabled={saving || !hasChanges}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 rounded-lg transition-colors"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    保存
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                閉じる
              </button>
              {editable && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  編集
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 更新確認モーダル */}
      <ConfirmModal
        isOpen={showConfirm}
        title="ナレッジの更新"
        message="ナレッジを更新しますか？"
        confirmLabel="更新"
        variant="warning"
        onConfirm={executeSave}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
