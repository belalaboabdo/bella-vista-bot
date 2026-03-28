"use client";

import { ActionRecord } from "@/types/chat";

const actionLabels: Record<string, { label: string; color: string; dotColor: string }> = {
  bookReservation: { label: "Reservation created", color: "text-green-700 dark:text-green-400", dotColor: "bg-green-500" },
  modifyReservation: { label: "Reservation updated", color: "text-brand-orange", dotColor: "bg-brand-orange" },
  cancelReservation: { label: "Reservation cancelled", color: "text-red-600 dark:text-red-400", dotColor: "bg-red-500" },
  addGuestNote: { label: "Guest note added", color: "text-blue-600 dark:text-blue-400", dotColor: "bg-blue-500" },
};

interface ActionLogProps {
  actions: ActionRecord[];
  summary: string | null;
  onEndConversation: () => void;
  isLoadingSummary: boolean;
  sessionEnded: boolean;
}

export default function ActionLog({
  actions,
  summary,
  onEndConversation,
  isLoadingSummary,
  sessionEnded,
}: ActionLogProps) {
  const bookCount = actions.filter((a) => a.tool === "bookReservation").length;
  const modifyCount = actions.filter((a) => a.tool === "modifyReservation").length;
  const cancelCount = actions.filter((a) => a.tool === "cancelReservation").length;
  const noteCount = actions.filter((a) => a.tool === "addGuestNote").length;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)] border-l border-[var(--border)]">
      <div className="p-4 border-b border-[var(--border)]">
        <h2 className="font-heading font-semibold text-[var(--text-primary)] text-lg">Actions triggered</h2>
      </div>

      <div className="flex-1 overflow-y-auto chat-scroll p-4 space-y-3">
        {actions.length === 0 && (
          <p className="text-sm text-[var(--text-tertiary)] text-center mt-8 font-body">
            No actions yet. Start chatting to trigger bot actions.
          </p>
        )}
        {actions.map((action, i) => {
          const meta = actionLabels[action.tool] || {
            label: action.tool,
            color: "text-[var(--text-secondary)]",
            dotColor: "bg-[var(--text-secondary)]",
          };
          return (
            <div key={i} className="border border-[var(--border)] rounded-2xl p-3.5 bg-[var(--bg-primary)]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dotColor}`} />
                  <span className={`text-sm font-semibold font-body ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--text-tertiary)] font-body">{action.timestamp}</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5 ml-4 font-body">{action.result}</p>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="border-t border-[var(--border)] p-4">
        <h3 className="font-heading font-semibold text-[var(--text-primary)] mb-2">
          Conversation summary
          {summary && (
            <span className="text-[11px] font-normal text-[var(--text-tertiary)] ml-2 font-body">
              auto-generated
            </span>
          )}
        </h3>
        {summary ? (
          <p className="text-sm text-[var(--text-secondary)] font-body leading-relaxed">{summary}</p>
        ) : isLoadingSummary ? (
          <p className="text-sm text-[var(--text-tertiary)] font-body">Generating summary...</p>
        ) : (
          <p className="text-sm text-[var(--text-tertiary)] font-body">
            End the conversation to generate a summary.
          </p>
        )}
      </div>

      {/* Stats + End button */}
      <div className="border-t border-[var(--border)] p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {actions.length > 0 && (
            <span className="text-xs bg-[var(--bg-input)] text-[var(--text-secondary)] px-2.5 py-1 rounded-full font-medium font-body">
              {actions.length} actions taken
            </span>
          )}
          {bookCount > 0 && (
            <span className="text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full font-medium font-body">
              {bookCount} booking created
            </span>
          )}
          {modifyCount > 0 && (
            <span className="text-xs bg-brand-orange/10 text-brand-orange px-2.5 py-1 rounded-full font-medium font-body">
              {modifyCount} reservation modified
            </span>
          )}
          {cancelCount > 0 && (
            <span className="text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-full font-medium font-body">
              {cancelCount} cancelled
            </span>
          )}
          {noteCount > 0 && (
            <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full font-medium font-body">
              {noteCount} note added
            </span>
          )}
        </div>
        {!sessionEnded && (
          <button
            onClick={onEndConversation}
            disabled={isLoadingSummary}
            className="w-full py-2.5 text-sm font-semibold font-body text-[var(--text-secondary)] border border-[var(--border)] rounded-full hover:bg-[var(--bg-input)] transition-colors disabled:opacity-50"
          >
            End Conversation
          </button>
        )}
      </div>
    </div>
  );
}
