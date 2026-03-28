import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: List conversations for a guest
export async function GET(req: NextRequest) {
  const guestId = req.nextUrl.searchParams.get("guestId");

  if (!guestId) {
    return NextResponse.json({ error: "guestId is required" }, { status: 400 });
  }

  const conversations = await prisma.conversation.findMany({
    where: { guestId: parseInt(guestId) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      summary: true,
      actions: true,
      createdAt: true,
    },
  });

  return NextResponse.json(conversations);
}

// POST: Save a conversation (used for auto-save during chat)
export async function POST(req: NextRequest) {
  const { guestId, messages, actions, restaurantId = 1 } = await req.json();

  if (!guestId || !messages) {
    return NextResponse.json({ error: "guestId and messages are required" }, { status: 400 });
  }

  const conversation = await prisma.conversation.create({
    data: {
      guestId,
      restaurantId,
      messages,
      actions: actions || [],
    },
  });

  return NextResponse.json({ id: conversation.id });
}
