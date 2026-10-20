"use server";

import { revalidateLinkedViews } from "@/server/revalidate-linked-views";
import { fromFormDateTime } from "@/lib/date";
import { replaceServiceDetails } from "@/server/modules/service-item/replace-details";
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
    throw new Error("배차 입력 형식이 올바르지 않습니다.");
  }
  if (!Array.isArray(vehicles) || !vehicles.length || vehicles.some((v) => !v || !v.departAt || !Array.isArray(v.participantIds))) throw new Error("차량 출발 시각과 탑승 참가자를 확인해 주세요.");

  const supabase = await createServerSupabaseClient();

  await replaceServiceDetails(supabase, "vehicle_dispatch", serviceItemId,
      vehicles.map((v) => ({
        service_item_id: serviceItemId,
        from_text: v.fromText || null,
        to_text: v.toText || null,
        depart_at: v.departAt ? fromFormDateTime(v.departAt) : null,
        vehicle_class: v.vehicleClass || null,
        plate_no: v.plateNo || null,
        driver_name: v.driverName || null,
        driver_phone: v.driverPhone || null,
        participant_ids: v.participantIds ?? [],
        luggage_note: v.luggageNote || null,
      })),
  );

  const first = vehicles[0];
  const confirmationNote = vehicles.length
    ? `${first.vehicleClass ?? "차량"} ${first.departAt ? new Date(first.departAt).toLocaleString("ko-KR") : ""}${vehicles.length > 1 ? ` 외 ${vehicles.length - 1}대` : ""}`
    : null;

  const confirmed = await supabase
    .from("service_item")
    .update({ status: "CONFIRMED", confirmation_note: confirmationNote, confirmed_at: new Date().toISOString() })
    .eq("id", serviceItemId).select("id").maybeSingle();
  if (confirmed.error || !confirmed.data) throw new Error("배차 확정을 저장하지 못했습니다.");

  revalidateLinkedViews();
}
