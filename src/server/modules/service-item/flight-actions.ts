"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/date";

interface FlightSegmentInput {
  direction: "INBOUND" | "OUTBOUND";
  flightNo: string;
  depAirport: string;
  arrAirport: string;
  depAt: string;
  arrAt: string;
  cabinClass?: string;
  pnr?: string;
  ticketNo?: string;
  ticketStatus?: string;
  changeFee?: string;
  changeFeeCurrency?: string;
}

// 항공 요청 저장 (대리인·PCO). 03 §2.1 원칙대로 "요청 제출"이라는 행동 하나만 노출 —
// DRAFT일 때만 REQUESTED로 넘어가고, 이후엔 내용만 갱신합니다. service_item.note/scheduled_at에는
// 사람이 읽기 쉬운 요약을 같이 남겨서 콘솔·업체 목록 화면이 구조화 필드 없이도 계속 동작합니다.
export async function saveFlightRequest(formData: FormData) {
  const serviceItemId = formData.get("serviceItemId") as string;
  const revalidateTo = formData.get("revalidateTo") as string;
  if (!serviceItemId) return;

  const inboundOriginCity = (formData.get("inboundOriginCity") as string)?.trim() || null;
  const inboundDestAirport = (formData.get("inboundDestAirport") as string)?.trim() || null;
  const inboundPreferredDate = (formData.get("inboundPreferredDate") as string) || null;
  const outboundPreferredDate = (formData.get("outboundPreferredDate") as string) || null;
  const outboundOriginAirport = (formData.get("outboundOriginAirport") as string)?.trim() || null;
  const outboundDestCity = (formData.get("outboundDestCity") as string)?.trim() || null;
  const note = (formData.get("note") as string)?.trim() || null;

  const supabase = await createServerSupabaseClient();
  const { data: item } = await supabase.from("service_item").select("status").eq("id", serviceItemId).single();
  if (!item) return;

  await supabase.from("flight_request").upsert(
    {
      service_item_id: serviceItemId,
      inbound_origin_city: inboundOriginCity,
      inbound_dest_airport: inboundDestAirport,
      inbound_preferred_date: inboundPreferredDate,
      outbound_preferred_date: outboundPreferredDate,
      outbound_origin_airport: outboundOriginAirport,
      outbound_dest_city: outboundDestCity,
      note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "service_item_id" },
  );

  const summary = [
    inboundDestAirport && `${inboundDestAirport} 도착 희망${inboundPreferredDate ? ` (${formatDate(inboundPreferredDate, "ko")})` : ""}`,
    outboundOriginAirport && `${outboundOriginAirport} 출발 희망${outboundPreferredDate ? ` (${formatDate(outboundPreferredDate, "ko")})` : ""}`,
  ]
    .filter(Boolean)
    .join(" · ") || null;

  await supabase
    .from("service_item")
    .update({
      note: summary,
      scheduled_at: inboundPreferredDate ? new Date(inboundPreferredDate).toISOString() : null,
      status: item.status === "DRAFT" ? "REQUESTED" : item.status,
    })
    .eq("id", serviceItemId);

  if (revalidateTo) revalidatePath(revalidateTo);
}

// 항공 확정 저장 (업체). 방향별 구간을 통째로 교체하고, 방향별 마지막 구간(도착 시각 기준)에
// is_final_arrival을 표시합니다 — 03 §"BR-06-2" 입국 최종 도착 구간이 수송 등 다른 서비스에
// 영향을 주는 기준값이라서요.
export async function saveFlightSegments(formData: FormData) {
  const serviceItemId = formData.get("id") as string;
  if (!serviceItemId) return;

  let segments: FlightSegmentInput[] = [];
  try {
    segments = JSON.parse((formData.get("segments") as string) || "[]");
  } catch {
    segments = [];
  }
  segments = segments.filter((s) => s.flightNo && s.depAt && s.arrAt);

  const supabase = await createServerSupabaseClient();

  await supabase.from("flight_segment").delete().eq("service_item_id", serviceItemId);

  const byDirection: Record<string, FlightSegmentInput[]> = { INBOUND: [], OUTBOUND: [] };
  for (const s of segments) byDirection[s.direction]?.push(s);

  const rows: Record<string, unknown>[] = [];
  for (const [direction, list] of Object.entries(byDirection)) {
    list.sort((a, b) => new Date(a.depAt).getTime() - new Date(b.depAt).getTime());
    list.forEach((s, idx) => {
      rows.push({
        service_item_id: serviceItemId,
        direction,
        seq: idx + 1,
        flight_no: s.flightNo,
        dep_airport: s.depAirport || null,
        arr_airport: s.arrAirport || null,
        dep_at: new Date(s.depAt).toISOString(),
        arr_at: new Date(s.arrAt).toISOString(),
        cabin_class: s.cabinClass || null,
        pnr: s.pnr || null,
        ticket_no: s.ticketNo || null,
        ticket_status: s.ticketStatus || "BOOKED",
        change_fee: s.changeFee ? Number(s.changeFee) : null,
        change_fee_currency: s.changeFeeCurrency || null,
        is_final_arrival: direction === "INBOUND" && idx === list.length - 1,
      });
    });
  }
  if (rows.length > 0) await supabase.from("flight_segment").insert(rows);

  const finalArrival = byDirection.INBOUND.at(-1);
  const firstDeparture = byDirection.OUTBOUND[0];
  const confirmationNote = [
    finalArrival && `입국 ${finalArrival.flightNo} ${finalArrival.arrAirport ?? ""} 도착 ${formatDate(finalArrival.arrAt, "ko")}`,
    firstDeparture && `귀국 ${firstDeparture.flightNo} ${firstDeparture.depAirport ?? ""} 출발 ${formatDate(firstDeparture.depAt, "ko")}`,
  ]
    .filter(Boolean)
    .join(" / ") || null;

  await supabase
    .from("service_item")
    .update({ status: "CONFIRMED", confirmation_note: confirmationNote, confirmed_at: new Date().toISOString() })
    .eq("id", serviceItemId);

  revalidatePath("/vendor");
}
