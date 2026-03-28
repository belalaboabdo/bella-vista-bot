import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clear existing data (order matters for foreign keys)
  await prisma.conversation.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.restaurant.deleteMany();

  // Seed restaurant
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

  // Seed guests (all belong to Bella Vista)
  await prisma.guest.createMany({
    data: [
      { id: 1, firstName: "Maria", lastName: "Chen", phone: "+15551001001", email: "maria@email.com", dietary: "vegetarian", notes: "Prefers window seating", restaurantId: 1 },
      { id: 2, firstName: "James", lastName: "Patel", phone: "+15551001002", email: "james@email.com", dietary: "none", notes: "Regular — birthday in June", restaurantId: 1 },
      { id: 3, firstName: "Sofia", lastName: "Reyes", phone: "+15551001003", email: "sofia@email.com", dietary: "gluten-free", notes: "Allergy: tree nuts", restaurantId: 1 },
      { id: 4, firstName: "Marcus", lastName: "Nguyen", phone: "+15551001004", email: "marcus@email.com", dietary: "vegan", notes: "VIP — comp dessert on visits", restaurantId: 1 },
    ],
  });

  // Seed tables (all belong to Bella Vista)
  await prisma.restaurantTable.createMany({
    data: [
      { id: 1, capacity: 2, location: "window", restaurantId: 1 },
      { id: 2, capacity: 2, location: "patio", restaurantId: 1 },
      { id: 3, capacity: 4, location: "main", restaurantId: 1 },
      { id: 4, capacity: 4, location: "main", restaurantId: 1 },
      { id: 5, capacity: 6, location: "private room", restaurantId: 1 },
    ],
  });

  // Seed reservations
  await prisma.reservation.createMany({
    data: [
      { id: 1, guestId: 1, tableId: 3, partySize: 3, date: "2026-03-20", time: "19:00", status: "confirmed", notes: "Anniversary dinner" },
      { id: 2, guestId: 2, tableId: 1, partySize: 2, date: "2026-03-21", time: "20:00", status: "confirmed", notes: null },
      { id: 3, guestId: 3, tableId: 5, partySize: 5, date: "2026-03-22", time: "18:30", status: "confirmed", notes: "Gluten-free menu requested" },
      { id: 4, guestId: 4, tableId: 4, partySize: 4, date: "2026-03-19", time: "19:30", status: "completed", notes: null },
    ],
  });

  // Reset sequences to avoid ID conflicts
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Restaurant"', 'id'), (SELECT MAX(id) FROM "Restaurant"))`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Guest"', 'id'), (SELECT MAX(id) FROM "Guest"))`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"RestaurantTable"', 'id'), (SELECT MAX(id) FROM "RestaurantTable"))`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Reservation"', 'id'), (SELECT MAX(id) FROM "Reservation"))`;

  console.log("Seed data inserted successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
