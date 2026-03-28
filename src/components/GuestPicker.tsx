"use client";

import { useState, useEffect } from "react";
import { GuestWithReservations } from "@/types/chat";

interface PastConversation {
  id: number;
  summary: string | null;
  createdAt: string;
}

interface GuestPickerProps {
  guests: GuestWithReservations[];
  onSelect: (guest: GuestWithReservations) => void;
}

export default function GuestPicker({ guests, onSelect }: GuestPickerProps) {
  const [expandedGuest, setExpandedGuest] = useState<number | null>(null);
  const [pastConvos, setPastConvos] = useState<Record<number, PastConversation[]>>({});

  useEffect(() => {
    // Fetch past conversations for all guests
    guests.forEach((guest) => {
      fetch(`/api/conversations?guestId=${guest.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.length > 0) {
            setPastConvos((prev) => ({ ...prev, [guest.id]: data }));
          }
        })
        .catch(() => {});
    });
  }, [guests]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-primary)] p-4 sm:p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 -mr-40 -mt-40 w-[500px] h-[500px] bg-orange-100/40 dark:bg-orange-900/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-[400px] h-[400px] bg-yellow-100/40 dark:bg-yellow-900/10 rounded-full blur-3xl" />

      <div className="bg-[var(--bg-surface)] rounded-3xl shadow-xl dark:shadow-none border border-[var(--border)] p-6 sm:p-8 max-w-md w-full relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-brand-orange-light to-brand-orange rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-orange/20">
            <span className="text-2xl font-heading font-bold text-white">BV</span>
          </div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text-primary)]">Bella Vista</h1>
          <p className="text-[var(--text-tertiary)] mt-1 font-body">Restaurant Assistant Sandbox</p>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-5 text-center font-body">
          Select a guest to start a conversation:
        </p>
        <div className="space-y-2.5">
          {guests.map((guest) => {
            const activeReservations = guest.reservations.filter(
              (r) => r.status === "confirmed"
            );
            const convos = pastConvos[guest.id] || [];
            const isExpanded = expandedGuest === guest.id;

            return (
              <div key={guest.id}>
                <button
                  onClick={() => onSelect(guest)}
                  className="w-full text-left p-4 rounded-2xl border border-[var(--border)] hover:border-brand-orange/40 hover:bg-[var(--accent-light)] transition-all group"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-[var(--text-primary)] font-body group-hover:text-brand-orange transition-colors">
                        {guest.firstName} {guest.lastName}
                      </p>
                      <p className="text-sm text-[var(--text-tertiary)] font-body">{guest.phone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {guest.dietary && guest.dietary !== "none" && (
                        <span className="text-xs bg-brand-orange/10 text-brand-orange px-2.5 py-0.5 rounded-full font-medium">
                          {guest.dietary}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    {activeReservations.length > 0 && (
                      <p className="text-xs text-[var(--text-tertiary)] font-body">
                        {activeReservations.length} active reservation
                        {activeReservations.length > 1 ? "s" : ""}
                      </p>
                    )}
                    {convos.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedGuest(isExpanded ? null : guest.id);
                        }}
                        className="text-xs text-brand-orange font-medium font-body hover:underline"
                      >
                        {convos.length} past chat{convos.length > 1 ? "s" : ""} {isExpanded ? "▲" : "▼"}
                      </button>
                    )}
                  </div>
                </button>

                {/* Past conversations dropdown */}
                {isExpanded && convos.length > 0 && (
                  <div className="ml-4 mt-1 space-y-1.5 mb-1">
                    {convos.map((convo) => (
                      <div
                        key={convo.id}
                        className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] text-xs"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[var(--text-tertiary)] font-body">
                            {new Date(convo.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {convo.summary ? (
                          <p className="text-[var(--text-secondary)] font-body leading-relaxed">
                            {convo.summary}
                          </p>
                        ) : (
                          <p className="text-[var(--text-tertiary)] font-body italic">
                            No summary generated
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
