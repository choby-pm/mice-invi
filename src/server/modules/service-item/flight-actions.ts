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

  // 재확정 감지(R4 영향 엔진)를 위해 지우기 전에 이전 최종 도착/첫 출발 값을 기억해둡니다.
  const { data: oldSegments } = await supabase
    .from("flight_segment")
    .select("direction, seq, arr_at, arr_airport, dep_at, dep_airport, is_final_arrival")
    .eq("service_item_id", serviceItemId);
  const oldFinalArrival = (oldSegments ?? []).find((s) => s.direction === "INBOUND" && s.is_final_arrival);
  const oldFirstDeparture = (oldSegments ?? []).find((s) => s.direction === "OUTBOUND" && s.seq === 1);

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
  let insertedRows: { id: string; direction: string; seq: number }[] = [];
  if (rows.length > 0) {
    const { data } = await supabase.from("flight_segment").insert(rows).select("id, direction, seq");
    insertedRows = data ?? [];
  }

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

  // 입국 최종 도착 구간·귀국 첫 출발 구간이 확정되면 수송 요청을 자동 생성/갱신합니다(P08).
  // 대리인은 수송을 요청하지 않으므로 여기서만 만들어집니다 — 04 §"IR-02" 재확정 시 갱신도 이 함수가 처리.
  if (finalArrival) {
    const segId = insertedRows.find((r) => r.direction === "INBOUND" && r.seq === byDirection.INBOUND.length)?.id ?? null;
    await supabase.rpc("generate_transfer_request", {
      p_flight_service_item_id: serviceItemId,
      p_direction: "INBOUND",
      p_from_text: finalArrival.arrAirport || "공항",
      p_to_text: "숙소",
      p_scheduled_at: new Date(finalArrival.arrAt).toISOString(),
      p_source_flight_segment_id: segId,
    });
  }
  if (firstDeparture) {
    const segId = insertedRows.find((r) => r.direction === "OUTBOUND" && r.seq === 1)?.id ?? null;
    await supabase.rpc("generate_transfer_request", {
      p_flight_service_item_id: serviceItemId,
      p_direction: "OUTBOUND",
      p_from_text: "숙소",
      p_to_text: firstDeparture.depAirport || "공항",
      p_scheduled_at: new Date(firstDeparture.depAt).toISOString(),
      p_source_flight_segment_id: segId,
    });
  }

  // 재확정으로 값이 크게 바뀌었으면 R4 영향 엔진이 이미 처리중인 수송·숙박·공항 의전에
  // 조정 항목을 만듭니다(03 §1.5). 첫 확정이거나 사소한 변경이면 함수 안에서 알아서 아무것도 안 만듭니다.
  await supabase.rpc("evaluate_flight_change_impact", {
    p_flight_service_item_id: serviceItemId,
    p_old_inbound_arr_at: oldFinalArrival?.arr_at ?? null,
    p_old_inbound_arr_airport: oldFinalArrival?.arr_airport ?? null,
    p_new_inbound_arr_at: finalArrival ? new Date(finalArrival.arrAt).toISOString() : null,
    p_new_inbound_arr_airport: finalArrival?.arrAirport ?? null,
    p_old_outbound_dep_at: oldFirstDeparture?.dep_at ?? null,
    p_old_outbound_dep_airport: oldFirstDeparture?.dep_airport ?? null,
    p_new_outbound_dep_at: firstDeparture ? new Date(firstDeparture.depAt).toISOString() : null,
    p_new_outbound_dep_airport: firstDeparture?.depAirport ?? null,
  });

  revalidatePath("/vendor");
}
