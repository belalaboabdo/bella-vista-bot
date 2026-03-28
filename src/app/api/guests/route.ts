import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const guests = await prisma.guest.findMany({
    include: {
      reservations: {
        include: { table: true },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { id: "asc" },
  });
  return NextResponse.json(guests);
}
