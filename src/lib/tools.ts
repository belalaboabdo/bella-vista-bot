import { prisma } from "./prisma";
import { ActionRecord } from "@/types/chat";
import Anthropic from "@anthropic-ai/sdk";

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "bookReservation",
    description:
      "Book a new reservation for a guest. Automatically assigns the best available table based on party size and guest preferences (e.g., window seating). If the guest has a seating preference in their notes, pass it as preferredLocation.",
    input_schema: {
      type: "object" as const,
      properties: {
        guestId: { type: "number", description: "The guest's ID" },
        date: { type: "string", description: "Reservation date in YYYY-MM-DD format" },
        time: { type: "string", description: "Reservation time in HH:MM format (24h)" },
        partySize: { type: "number", description: "Number of guests in the party" },
        notes: { type: "string", description: "Optional notes for the reservation" },
        preferredLocation: { type: "string", description: "Preferred table location if the guest has a seating preference (e.g., 'window', 'patio', 'private room')" },
      },
      required: ["guestId", "date", "time", "partySize"],
    },
  },
  {
    name: "modifyReservation",
    description:
      "Modify an existing reservation. Can change the date, time, party size, or notes.",
    input_schema: {
      type: "object" as const,
      properties: {
        reservationId: { type: "number", description: "The reservation ID to modify" },
        date: { type: "string", description: "New date in YYYY-MM-DD format" },
        time: { type: "string", description: "New time in HH:MM format (24h)" },
        partySize: { type: "number", description: "New party size" },
        notes: { type: "string", description: "Updated notes" },
      },
      required: ["reservationId"],
    },
  },
  {
    name: "cancelReservation",
    description: "Cancel an existing reservation by setting its status to cancelled.",
    input_schema: {
      type: "object" as const,
      properties: {
        reservationId: { type: "number", description: "The reservation ID to cancel" },
      },
      required: ["reservationId"],
    },
  },
  {
    name: "addGuestNote",
    description:
      "Log a special request, dietary need, allergy, or preference for a guest. This updates the guest's profile record. Only call this ONCE per note — the note is stored on the guest, not on a reservation. Use the guest's numeric ID (e.g., 1, 2, 3), not a reservation ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        guestId: { type: "number", description: "The guest's ID" },
        note: { type: "string", description: "The note to add (e.g., allergy info, preference)" },
        type: {
          type: "string",
          enum: ["dietary", "preference"],
          description: "Whether this is a dietary note or a general preference",
        },
      },
      required: ["guestId", "note", "type"],
    },
  },
];

interface ToolResult {
  result: string;
  action: ActionRecord;
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const timestamp = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  switch (toolName) {
    case "bookReservation":
      return bookReservation(input, timestamp);
    case "modifyReservation":
      return modifyReservation(input, timestamp);
    case "cancelReservation":
      return cancelReservation(input, timestamp);
    case "addGuestNote":
      return addGuestNote(input, timestamp);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function bookReservation(
  input: Record<string, unknown>,
  timestamp: string
): Promise<ToolResult> {
  const { date, time, notes, preferredLocation } = input as {
    guestId: number;
    date: string;
    time: string;
    partySize: number;
    notes?: string;
    preferredLocation?: string;
  };
  const guestId = Number(input.guestId);
  const partySize = Number(input.partySize);

  // Validate against restaurant hours
  const restaurant = await prisma.restaurant.findFirst({ where: { id: 1 } });
  if (restaurant) {
    const requestedMinutes = parseInt(time.split(":")[0]) * 60 + parseInt(time.split(":")[1]);
    const opensMinutes = parseInt(restaurant.opensAt.split(":")[0]) * 60 + parseInt(restaurant.opensAt.split(":")[1]);
    const closesMinutes = parseInt(restaurant.closesAt.split(":")[0]) * 60 + parseInt(restaurant.closesAt.split(":")[1]);

    if (requestedMinutes < opensMinutes || requestedMinutes >= closesMinutes) {
      return {
        result: `Cannot book at ${time}. Bella Vista is open from ${restaurant.opensAt} to ${restaurant.closesAt}. Please choose a time within operating hours.`,
        action: {
          tool: "bookReservation",
          input,
          result: `Rejected — ${time} is outside operating hours (${restaurant.opensAt}–${restaurant.closesAt})`,
          timestamp,
        },
      };
    }
  }

  // Find available tables with sufficient capacity
  const tables = await prisma.restaurantTable.findMany({
    where: { capacity: { gte: partySize } },
    orderBy: { capacity: "asc" },
    include: {
      reservations: {
        where: { date, status: "confirmed" },
      },
    },
  });

  const availableTables = tables.filter(
    (t) => !t.reservations.some((r) => r.time === time)
  );

  // Prioritize preferred location if specified
  const availableTable = preferredLocation
    ? availableTables.find((t) => t.location.toLowerCase() === preferredLocation.toLowerCase()) || availableTables[0]
    : availableTables[0];

  if (!availableTable) {
    return {
      result: `No available table found for a party of ${partySize} on ${date} at ${time}.`,
      action: {
        tool: "bookReservation",
        input,
        result: "No table available",
        timestamp,
      },
    };
  }

  const reservation = await prisma.reservation.create({
    data: {
      guestId,
      tableId: availableTable.id,
      partySize,
      date,
      time,
      status: "confirmed",
      notes: notes || null,
    },
    include: { table: true },
  });

  const result = `Reservation #${reservation.id} created: party of ${partySize} on ${date} at ${time}, table ${reservation.table.id} (${reservation.table.location}).`;

  return {
    result,
    action: {
      tool: "bookReservation",
      input,
      result: `Reservation created — ID: ${reservation.id}, table: ${reservation.table.location}`,
      timestamp,
    },
  };
}

async function modifyReservation(
  input: Record<string, unknown>,
  timestamp: string
): Promise<ToolResult> {
  const { date, time, notes } = input as {
    reservationId: number;
    date?: string;
    time?: string;
    partySize?: number;
    notes?: string;
  };
  const reservationId = Number(input.reservationId);
  const partySize = input.partySize ? Number(input.partySize) : undefined;

  // Validate time change against restaurant hours
  if (time) {
    const restaurant = await prisma.restaurant.findFirst({ where: { id: 1 } });
    if (restaurant) {
      const requestedMinutes = parseInt(time.split(":")[0]) * 60 + parseInt(time.split(":")[1]);
      const opensMinutes = parseInt(restaurant.opensAt.split(":")[0]) * 60 + parseInt(restaurant.opensAt.split(":")[1]);
      const closesMinutes = parseInt(restaurant.closesAt.split(":")[0]) * 60 + parseInt(restaurant.closesAt.split(":")[1]);

      if (requestedMinutes < opensMinutes || requestedMinutes >= closesMinutes) {
        return {
          result: `Cannot modify to ${time}. Bella Vista is open from ${restaurant.opensAt} to ${restaurant.closesAt}.`,
          action: { tool: "modifyReservation", input, result: `Rejected — ${time} is outside operating hours`, timestamp },
        };
      }
    }
  }

  const existing = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { table: true },
  });

  if (!existing) {
    return {
      result: `Reservation #${reservationId} not found.`,
      action: { tool: "modifyReservation", input, result: "Not found", timestamp },
    };
  }

  const updateData: Record<string, unknown> = {};
  if (date) updateData.date = date;
  if (time) updateData.time = time;
  if (partySize) updateData.partySize = partySize;
  if (notes !== undefined) updateData.notes = notes;

  // If party size increased, check if current table fits
  if (partySize && partySize > existing.table.capacity) {
    const newTable = await prisma.restaurantTable.findFirst({
      where: { capacity: { gte: partySize } },
      orderBy: { capacity: "asc" },
    });
    if (newTable) {
      updateData.tableId = newTable.id;
    }
  }

  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: updateData,
    include: { table: true },
  });

  const changes = [];
  if (date) changes.push(`date: ${date}`);
  if (time) changes.push(`time: ${time}`);
  if (partySize) changes.push(`party size: ${partySize}`);
  if (notes !== undefined) changes.push(`notes: "${notes}"`);

  const result = `Reservation #${reservationId} updated: ${changes.join(", ")}. Table: ${updated.table.id} (${updated.table.location}).`;

  return {
    result,
    action: {
      tool: "modifyReservation",
      input,
      result: `Reservation #${reservationId} updated — ${changes.join(", ")}`,
      timestamp,
    },
  };
}

async function cancelReservation(
  input: Record<string, unknown>,
  timestamp: string
): Promise<ToolResult> {
  const reservationId = Number(input.reservationId);

  const existing = await prisma.reservation.findUnique({
    where: { id: reservationId },
  });

  if (!existing) {
    return {
      result: `Reservation #${reservationId} not found.`,
      action: { tool: "cancelReservation", input, result: "Not found", timestamp },
    };
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: "cancelled" },
  });

  return {
    result: `Reservation #${reservationId} has been cancelled.`,
    action: {
      tool: "cancelReservation",
      input,
      result: `Reservation #${reservationId} cancelled`,
      timestamp,
    },
  };
}

async function addGuestNote(
  input: Record<string, unknown>,
  timestamp: string
): Promise<ToolResult> {
  const { note, type } = input as {
    guestId: number;
    note: string;
    type: "dietary" | "preference";
  };
  const guestId = Number(input.guestId);

  const guest = await prisma.guest.findUnique({ where: { id: guestId } });
  if (!guest) {
    return {
      result: `Guest #${guestId} not found.`,
      action: { tool: "addGuestNote", input, result: "Not found", timestamp },
    };
  }

  if (type === "dietary") {
    const current = guest.dietary || "";
    const updated = current ? `${current}, ${note}` : note;
    await prisma.guest.update({ where: { id: guestId }, data: { dietary: updated } });
  } else {
    const current = guest.notes || "";
    const updated = current ? `${current}. ${note}` : note;
    await prisma.guest.update({ where: { id: guestId }, data: { notes: updated } });
  }

  return {
    result: `Note logged for guest #${guestId}: "${note}" (${type}).`,
    action: {
      tool: "addGuestNote",
      input,
      result: `Guest note added — "${note}"`,
      timestamp,
    },
  };
}
