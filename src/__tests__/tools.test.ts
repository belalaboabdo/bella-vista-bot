import { describe, it, expect, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { executeTool } from "../lib/tools";

const prisma = new PrismaClient();

// Re-seed the database before each test to ensure clean state
async function seed() {
  await prisma.conversation.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.restaurant.deleteMany();

  await prisma.restaurant.create({
    data: {
      id: 1,
      name: "Bella Vista",
      phone: "+15551000000",
      address: "123 Main Street, New York, NY 10001",
      opensAt: "11:00",
      closesAt: "23:00",
    },
  });

  await prisma.guest.createMany({
    data: [
      { id: 1, firstName: "Maria", lastName: "Chen", phone: "+15551001001", email: "maria@email.com", dietary: "vegetarian", notes: "Prefers window seating" },
      { id: 2, firstName: "James", lastName: "Patel", phone: "+15551001002", email: "james@email.com", dietary: "none", notes: "Regular — birthday in June" },
      { id: 3, firstName: "Sofia", lastName: "Reyes", phone: "+15551001003", email: "sofia@email.com", dietary: "gluten-free", notes: "Allergy: tree nuts" },
      { id: 4, firstName: "Marcus", lastName: "Nguyen", phone: "+15551001004", email: "marcus@email.com", dietary: "vegan", notes: "VIP — comp dessert on visits" },
    ],
  });

  await prisma.restaurantTable.createMany({
    data: [
      { id: 1, capacity: 2, location: "window" },
      { id: 2, capacity: 2, location: "patio" },
      { id: 3, capacity: 4, location: "main" },
      { id: 4, capacity: 4, location: "main" },
      { id: 5, capacity: 6, location: "private room" },
    ],
  });

  await prisma.reservation.createMany({
    data: [
      { id: 1, guestId: 1, tableId: 3, partySize: 3, date: "2026-03-20", time: "19:00", status: "confirmed", notes: "Anniversary dinner" },
      { id: 2, guestId: 2, tableId: 1, partySize: 2, date: "2026-03-21", time: "20:00", status: "confirmed", notes: null },
      { id: 3, guestId: 3, tableId: 5, partySize: 5, date: "2026-03-22", time: "18:30", status: "confirmed", notes: "Gluten-free menu requested" },
      { id: 4, guestId: 4, tableId: 4, partySize: 4, date: "2026-03-19", time: "19:30", status: "completed", notes: null },
    ],
  });

  // Reset sequences
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Restaurant"', 'id'), (SELECT MAX(id) FROM "Restaurant"))`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Guest"', 'id'), (SELECT MAX(id) FROM "Guest"))`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"RestaurantTable"', 'id'), (SELECT MAX(id) FROM "RestaurantTable"))`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Reservation"', 'id'), (SELECT MAX(id) FROM "Reservation"))`;
}

beforeEach(async () => {
  await seed();
});

// ============================================================
// 1. BOOK RESERVATION
// ============================================================
describe("bookReservation", () => {
  it("should create a new reservation and assign a table", async () => {
    const result = await executeTool("bookReservation", {
      guestId: 2,
      date: "2026-04-01",
      time: "19:00",
      partySize: 2,
    });

    // Verify tool returned success
    expect(result.result).toContain("created");
    expect(result.action.tool).toBe("bookReservation");

    // Verify DB was updated
    const reservation = await prisma.reservation.findFirst({
      where: { guestId: 2, date: "2026-04-01" },
      include: { table: true },
    });
    expect(reservation).not.toBeNull();
    expect(reservation!.partySize).toBe(2);
    expect(reservation!.time).toBe("19:00");
    expect(reservation!.status).toBe("confirmed");
    expect(reservation!.table.capacity).toBeGreaterThanOrEqual(2);
  });

  it("should assign the smallest table that fits the party", async () => {
    const result = await executeTool("bookReservation", {
      guestId: 1,
      date: "2026-04-05",
      time: "20:00",
      partySize: 2,
    });

    expect(result.result).toContain("created");

    const reservation = await prisma.reservation.findFirst({
      where: { guestId: 1, date: "2026-04-05" },
      include: { table: true },
    });
    // Should get a 2-person table (window or patio), not a 4 or 6
    expect(reservation!.table.capacity).toBe(2);
  });

  it("should save optional notes on the reservation", async () => {
    await executeTool("bookReservation", {
      guestId: 3,
      date: "2026-04-10",
      time: "18:00",
      partySize: 4,
      notes: "Birthday celebration",
    });

    const reservation = await prisma.reservation.findFirst({
      where: { guestId: 3, date: "2026-04-10" },
    });
    expect(reservation!.notes).toBe("Birthday celebration");
  });

  it("should return 'no table available' when all tables are booked", async () => {
    // Book all 2-capacity tables at the same date/time
    await executeTool("bookReservation", { guestId: 1, date: "2026-05-01", time: "19:00", partySize: 2 });
    await executeTool("bookReservation", { guestId: 2, date: "2026-05-01", time: "19:00", partySize: 2 });
    // Book all 4-capacity tables
    await executeTool("bookReservation", { guestId: 3, date: "2026-05-01", time: "19:00", partySize: 3 });
    await executeTool("bookReservation", { guestId: 4, date: "2026-05-01", time: "19:00", partySize: 3 });
    // Book the 6-capacity table
    await executeTool("bookReservation", { guestId: 1, date: "2026-05-01", time: "19:00", partySize: 5 });

    // Now try to book another — no tables left
    const result = await executeTool("bookReservation", {
      guestId: 2,
      date: "2026-05-01",
      time: "19:00",
      partySize: 2,
    });

    expect(result.result).toContain("No available table");
  });

  it("should reject bookings before opening hours", async () => {
    const result = await executeTool("bookReservation", {
      guestId: 1,
      date: "2026-04-01",
      time: "09:00",
      partySize: 2,
    });

    expect(result.result).toContain("Cannot book");
    expect(result.result).toContain("11:00");
    expect(result.result).toContain("23:00");

    // Verify no reservation was created
    const reservation = await prisma.reservation.findFirst({
      where: { guestId: 1, date: "2026-04-01", time: "09:00" },
    });
    expect(reservation).toBeNull();
  });

  it("should reject bookings at or after closing time", async () => {
    const result = await executeTool("bookReservation", {
      guestId: 2,
      date: "2026-04-01",
      time: "23:00",
      partySize: 2,
    });

    expect(result.result).toContain("Cannot book");

    // Verify no reservation was created
    const reservation = await prisma.reservation.findFirst({
      where: { guestId: 2, date: "2026-04-01", time: "23:00" },
    });
    expect(reservation).toBeNull();
  });

  it("should allow bookings within operating hours", async () => {
    const result = await executeTool("bookReservation", {
      guestId: 1,
      date: "2026-04-01",
      time: "12:00",
      partySize: 2,
    });

    expect(result.result).toContain("created");

    const reservation = await prisma.reservation.findFirst({
      where: { guestId: 1, date: "2026-04-01", time: "12:00" },
    });
    expect(reservation).not.toBeNull();
  });
});

// ============================================================
// 2. MODIFY RESERVATION
// ============================================================
describe("modifyReservation", () => {
  it("should update the date of an existing reservation", async () => {
    const result = await executeTool("modifyReservation", {
      reservationId: 1,
      date: "2026-03-25",
    });

    expect(result.result).toContain("updated");
    expect(result.action.tool).toBe("modifyReservation");

    // Verify DB
    const reservation = await prisma.reservation.findUnique({ where: { id: 1 } });
    expect(reservation!.date).toBe("2026-03-25");
  });

  it("should update the time of an existing reservation", async () => {
    await executeTool("modifyReservation", {
      reservationId: 2,
      time: "21:00",
    });

    const reservation = await prisma.reservation.findUnique({ where: { id: 2 } });
    expect(reservation!.time).toBe("21:00");
  });

  it("should update the party size", async () => {
    await executeTool("modifyReservation", {
      reservationId: 2,
      partySize: 4,
    });

    const reservation = await prisma.reservation.findUnique({ where: { id: 2 } });
    expect(reservation!.partySize).toBe(4);
  });

  it("should reassign table when party size exceeds current table capacity", async () => {
    // Reservation #2 is on table 1 (capacity 2). Increase party to 5.
    await executeTool("modifyReservation", {
      reservationId: 2,
      partySize: 5,
    });

    const reservation = await prisma.reservation.findUnique({
      where: { id: 2 },
      include: { table: true },
    });
    // Should be moved to a bigger table (capacity >= 5 → private room, capacity 6)
    expect(reservation!.table.capacity).toBeGreaterThanOrEqual(5);
  });

  it("should update notes on an existing reservation", async () => {
    await executeTool("modifyReservation", {
      reservationId: 1,
      notes: "Changed to anniversary + birthday",
    });

    const reservation = await prisma.reservation.findUnique({ where: { id: 1 } });
    expect(reservation!.notes).toBe("Changed to anniversary + birthday");
  });

  it("should update multiple fields at once", async () => {
    await executeTool("modifyReservation", {
      reservationId: 1,
      date: "2026-03-28",
      time: "20:30",
      partySize: 4,
    });

    const reservation = await prisma.reservation.findUnique({ where: { id: 1 } });
    expect(reservation!.date).toBe("2026-03-28");
    expect(reservation!.time).toBe("20:30");
    expect(reservation!.partySize).toBe(4);
  });

  it("should return 'not found' for non-existent reservation", async () => {
    const result = await executeTool("modifyReservation", {
      reservationId: 999,
      date: "2026-04-01",
    });

    expect(result.result).toContain("not found");
  });

  it("should reject modifying time to outside operating hours", async () => {
    const result = await executeTool("modifyReservation", {
      reservationId: 1,
      time: "23:30",
    });

    expect(result.result).toContain("Cannot modify");
    expect(result.result).toContain("23:00");

    // Verify the time was NOT changed in DB
    const reservation = await prisma.reservation.findUnique({ where: { id: 1 } });
    expect(reservation!.time).toBe("19:00"); // original time unchanged
  });
});

// ============================================================
// 3. CANCEL RESERVATION
// ============================================================
describe("cancelReservation", () => {
  it("should set reservation status to cancelled", async () => {
    const result = await executeTool("cancelReservation", {
      reservationId: 1,
    });

    expect(result.result).toContain("cancelled");
    expect(result.action.tool).toBe("cancelReservation");

    // Verify DB
    const reservation = await prisma.reservation.findUnique({ where: { id: 1 } });
    expect(reservation!.status).toBe("cancelled");
  });

  it("should not delete the reservation row, only update status", async () => {
    await executeTool("cancelReservation", { reservationId: 2 });

    const reservation = await prisma.reservation.findUnique({ where: { id: 2 } });
    expect(reservation).not.toBeNull();
    expect(reservation!.status).toBe("cancelled");
    // Other fields should remain intact
    expect(reservation!.guestId).toBe(2);
    expect(reservation!.date).toBe("2026-03-21");
  });

  it("should return 'not found' for non-existent reservation", async () => {
    const result = await executeTool("cancelReservation", {
      reservationId: 999,
    });

    expect(result.result).toContain("not found");
  });
});

// ============================================================
// 4. ADD GUEST NOTE
// ============================================================
describe("addGuestNote", () => {
  it("should append a dietary note to the guest record", async () => {
    const result = await executeTool("addGuestNote", {
      guestId: 2,
      note: "allergic to shellfish",
      type: "dietary",
    });

    expect(result.result).toContain("Note logged");
    expect(result.action.tool).toBe("addGuestNote");

    // Verify DB — James had "none", should now include the new note
    const guest = await prisma.guest.findUnique({ where: { id: 2 } });
    expect(guest!.dietary).toContain("allergic to shellfish");
  });

  it("should append to existing dietary info (not replace)", async () => {
    // Maria already has "vegetarian"
    await executeTool("addGuestNote", {
      guestId: 1,
      note: "also lactose intolerant",
      type: "dietary",
    });

    const guest = await prisma.guest.findUnique({ where: { id: 1 } });
    expect(guest!.dietary).toContain("vegetarian");
    expect(guest!.dietary).toContain("also lactose intolerant");
  });

  it("should append a preference note to the guest record", async () => {
    await executeTool("addGuestNote", {
      guestId: 1,
      note: "Celebrating anniversary",
      type: "preference",
    });

    const guest = await prisma.guest.findUnique({ where: { id: 1 } });
    // Should append to existing notes "Prefers window seating"
    expect(guest!.notes).toContain("Prefers window seating");
    expect(guest!.notes).toContain("Celebrating anniversary");
  });

  it("should handle adding a note to a guest with no existing notes", async () => {
    // Clear Sofia's notes first
    await prisma.guest.update({ where: { id: 3 }, data: { notes: null } });

    await executeTool("addGuestNote", {
      guestId: 3,
      note: "Prefers booth seating",
      type: "preference",
    });

    const guest = await prisma.guest.findUnique({ where: { id: 3 } });
    expect(guest!.notes).toBe("Prefers booth seating");
  });

  it("should return 'not found' for non-existent guest", async () => {
    const result = await executeTool("addGuestNote", {
      guestId: 999,
      note: "test",
      type: "dietary",
    });

    expect(result.result).toContain("not found");
  });
});

// ============================================================
// 5. CONVERSATION SUMMARY (via Claude API directly)
// ============================================================
describe("conversation summary", () => {
  it("should generate a summary from conversation history", async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const conversationHistory = [
      { role: "assistant", content: "Hi Maria! Welcome to Bella Vista. How can I help you today?" },
      { role: "user", content: "Can I move my Friday reservation to Saturday at the same time?" },
      { role: "assistant", content: "Of course! I've moved your reservation from Friday March 20 to Saturday March 21 at 7:00 PM. [Actions: Reservation #1 updated — date: 2026-03-21]" },
      { role: "user", content: "Also, please note that my husband is allergic to shellfish." },
      { role: "assistant", content: "Noted! I've added that to your profile. We'll make sure the kitchen is aware. [Actions: Guest note added — \"allergic to shellfish\"]" },
    ];

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
      (block: { type: string }) => block.type === "text"
    ) as { type: "text"; text: string } | undefined;

    const summary = textBlock?.text || "";

    expect(summary.length).toBeGreaterThan(20);
    // Summary should reference key actions that occurred
    expect(summary.toLowerCase()).toMatch(/reserv|mov|chang|updat/);
    expect(summary.toLowerCase()).toMatch(/allerg|shellfish|note|diet/);
  });
});

// ============================================================
// 6. UNKNOWN TOOL
// ============================================================
describe("executeTool error handling", () => {
  it("should throw for an unknown tool name", async () => {
    await expect(
      executeTool("nonExistentTool", { foo: "bar" })
    ).rejects.toThrow("Unknown tool: nonExistentTool");
  });
});
