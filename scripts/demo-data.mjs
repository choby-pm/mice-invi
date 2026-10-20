import { createHash } from "node:crypto";

export const demoId = (key) => {
  const hex = createHash("sha256").update(`mice-invi-demo-v1:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

export const SERVICE_TYPES = ["FLIGHT", "LODGING", "TRANSFER", "AIRPORT", "DIETARY"];

// Fixed dates keep repeated runs stable; change the fixture version for a new demo season.
export function buildDemoData(users, serviceIds = {}) {
  const tables = {};
  const tenant_id = demoId("tenant");
  const event_id = demoId("event:active");
  const add = (table, key, row) => {
    const value = { id: demoId(`${table}:${key}`), ...row };
    (tables[table] ??= []).push(value);
    return value.id;
  };
  add("tenant", "main", { id: tenant_id, name: "[DEMO] 글로벌 의전 운영팀" });
  add("tenant_member", "admin", { tenant_id, user_id: users.pco, role: "PCO_ADMIN" });
  add("tenant_member", "manager", { tenant_id, user_id: users.manager, role: "PCO_MANAGER" });
  add("tenant_member", "field", { tenant_id, user_id: users.field, role: "PCO_FIELD" });
  for (const [key, name, status] of [
    ["active", "2027 글로벌 리더스 포럼 [DEMO]", "ACTIVE"],
    ["preparing", "2027 문화교류 초청행사 [DEMO]", "PREPARING"],
    ["closed", "2026 국제협력 회의 [DEMO]", "CLOSED"],
  ]) add("event", key, { tenant_id, name, status });
  const base = { tenant_id, event_id };
  const levels = ["국빈급", "장관급", "일반 초청"].map((name, i) =>
    add("protocol_level", i, { ...base, name, sort_order: i, defaults: { room_type: i ? "Deluxe" : "Suite" } }));
  const vendors = {};
  const eventVendors = {};
  for (const [i, type] of SERVICE_TYPES.entries()) {
    vendors[type] = add("vendor", type, { name: `[DEMO] ${["하늘여행", "서울컨벤션호텔", "의전모빌리티", "공항컨시어지", "그린케이터링"][i]}` });
    eventVendors[type] = add("event_vendor", type, { ...base, vendor_id: vendors[type], service_types: [type] });
    add("vendor_member", type, { vendor_id: vendors[type], user_id: users.vendor, role: "ADMIN" });
    for (const participant_type of ["VIP", "COMPANION", "STAFF"]) {
      add("support_policy", `${type}:${participant_type}`, { ...base, service_type: type, participant_type,
        support_type: participant_type === "STAFF" && type === "FLIGHT" ? "SELF_BOOKED" : "SUPPORTED",
        guide_text: { ko: "데모 지원 정책: VIP·동반자 지원, 수행원 항공 자비 예약", en: "Demo support policy" } });
    }
  }
  const scenarios = [
    ["VN", "베트남", "CONFIRMED", "ATTENDING", "CONFIRMED"],
    ["JP", "일본", "SUBMITTED", "ATTENDING", "IN_PROGRESS"],
    ["SG", "싱가포르", "IN_PROGRESS", "ATTENDING", "REQUESTED"],
    ["FR", "프랑스", "OPENED", "UNDECIDED", "DRAFT"],
    ["US", "미국", "DECLINED", "DECLINED", "NOT_APPLICABLE"],
    ["AU", "호주", "READY", null, "DRAFT"],
  ];
  for (const [index, [country, name, invite_status, rsvp, serviceStatus]] of scenarios.entries()) {
    const delegation_id = add("delegation", country, { ...base, name: `${name} 대표단 [DEMO]`, country,
      organization: `${name} 데모 국제협력원`, invite_status, rsvp, owner_user_id: users.pco,
      protocol_level_id: levels[index % levels.length], preferred_language: index % 2 ? "en" : "ko",
      completeness: [100, 80, 40, 10, 0, 0][index], internal_note: "가상 인물·기관으로 구성한 데모 데이터입니다." });
    if (country === "VN") add("delegation_proxy", country, { tenant_id, delegation_id, user_id: users.proxy, status: "ACTIVE" });
    const participants = ["VIP", "COMPANION", "STAFF"].map((participant_type, i) =>
      add("participant", `${country}:${i}`, { tenant_id, delegation_id, participant_type,
        last_name: `Demo${country}`, first_name: ["Alex", "Robin", "Sam"][i],
        display_name: `${name} ${["수석대표", "동반자", "수행원"][i]} (가상)`, nationality: country,
        title: ["수석대표", "동반자", "의전담당"][i], sort_order: i, protocol_level_id: levels[index % 3],
        status: index === 4 ? "CANCELLED" : index === 0 ? "CONFIRMED" : "REGISTERED" }));
    const services = {};
    for (const type of SERVICE_TYPES) {
      services[type] = add("service_item", `${country}:${type}`, { ...base, delegation_id, service_type: type,
        id: serviceIds[`${country}:${type}`] ?? demoId(`service_item:${country}:${type}`),
        event_vendor_id: eventVendors[type], support_type: serviceStatus === "NOT_APPLICABLE" ? "NOT_PROVIDED" : "SUPPORTED",
        status: serviceStatus, note: `[DEMO] ${name} ${type} 시연 항목`,
        scheduled_at: "2027-03-01T04:00:00Z", ...(index === 0 ? { confirmed_at: "2027-02-20T00:00:00Z", confirmation_note: "데모 확정 내역" } : {}) });
    }
    if (index > 2) continue;
    add("flight_request", country, { service_item_id: services.FLIGHT, inbound_origin_city: name,
      inbound_dest_airport: "ICN", inbound_preferred_date: "2027-03-01", outbound_preferred_date: "2027-03-04",
      outbound_origin_airport: "ICN", outbound_dest_city: name, note: "직항 우선, 오전 입국 희망 (데모)" });
    add("lodging_request", country, { service_item_id: services.LODGING, check_in_preferred_date: "2027-03-01",
      check_out_preferred_date: "2027-03-04", room_grouping_note: "VIP 1실, 동반자 1실, 수행원 1실" });
    add("airport_request", country, { service_item_id: services.AIRPORT, scope: ["GREETING", "BAGGAGE"], note: "입국장 영접 지원 (데모)" });
    participants.forEach((participant_id, i) => add("dietary_requirement", `${country}:${i}`, {
      service_item_id: services.DIETARY, participant_id, dietary_code: ["NONE", "VEGETARIAN", "HALAL"][i], note: "가상 식이 요청" }));
    let inbound;
    if (index < 2) {
      for (const [i, direction] of ["INBOUND", "OUTBOUND"].entries()) {
        const origin = ["HAN", "NRT", "SIN"][index];
        const segment = add("flight_segment", `${country}:${direction}`, { service_item_id: services.FLIGHT, direction,
          flight_no: `DEMO${100 + index * 2 + i}`, dep_airport: i ? "ICN" : origin, arr_airport: i ? origin : "ICN",
          dep_at: i ? "2027-03-04T02:00:00Z" : "2027-03-01T00:00:00Z",
          arr_at: i ? "2027-03-04T06:00:00Z" : "2027-03-01T04:00:00Z",
          cabin_class: "BUSINESS", ticket_status: index ? "BOOKED" : "TICKETED", is_final_arrival: !i });
        if (!i) inbound = segment;
      }
      participants.forEach((participant_id, i) => add("room_assignment", `${country}:${i}`, {
        service_item_id: services.LODGING, hotel_name: "[DEMO] 서울컨벤션호텔", room_type: i ? "Deluxe Twin" : "Suite",
        participant_ids: [participant_id], check_in_at: "2027-03-01T06:00:00Z", check_out_at: "2027-03-04T02:00:00Z",
        confirmation_no: `DEMO-${country}-${i + 1}` }));
      add("airport_assignment", country, { service_item_id: services.AIRPORT, attendant_name: "데모 의전담당",
        meeting_point: "인천공항 T2 입국장 A", meeting_at: "2027-03-01T04:30:00Z" });
      add("vehicle_dispatch", country, { service_item_id: services.TRANSFER, from_text: "인천공항 T2", to_text: "서울컨벤션호텔",
        depart_at: "2027-03-01T05:00:00Z", vehicle_class: "VIP VAN", driver_name: "가상 기사", participant_ids: participants });
    }
    add("transfer_request", country, { service_item_id: services.TRANSFER, direction: "INBOUND", from_text: "인천공항 T2",
      to_text: "서울컨벤션호텔", scheduled_at: "2027-03-01T05:00:00Z", participant_ids: participants,
      ...(inbound ? { source_flight_segment_id: inbound } : {}), luggage_note: "캐리어 3개 (데모)" });
  }
  const policy_id = add("consent_policy", "current", { ...base, version: 1, is_current: true,
    published_at: "2027-02-01T00:00:00Z", notice_body: { ko: "데모 행사 운영을 위한 가상 동의서입니다.", en: "Demo consent notice." } });
  for (const [i, category] of ["REQUIRED", "OPTIONAL", "SENSITIVE", "UNIQUE_ID", "OVERSEAS_TRANSFER", "REUSE_STORAGE"].entries()) {
    const item_id = add("consent_item", category, { ...base, policy_id, category, required: i === 0,
      sort_order: i, text: { ko: `데모 ${category} 동의`, en: `Demo ${category} consent` } });
    for (const participant of tables.participant.slice(0, 6)) add("consent_record", `${category}:${participant.id}`, {
      tenant_id, delegation_id: participant.delegation_id, participant_id: participant.id, item_id,
      proxy_user_id: users.proxy, policy_version: 1, agreed: i !== 1,
      status: participant.delegation_id === demoId("delegation:JP") && i === 2 ? "NEEDS_REAGREEMENT" : "VALID" });
  }
  for (const [i, [name, program_type, status, visibility]] of [
    ["개막 총회", "PLENARY", "CONFIRMED", "PUBLIC"], ["환영 만찬", "BANQUET", "CONFIRMED", "STAKEHOLDER"],
    ["양자 면담", "BILATERAL", "TENTATIVE", "PRIVATE"], ["대표단 자체 방문", "SELF_SCHEDULED", "CONFIRMED", "PRIVATE"],
    ["취소된 문화 체험", "COMPANION", "CANCELLED", "PUBLIC"], ["사전 브리핑", "PROTOCOL", "DONE", "STAKEHOLDER"],
  ].entries()) {
    const self = program_type === "SELF_SCHEDULED";
    const program_id = add("program", i, { ...base, name: `${name} [DEMO]`, program_type, status, visibility,
      organizer_type: self ? "DELEGATION" : "HOST", organizer_delegation_id: self ? demoId("delegation:VN") : null,
      registered_by_type: self ? "PROXY" : "PCO", transfer_needed: self,
      start_at: `2027-03-0${i === 5 ? 1 : 2}T${String(1 + i * 2).padStart(2, "0")}:00:00Z`,
      end_at: `2027-03-0${i === 5 ? 1 : 2}T${String(2 + i * 2).padStart(2, "0")}:00:00Z`,
      venue: "[DEMO] 서울컨벤션센터", audience_mode: "SPECIFIC_PARTICIPANTS" });
    for (const [j, participant] of tables.participant.slice(0, self ? 3 : 9).entries()) add("program_attendance", `${i}:${j}`, {
      tenant_id, program_id, participant_id: participant.id, role: j ? "ATTENDEE" : "SPEAKER",
      status: self ? "CONFIRMED" : ["CONFIRMED", "INVITED", "DECLINED"][j % 3] });
    if (self) {
      const service_item_id = add("service_item", "self-transfer", { ...base, delegation_id: demoId("delegation:VN"),
        service_type: "TRANSFER", event_vendor_id: eventVendors.TRANSFER, status: "REQUESTED", support_type: "SUPPORTED", note: "[DEMO] 자체 일정 차량 요청" });
      add("transfer_request", "self", { service_item_id, direction: "PROGRAM", source_program_id: program_id,
        from_text: "서울컨벤션호텔", to_text: "[DEMO] 서울컨벤션센터", scheduled_at: "2027-03-02T06:30:00Z",
        participant_ids: tables.participant.slice(0, 3).map((p) => p.id) });
    }
  }
  for (const [i, status] of ["OPEN", "IN_PROGRESS", "CLOSED"].entries()) {
    const country = ["VN", "JP", "SG"][i];
    const flight = tables.service_item.find((s) => s.delegation_id === demoId(`delegation:${country}`) && s.service_type === "FLIGHT");
    const issue_id = add("change_issue", i, { ...base, delegation_id: flight.delegation_id, issue_no: `DEMO-${i + 1}`,
      source: "VENDOR", source_user_id: users.vendor, origin_service_id: flight.id,
      summary: ["입국 항공편 2시간 지연: 차량·객실·영접 재조정", "동반자 일정 변경: 숙박·차량 확인 중", "식음 요청 변경 반영 완료"][i],
      before: { arrival: "2027-03-01T02:00:00Z" }, after: { arrival: "2027-03-01T04:00:00Z" },
      status, max_urgency: ["URGENT", "CAUTION", "NORMAL"][i], ...(i === 2 ? { closed_at: "2027-02-22T00:00:00Z" } : {}) });
    for (const [j, type] of ["TRANSFER", "LODGING", "AIRPORT"].entries()) {
      const item = tables.service_item.find((s) => s.delegation_id === flight.delegation_id && s.service_type === type);
      const adjustmentStatus = i === 2 ? "DONE" : i === 1 ? "IN_PROGRESS" : "ACTION_REQUIRED";
      add("adjustment_item", `${i}:${type}`, { issue_id, service_item_id: item.id, assignee_vendor_id: vendors[type],
        instruction: ["도착 시간에 맞춰 차량 재배차", "체크인 시간 재확인", "영접 담당자 시간 재조정"][j],
        urgency: ["URGENT", "CAUTION", "NORMAL"][i], status: adjustmentStatus, due_at: "2027-03-01T03:00:00Z",
        ...(i === 2 ? { resolution_note: "데모 변경 반영 완료", resolved_at: "2027-02-22T00:00:00Z", resolved_by: users.vendor } : {}) });
    }
  }
  return tables;
}
