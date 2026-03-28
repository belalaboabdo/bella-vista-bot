import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const { conversationHistory, guestId, actions, conversationId } = await req.json();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system:
      "You are summarizing a conversation between a restaurant guest and the Bella Vista AI assistant. Provide a concise summary (2-4 sentences) of what happened and what actions were taken. Focus on the outcomes: reservations created/modified/cancelled, notes logged, etc.",
    messages: [
      {
        role: "user",
        content: `Summarize this conversation:\n\n${JSON.stringify(conversationHistory)}`,
      },
    ],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );

  const summary = textBlock?.text || "No summary available.";

  // Update existing conversation with summary, or create new one
  if (conversationId) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { summary, messages: conversationHistory, actions: actions || [] },
    });
  } else if (guestId) {
    await prisma.conversation.create({
      data: {
        guestId,
        restaurantId: 1,
        messages: conversationHistory,
        summary,
        actions: actions || [],
      },
    });
  }

  return NextResponse.json({ summary });
}
