"use client";

import { ChatMessage as ChatMessageType } from "@/types/chat";

const actionColors: Record<string, { bg: string; text: string }> = {
  bookReservation: { bg: "bg-green-50 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" },
  modifyReservation: { bg: "bg-brand-orange/10", text: "text-brand-orange" },
  cancelReservation: { bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-600 dark:text-red-400" },
  addGuestNote: { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400" },
};

export default function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2.5`}>
      <div className={`max-w-[85%] sm:max-w-[70%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`px-4 py-2.5 text-[15px] leading-relaxed font-body ${
            isUser
              ? "bg-[var(--bubble-user)] text-white rounded-[20px] rounded-br-[6px]"
              : "bg-[var(--bubble-bot)] text-[var(--bubble-bot-text)] rounded-[20px] rounded-bl-[6px] shadow-sm dark:shadow-none border border-[var(--border)]"
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        {message.actions && message.actions.filter((a) => !a.result.includes("Not found")).length > 0 && (
          <div className="mt-1.5 space-y-1">
            {message.actions.filter((a) => !a.result.includes("Not found")).map((action, i) => {
              const colors = actionColors[action.tool] || {
                bg: "bg-[var(--bg-input)]",
                text: "text-[var(--text-secondary)]",
              };
              return (
                <div
                  key={i}
                  className={`${colors.bg} ${colors.text} text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 font-medium font-body`}
                >
                  <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 12 12" fill="none">
                    <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>{action.result}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
