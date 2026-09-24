"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

interface VehicleDispatchInput {
  fromText?: string;
  toText?: string;
  departAt?: string;
  vehicleClass?: string;
  plateNo?: string;
  driverName?: string;
  driverPhone?: string;
  participantIds: string[];
  luggageNote?: string;
}

// 배차 확정 저장 (수송 업체). BR-08-1 — 차량 단위로 참가자 여러 명을 묶고, 한 대표단이
// 여러 차량을 쓸 수 있어 이번 저장으로 기존 차량 목록을 통째로 교체합니다.
export async function saveVehicleDispatches(formData: FormData) {
  const serviceItemId = formData.get("id") as string;
  if (!serviceItemId) return;

  let vehicles: VehicleDispatchInput[] = [];
  try {
    vehicles = JSON.parse((formData.get("vehicles") as string) || "[]");
  } catch {
    vehicles = [];
  }
  vehicles = vehicles.filter((v) => v.departAt);

  const supabase = await createServerSupabaseClient();

  await supabase.from("vehicle_dispatch").delete().eq("service_item_id", serviceItemId);

  if (vehicles.length > 0) {
    await supabase.from("vehicle_dispatch").insert(
      vehicles.map((v) => ({
        service_item_id: serviceItemId,
        from_text: v.fromText || null,
        to_text: v.toText || null,
        depart_at: v.departAt ? new Date(v.departAt).toISOString() : null,
        vehicle_class: v.vehicleClass || null,
        plate_no: v.plateNo || null,
        driver_name: v.driverName || null,
        driver_phone: v.driverPhone || null,
        participant_ids: v.participantIds ?? [],
        luggage_note: v.luggageNote || null,
      })),
    );
  }

  const first = vehicles[0];
  const confirmationNote = vehicles.length
    ? `${first.vehicleClass ?? "차량"} ${first.departAt ? new Date(first.departAt).toLocaleString("ko-KR") : ""}${vehicles.length > 1 ? ` 외 ${vehicles.length - 1}대` : ""}`
    : null;

  await supabase
    .from("service_item")
    .update({ status: "CONFIRMED", confirmation_note: confirmationNote, confirmed_at: new Date().toISOString() })
    .eq("id", serviceItemId);

  revalidatePath("/vendor");
}
