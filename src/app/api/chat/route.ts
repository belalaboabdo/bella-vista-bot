import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { toolDefinitions, executeTool } from "@/lib/tools";
import { ActionRecord } from "@/types/chat";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function buildSystemPrompt(
  guest: {
    firstName: string;
    lastName: string;
    phone: string;
    dietary: string | null;
    notes: string | null;
    reservations: Array<{
      id: number;
      date: string;
      time: string;
      partySize: number;
      status: string;
      notes: string | null;
      table: { id: number; capacity: number; location: string };
    }>;
  },
  tables: Array<{
    id: number;
    capacity: number;
    location: string;
    reservations: Array<{ date: string; time: string; status: string }>;
  }>,
  restaurant: { name: string; opensAt: string; closesAt: string }
) {
  const reservationInfo = guest.reservations
    .map(
      (r) =>
        `  - Reservation #${r.id}: ${r.date} at ${r.time}, party of ${r.partySize}, table ${r.table.id} (${r.table.location}), status: ${r.status}${r.notes ? `, notes: "${r.notes}"` : ""}`
    )
    .join("\n");

  const tableInfo = tables
    .map(
      (t) => `  - Table #${t.id}: capacity ${t.capacity}, location: ${t.location}, confirmed bookings: ${t.reservations.length > 0 ? t.reservations.map((r) => `${r.date} at ${r.time}`).join(", ") : "none"}`
    )
    .join("\n");

  return `You are the SMS text assistant for ${restaurant.name}, an upscale Italian restaurant. You are texting with ${guest.firstName} ${guest.lastName} (phone: ${guest.phone}).

=== RESTAURANT HOURS ===
- Opens: ${restaurant.opensAt}
- Closes: ${restaurant.closesAt}
- Reservations can only be made during operating hours.

=== GUEST PROFILE ===
- Dietary restrictions: ${guest.dietary || "none on file"}
- Guest notes/preferences: ${guest.notes || "none"}

=== GUEST'S RESERVATIONS ===
${reservationInfo || "  No reservations on file."}

=== RESTAURANT TABLE AVAILABILITY ===
${tableInfo}

Today's date: ${new Date().toISOString().split("T")[0]}

=== POLICIES — YOU MUST FOLLOW THESE ===

1. GUEST PERSONALIZATION (REQUIRED):
   - Always review the guest's notes and preferences BEFORE responding.
   - If the guest has seating preferences (e.g., "Prefers window seating"), proactively suggest or prioritize those when booking or modifying reservations.
   - If a reservation has special occasion notes (e.g., "Anniversary dinner", "Birthday celebration", "Graduation"), acknowledge it warmly — congratulate them, wish them well, or offer to make it extra special. Make the guest feel celebrated.
   - If the guest is marked as a VIP or has special treatment notes, acknowledge their loyalty (e.g., "As always, we'll have your complimentary dessert ready").

2. DIETARY AWARENESS (REQUIRED):
   - Always check the guest's dietary restrictions field before confirming any reservation.
   - When booking or modifying a reservation, proactively mention that you've noted their dietary needs (e.g., "I've noted your vegetarian preference for the kitchen").
   - If the guest mentions a NEW dietary restriction or allergy, immediately use the addGuestNote tool to log it with type "dietary" — do not just reply, take the action.
   - For serious allergies (e.g., tree nuts, shellfish), emphasize that the kitchen will be alerted.

3. OVERBOOKING PREVENTION (REQUIRED):
   - NEVER book a table that already has a confirmed reservation at the same date and time.
   - Before booking, verify table availability using the table availability data above. Each table can only hold ONE confirmed reservation per time slot.
   - If no table with sufficient capacity is available at the requested time, suggest the closest alternative time or date — do not just say "no tables available."
   - When modifying a reservation's party size, verify the assigned table can still accommodate the new size. If not, find and reassign to an appropriate available table.

4. HOURS OF OPERATION (REQUIRED):
   - NEVER book or modify a reservation to a time outside the restaurant's operating hours (${restaurant.opensAt} to ${restaurant.closesAt}).
   - If a guest requests a time before ${restaurant.opensAt} or at/after ${restaurant.closesAt}, politely decline and suggest the closest available time within operating hours.
   - The last reservation should be at least 1 hour before closing to allow guests time to dine.

5. CONVERSATION STYLE:
   - Be warm, professional, and concise — this is SMS.
   - Use the guest's first name naturally.
   - Always confirm what you did after taking an action.
   - If the guest's request is ambiguous, ask for clarification.
   - You can handle multiple requests in one turn.`;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const { message, guestId, conversationHistory } = await req.json();

  // Fetch guest with reservations
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: {
      reservations: {
        include: { table: true },
        orderBy: { date: "asc" },
      },
    },
  });

  if (!guest) {
    return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  }

  // Fetch restaurant hours
  const restaurant = await prisma.restaurant.findFirst({
    where: { id: 1 },
    select: { name: true, opensAt: true, closesAt: true },
  });

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 500 });
  }

  // Fetch all tables with their confirmed reservations for availability context
  const tables = await prisma.restaurantTable.findMany({
    include: {
      reservations: {
        where: { status: "confirmed" },
        select: { date: true, time: true, status: true },
      },
    },
    orderBy: { id: "asc" },
  });

  const systemPrompt = buildSystemPrompt(guest, tables, restaurant);

  // Build messages array: conversation history + new message
  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory,
    { role: "user", content: message },
  ];

  const actions: ActionRecord[] = [];

  // Tool-use loop
  let response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    tools: toolDefinitions,
    messages,
  });

  // Process tool calls in a loop (max 10 iterations for safety)
  let iterations = 0;
  while (response.stop_reason === "tool_use" && iterations < 10) {
    iterations++;

    // Add assistant's response to messages
    messages.push({ role: "assistant", content: response.content });

    // Process all tool uses in this response
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        try {
          const { result, action } = await executeTool(
            block.name,
            block.input as Record<string, unknown>
          );
          actions.push(action);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        } catch (error) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            is_error: true,
          });
        }
      }
    }

    // Send tool results back to Claude
    messages.push({ role: "user", content: toolResults });

    response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      tools: toolDefinitions,
      messages,
    });
  }

  // Add final assistant response to messages
  messages.push({ role: "assistant", content: response.content });

  // Extract text reply
  const textBlocks = response.content.filter(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  const reply = textBlocks.map((b) => b.text).join("\n");

  // Return the full message history so the frontend can pass it back on the next turn
  return NextResponse.json({ reply, actions, updatedHistory: messages });
}
