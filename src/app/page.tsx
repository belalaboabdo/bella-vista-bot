"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage as ChatMessageType, ActionRecord, GuestWithReservations } from "@/types/chat";
import GuestPicker from "@/components/GuestPicker";
import ChatMessage from "@/components/ChatMessage";
import ActionLog from "@/components/ActionLog";

export default function Home() {
  const [guests, setGuests] = useState<GuestWithReservations[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<GuestWithReservations | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [allActions, setAllActions] = useState<ActionRecord[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const anthropicHistory = useRef<Array<{ role: string; content: unknown }>>([]);
  const conversationId = useRef<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/guests")
      .then((r) => r.json())
      .then(setGuests);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isLoading && selectedGuest) {
      inputRef.current?.focus();
    }
  }, [isLoading, selectedGuest]);

  async function saveConversation(
    guestId: number,
    msgs: ChatMessageType[],
    actions: ActionRecord[]
  ) {
    const simplifiedMessages = msgs.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.actions?.length ? { actions: m.actions } : {}),
    }));

    if (!conversationId.current) {
      // Create new conversation
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId, messages: simplifiedMessages, actions }),
      });
      const data = await res.json();
      conversationId.current = data.id;
    } else {
      // Update existing conversation
      await fetch(`/api/conversations/${conversationId.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: simplifiedMessages, actions }),
      });
    }
  }

  async function handleSelectGuest(guest: GuestWithReservations) {
    setSelectedGuest(guest);
    anthropicHistory.current = [];
    conversationId.current = null;
    setSummary(null);
    setSessionEnded(false);
    setAllActions([]);

    // Try to load the most recent conversation for this guest
    try {
      const res = await fetch(`/api/conversations?guestId=${guest.id}`);
      const convos = await res.json();

      if (convos.length > 0) {
        const latest = convos[0]; // Most recent (ordered by createdAt desc)
        const convoRes = await fetch(`/api/conversations/${latest.id}`);
        const convo = await convoRes.json();

        if (convo.messages && Array.isArray(convo.messages) && convo.messages.length > 0) {
          conversationId.current = convo.id;
          setMessages(convo.messages as ChatMessageType[]);
          if (convo.actions) setAllActions(convo.actions as ActionRecord[]);
          if (convo.summary) {
            setSummary(convo.summary);
            setSessionEnded(true);
          }
          return;
        }
      }
    } catch {
      // Fall through to default greeting
    }

    // Default: start fresh conversation
    setMessages([
      {
        role: "assistant",
        content: `Hi ${guest.firstName}! Welcome to Bella Vista. I can help you with reservations, modifications, or note any dietary preferences. How can I help you today?`,
      },
    ]);
  }

  async function handleSend() {
    if (!input.trim() || isLoading || !selectedGuest || sessionEnded) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          guestId: selectedGuest.id,
          conversationHistory: anthropicHistory.current,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${data.error || "Something went wrong."}` },
        ]);
        return;
      }

      anthropicHistory.current = data.updatedHistory;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, actions: data.actions },
      ]);

      const updatedActions = data.actions?.length
        ? [...allActions, ...data.actions]
        : allActions;

      if (data.actions?.length > 0) {
        setAllActions(updatedActions);
      }

      // Auto-save conversation to DB
      const updatedMessages = [
        ...messages,
        { role: "user" as const, content: userMessage },
        { role: "assistant" as const, content: data.reply, actions: data.actions },
      ];
      saveConversation(selectedGuest.id, updatedMessages, updatedActions).catch(() => {});
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEndConversation() {
    setIsLoadingSummary(true);
    setSessionEnded(true);

    try {
      const convoForSummary = messages.map((m) => ({
        role: m.role,
        content: m.content + (m.actions ? `\n[Actions: ${m.actions.map((a) => a.result).join(", ")}]` : ""),
      }));

      const res = await fetch("/api/chat/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationHistory: convoForSummary,
          guestId: selectedGuest?.id,
          actions: allActions,
          conversationId: conversationId.current,
        }),
      });

      const data = await res.json();
      setSummary(data.summary);
    } catch {
      setSummary("Unable to generate summary.");
    } finally {
      setIsLoadingSummary(false);
    }
  }

  async function handleNewSession() {
    // Save current conversation before switching
    if (selectedGuest && messages.length > 1) {
      await saveConversation(selectedGuest.id, messages, allActions).catch(() => {});
    }
    setSelectedGuest(null);
    setMessages([]);
    setAllActions([]);
    setSummary(null);
    setSessionEnded(false);
    setShowSidebar(false);
    anthropicHistory.current = [];
    conversationId.current = null;
  }

  if (!selectedGuest) {
    return <GuestPicker guests={guests} onSelect={handleSelectGuest} />;
  }

  return (
    <div className="flex h-[100dvh] bg-[var(--bg-primary)]">
      {/* Chat panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-[var(--bg-surface)] border-b border-[var(--border)] px-3 sm:px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-orange-light to-brand-orange rounded-xl flex items-center justify-center shadow-lg shadow-brand-orange/20 flex-shrink-0">
              <span className="text-sm font-heading font-bold text-white">BV</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-bold text-[var(--text-primary)] text-base truncate">Bella Vista</h1>
                <span className="flex items-center gap-1 text-[11px] text-green-600 font-medium font-body">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  online
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)] font-body truncate">Restaurant Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-[13px] text-[var(--text-primary)] font-semibold font-body">
                {selectedGuest.firstName} {selectedGuest.lastName}
              </p>
              <p className="text-[11px] text-[var(--text-tertiary)] font-body">{selectedGuest.phone}</p>
            </div>
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="lg:hidden relative w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--bg-input)] text-[var(--text-secondary)] border border-[var(--border)]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 012 10z" clipRule="evenodd" />
              </svg>
              {allActions.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-brand-orange text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                  {allActions.length}
                </span>
              )}
            </button>
            <button
              onClick={handleNewSession}
              className="text-[13px] text-brand-orange hover:text-brand-orange-dark font-semibold font-body"
            >
              Switch
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto chat-scroll px-3 sm:px-5 py-4" style={{ backgroundColor: "var(--bg-chat)" }}>
          <div className="flex justify-center mb-5">
            <span className="text-[11px] text-[var(--text-tertiary)] bg-[var(--bg-surface)]/70 backdrop-blur-sm px-3.5 py-1 rounded-full font-medium font-body border border-[var(--border)]">
              Today
            </span>
          </div>

          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}

          {isLoading && (
            <div className="flex justify-start mb-2.5">
              <div className="rounded-[20px] rounded-bl-[6px] px-4 py-3 shadow-sm dark:shadow-none border border-[var(--border)]" style={{ backgroundColor: "var(--bubble-bot)" }}>
                <div className="flex gap-1.5">
                  <span className="typing-dot w-2 h-2 rounded-full bg-brand-orange/60" />
                  <span className="typing-dot w-2 h-2 rounded-full bg-brand-orange/60" />
                  <span className="typing-dot w-2 h-2 rounded-full bg-brand-orange/60" />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="bg-[var(--bg-surface)] border-t border-[var(--border)] px-3 sm:px-5 py-3">
          <div className="flex items-center gap-2.5">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                sessionEnded
                  ? "Session ended — start a new conversation"
                  : "Type a message as the guest..."
              }
              disabled={isLoading || sessionEnded}
              className="flex-1 rounded-full px-4 py-2.5 text-[15px] font-body border focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange transition-all disabled:opacity-50"
              style={{
                backgroundColor: "var(--bg-input)",
                color: "var(--text-primary)",
                borderColor: "var(--border)",
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || sessionEnded}
              className="bg-gradient-to-br from-brand-orange-light to-brand-orange text-white rounded-full w-10 h-10 flex items-center justify-center hover:shadow-lg hover:shadow-brand-orange/25 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none flex-shrink-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4 translate-x-[1px]"
              >
                <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="w-80 flex-shrink-0 hidden lg:flex lg:flex-col">
        <ActionLog
          actions={allActions}
          summary={summary}
          onEndConversation={handleEndConversation}
          isLoadingSummary={isLoadingSummary}
          sessionEnded={sessionEnded}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {showSidebar && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            onClick={() => setShowSidebar(false)}
          />
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 max-h-[75dvh] rounded-t-3xl overflow-hidden shadow-2xl border-t border-[var(--border)]">
            <div className="flex justify-center pt-2.5 pb-1" style={{ backgroundColor: "var(--bg-surface)" }}>
              <div className="w-10 h-1 rounded-full bg-[var(--text-tertiary)]/40" />
            </div>
            <div className="overflow-y-auto max-h-[70dvh]">
              <ActionLog
                actions={allActions}
                summary={summary}
                onEndConversation={handleEndConversation}
                isLoadingSummary={isLoadingSummary}
                sessionEnded={sessionEnded}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
