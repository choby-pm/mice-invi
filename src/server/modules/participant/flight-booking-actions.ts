"use server";
import { createClient } from "@/lib/supabase/server";

export interface FlightBookingIdentity {
  participant_id: string; first_name: string; last_name: string; birth_date: string | null;
  gender: string | null; nationality: string; passport_no: string | null;
  passport_country: string | null; passport_expiry: string | null;
  passport_status: "AVAILABLE" | "MISSING" | "PURGED" | "CONSENT_REQUIRED";
}

export async function readFlightBookingIdentity(serviceItemId: string): Promise<FlightBookingIdentity[]> {
  const client = await createClient();
  const result = await client.rpc("read_flight_booking_identity", { p_service_item_id: serviceItemId });
  if (result.error) throw new Error("발권 정보를 열람할 수 없습니다. 항공 업무 배정과 정산 상태를 확인해 주세요.");
  return (result.data ?? []) as FlightBookingIdentity[];
}
