import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH: Update an existing conversation
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id);
  const { messages, actions, summary } = await req.json();

  const data: Record<string, unknown> = {};
  if (messages !== undefined) data.messages = messages;
  if (actions !== undefined) data.actions = actions;
  if (summary !== undefined) data.summary = summary;

  const conversation = await prisma.conversation.update({
    where: { id },
    data,
  });

  return NextResponse.json({ id: conversation.id });
}

// GET: Fetch a single conversation
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id);

  const conversation = await prisma.conversation.findUnique({
    where: { id },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json(conversation);
}
