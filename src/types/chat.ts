export interface ActionRecord {
  tool: string;
  input: Record<string, unknown>;
  result: string;
  timestamp: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: ActionRecord[];
}

export interface GuestWithReservations {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dietary: string | null;
  notes: string | null;
  reservations: ReservationWithTable[];
}

export interface ReservationWithTable {
  id: number;
  guestId: number;
  tableId: number;
  partySize: number;
  date: string;
  time: string;
  status: string;
  notes: string | null;
  table: {
    id: number;
    capacity: number;
    location: string;
  };
}
