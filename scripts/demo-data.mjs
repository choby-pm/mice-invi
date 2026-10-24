import { createHash } from "node:crypto";

export const demoId = (key) => {
  const hex = createHash("sha256").update(`mice-invi-demo-v1:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

export const SERVICE_TYPES = ["FLIGHT", "LODGING", "TRANSFER", "AIRPORT", "DIETARY"];
export const DEMO_VENDOR_USERS = { FLIGHT: "vendor", LODGING: "vendor-lodging", TRANSFER: "vendor-transfer", AIRPORT: "vendor-airport", DIETARY: "vendor-dietary" };
export const DEMO_USER_ROLES = ["pco", "manager", "field", "proxy", ...Object.values(DEMO_VENDOR_USERS)];

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
    // 업체마다 전용 데모 계정 하나. 항공은 기존 demo-vendor 계정을 유지합니다.
    // 옛 vendor_member:{분야} 행(항공 계정의 해제된 소속)은 그대로 두고 새 키를 씁니다.
    add("vendor_member", type === "FLIGHT" ? type : `${type}:own`, { vendor_id: vendors[type], user_id: users[DEMO_VENDOR_USERS[type]], role: "ADMIN", status: "ACTIVE" });
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
      completeness: [100, 80, 40, 10, 0, 0][index] });
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
        id: serviceIds[`${delegation_id}:${type}`] ?? demoId(`service_item:${country}:${type}`),
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
  addLargeEvent(add, users, serviceIds, { base, tenant_id, levels, eventVendors });
  addOtherEvents(add, users, serviceIds, tenant_id);
  return tables;
}

// 대형 행사 가정: 60개국, VIP·동반자 100명 (위 6개국 12명 + 아래 54개국 VIP 54명·동반자 34명). 수행원 18명은 별도.
const COUNTRIES = [
  ["CN", "중국", "PEK"], ["MN", "몽골", "UBN"], ["PH", "필리핀", "MNL"], ["TH", "태국", "BKK"], ["MY", "말레이시아", "KUL"],
  ["ID", "인도네시아", "CGK"], ["KH", "캄보디아", "PNH"], ["LA", "라오스", "VTE"], ["MM", "미얀마", "RGN"], ["BN", "브루나이", "BWN"],
  ["IN", "인도", "DEL"], ["PK", "파키스탄", "ISB"], ["BD", "방글라데시", "DAC"], ["LK", "스리랑카", "CMB"], ["NP", "네팔", "KTM"],
  ["KZ", "카자흐스탄", "NQZ"], ["UZ", "우즈베키스탄", "TAS"], ["AE", "아랍에미리트", "AUH"], ["SA", "사우디아라비아", "RUH"], ["QA", "카타르", "DOH"],
  ["TR", "튀르키예", "IST"], ["EG", "이집트", "CAI"], ["MA", "모로코", "CMN"], ["NG", "나이지리아", "ABV"], ["KE", "케냐", "NBO"],
  ["ZA", "남아프리카공화국", "JNB"], ["ET", "에티오피아", "ADD"], ["GH", "가나", "ACC"], ["GB", "영국", "LHR"], ["DE", "독일", "FRA"],
  ["IT", "이탈리아", "FCO"], ["ES", "스페인", "MAD"], ["NL", "네덜란드", "AMS"], ["BE", "벨기에", "BRU"], ["CH", "스위스", "ZRH"],
  ["SE", "스웨덴", "ARN"], ["NO", "노르웨이", "OSL"], ["FI", "핀란드", "HEL"], ["DK", "덴마크", "CPH"], ["PL", "폴란드", "WAW"],
  ["CZ", "체코", "PRG"], ["HU", "헝가리", "BUD"], ["AT", "오스트리아", "VIE"], ["PT", "포르투갈", "LIS"], ["GR", "그리스", "ATH"],
  ["CA", "캐나다", "YVR"], ["MX", "멕시코", "MEX"], ["BR", "브라질", "GRU"], ["AR", "아르헨티나", "EZE"], ["CL", "칠레", "SCL"],
  ["PE", "페루", "LIM"], ["CO", "콜롬비아", "BOG"], ["NZ", "뉴질랜드", "AKL"], ["FJ", "피지", "NAN"],
];
const HALAL = new Set(["MY", "ID", "BN", "PK", "BD", "AE", "SA", "QA", "TR", "EG", "MA"]);
// 18개 대표단 주기로 진행 단계를 섞습니다: C 확정, CH 확정 후 변경 중, S 접수·예약 중, IP 요청, O 미회신, SENT 발송, DECL 불참.
// 행사 3~4개월 전 운영 중인 상황이라 처리 중·확인 필요 건이 완료 건보다 많습니다.
const STAGES = ["S", "IP", "C", "S", "CH", "IP", "S", "C", "IP", "S", "O", "CH", "C", "S", "IP", "SENT", "C", "DECL"];
const STAGE_INFO = {
  C: ["CONFIRMED", "ATTENDING", 100], CH: ["CONFIRMED", "ATTENDING", 90], S: ["SUBMITTED", "ATTENDING", 80], IP: ["IN_PROGRESS", "ATTENDING", 50],
  O: ["OPENED", "UNDECIDED", 20], SENT: ["SENT", null, 0], BOUNCED: ["BOUNCED", null, 0], DECL: ["DECLINED", "DECLINED", 0],
};
const DONE = ["CONFIRMED", "NOTIFIED", "CHANGING"];
const LABEL = { VIP: "수석대표", COMPANION: "동반자", STAFF: "수행원" };
const ISSUES = [
  ["입국편 3시간 지연", { arrival: "10:00" }, { arrival: "13:00" }, "FLIGHT", "OPEN", "URGENT",
    [["TRANSFER", "도착 시간에 맞춰 차량 재배차"], ["AIRPORT", "영접 시간 재조정"], ["LODGING", "체크인 시간 재확인"]]],
  ["동반자 1명 추가", { companions: 1 }, { companions: 2 }, "PCO", "IN_PROGRESS", "CAUTION",
    [["LODGING", "객실 추가 배정"], ["TRANSFER", "차량 좌석 재확인"], ["DIETARY", "추가 인원 식이 정보 확인"]]],
  ["할랄 → 채식 식단 변경", { diet: "HALAL" }, { diet: "VEGETARIAN" }, "PCO", "OPEN", "NORMAL", [["DIETARY", "만찬 메뉴 변경"]]],
  ["출국일 하루 연장", { departure: "2027-03-04" }, { departure: "2027-03-05" }, "PCO", "IN_PROGRESS", "CAUTION",
    [["LODGING", "숙박 1박 연장"], ["TRANSFER", "출국 차량 날짜 변경"]]],
  ["객실 등급 상향", { room: "Deluxe King" }, { room: "Executive Suite" }, "LODGING", "CLOSED", "NORMAL", [["LODGING", "객실 등급 변경 반영"]]],
  ["입국 공항 김포로 변경", { airport: "ICN" }, { airport: "GMP" }, "FLIGHT", "OPEN", "URGENT",
    [["AIRPORT", "김포공항 영접 배정"], ["TRANSFER", "김포공항 픽업으로 변경"]]],
  ["휠체어 이동 지원 요청", { mobility: "없음" }, { mobility: "휠체어" }, "PCO", "IN_PROGRESS", "CAUTION",
    [["AIRPORT", "휠체어 지원 요청"], ["TRANSFER", "리프트 차량 배차"]]],
  ["환영 만찬 불참", { banquet: "참석" }, { banquet: "불참" }, "PCO", "CLOSED", "NORMAL", [["DIETARY", "만찬 인원 제외"]]],
  ["호텔 픽업 장소 변경", { pickup: "정문" }, { pickup: "VIP 전용 출입구" }, "TRANSFER", "OPEN", "CAUTION",
    [["TRANSFER", "픽업 장소 변경 반영"], ["LODGING", "VIP 출입구 사용 협조"]]],
  ["얼리 체크인 요청", { checkin: "15:00" }, { checkin: "09:00" }, "PCO", "IN_PROGRESS", "NORMAL",
    [["LODGING", "얼리 체크인 확인"], ["AIRPORT", "영접 후 호텔 직행 안내"]]],
];
const H = 3600e3;
const at = (ms) => new Date(ms).toISOString().replace(".000Z", "Z");

// 대표단 하나와 참가자·서비스·진행 단계에 맞는 세부 내역을 만듭니다. key는 데모 전체에서 고유한 행 이름입니다.
function addDelegation(add, users, serviceIds, { base, tenant_id, levels, eventVendors },
  { key, country, name, airport, i, level, types, invite_status, rsvp, completeness, participantStatus, statusOf, arrive, leave }) {
  const delegation_id = add("delegation", key, { ...base, name: `${name} 대표단 [DEMO]`, country,
    organization: `${name} 데모 외교부`, invite_status, rsvp, owner_user_id: i % 2 ? users.manager : users.pco,
    protocol_level_id: levels[level], preferred_language: i % 3 ? "en" : "ko", completeness });
  const people = types.map((participant_type, k) => ({ participant_type, id: add("participant", `${key}:${k}`, {
    tenant_id, delegation_id, participant_type, last_name: `Demo${country}`, first_name: { VIP: "Alex", COMPANION: "Robin", STAFF: "Sam" }[participant_type],
    display_name: `${name} ${LABEL[participant_type]} (가상)`, nationality: country,
    title: { VIP: ["대통령 특사", "장관", "차관"][level], COMPANION: "배우자", STAFF: "의전담당" }[participant_type],
    sort_order: k, protocol_level_id: levels[level], status: participantStatus }) }));
  const ids = people.map((p) => p.id);
  const guests = people.filter((p) => p.participant_type !== "STAFF").map((p) => p.id);
  const staff = people.find((p) => p.participant_type === "STAFF");

  const services = {};
  for (const type of SERVICE_TYPES) {
    const svc = statusOf(type);
    services[type] = { status: svc, id: add("service_item", `${key}:${type}`, { ...base, delegation_id, service_type: type,
      id: serviceIds[`${delegation_id}:${type}`] ?? demoId(`service_item:${key}:${type}`), event_vendor_id: eventVendors[type],
      support_type: svc === "NOT_APPLICABLE" ? "NOT_PROVIDED" : "SUPPORTED", status: svc, note: `[DEMO] ${name} ${type} 요청`, scheduled_at: at(arrive),
      ...(DONE.includes(svc) ? { confirmed_at: at(arrive - 18 * 24 * H + i * H), confirmation_note: "데모 확정 내역" } : {}) }) };
  }
  const requested = (type) => !["DRAFT", "NOT_APPLICABLE"].includes(services[type].status);
  const done = (type) => DONE.includes(services[type].status);

  if (requested("FLIGHT")) add("flight_request", key, { service_item_id: services.FLIGHT.id, inbound_origin_city: name,
    inbound_dest_airport: "ICN", inbound_preferred_date: at(arrive).slice(0, 10), outbound_preferred_date: at(leave).slice(0, 10),
    outbound_origin_airport: "ICN", outbound_dest_city: name, note: i % 4 ? "비즈니스석, 직항 우선 (데모)" : "국적기 선호, 오전 도착 희망 (데모)" });
  let inbound;
  if (done("FLIGHT") || services.FLIGHT.status === "IN_PROGRESS") {
    for (const [d, direction] of ["INBOUND", "OUTBOUND"].entries()) {
      const segment = add("flight_segment", `${key}:${direction}`, { service_item_id: services.FLIGHT.id, direction,
        flight_no: `DEMO${300 + i * 2 + d}`, dep_airport: d ? "ICN" : airport, arr_airport: d ? airport : "ICN",
        dep_at: at(d ? leave : arrive - 6 * H), arr_at: at(d ? leave + 6 * H : arrive), cabin_class: level ? "BUSINESS" : "FIRST",
        ticket_status: services.FLIGHT.status === "IN_PROGRESS" ? "BOOKED" : "TICKETED", is_final_arrival: !d });
      if (!d) inbound = segment;
    }
  }
  if (requested("LODGING")) add("lodging_request", key, { service_item_id: services.LODGING.id,
    check_in_preferred_date: at(arrive).slice(0, 10), check_out_preferred_date: at(leave).slice(0, 10),
    room_grouping_note: `${guests.length > 1 ? "VIP·동반자 1실" : "VIP 1실"}${staff ? ", 수행원 1실" : ""}` });
  if (done("LODGING") || services.LODGING.status === "CANCEL_REQ") {
    add("room_assignment", `${key}:guest`, { service_item_id: services.LODGING.id, hotel_name: "[DEMO] 서울컨벤션호텔",
      room_type: ["Presidential Suite", "Executive Suite", "Deluxe King"][level], participant_ids: guests,
      check_in_at: at(arrive + 2 * H), check_out_at: at(leave - 3 * H), confirmation_no: `DEMO-${key.replace(":", "-")}-1` });
    if (staff) add("room_assignment", `${key}:staff`, { service_item_id: services.LODGING.id, hotel_name: "[DEMO] 서울컨벤션호텔",
      room_type: "Deluxe Twin", participant_ids: [staff.id], check_in_at: at(arrive + 2 * H), check_out_at: at(leave - 3 * H),
      confirmation_no: `DEMO-${key.replace(":", "-")}-2` });
  }
  if (requested("TRANSFER")) add("transfer_request", key, { service_item_id: services.TRANSFER.id, direction: "INBOUND",
    from_text: "인천공항 T2", to_text: "서울컨벤션호텔", scheduled_at: at(arrive + H), participant_ids: ids,
    ...(inbound ? { source_flight_segment_id: inbound } : {}), luggage_note: `캐리어 ${ids.length * 2}개 (데모)` });
  if (done("TRANSFER")) add("vehicle_dispatch", key, { service_item_id: services.TRANSFER.id, from_text: "인천공항 T2",
    to_text: "서울컨벤션호텔", depart_at: at(arrive + H), vehicle_class: level === 0 ? "VIP 리무진" : ids.length > 2 ? "VIP VAN" : "VIP 세단",
    driver_name: `가상 기사 ${i + 1}`, participant_ids: ids });
  if (requested("AIRPORT")) add("airport_request", key, { service_item_id: services.AIRPORT.id,
    scope: level === 0 ? ["GREETING", "FAST_TRACK", "LOUNGE", "BAGGAGE"] : ["GREETING", "BAGGAGE"],
    note: level === 0 ? "국빈급 의전, 귀빈실 이용 (데모)" : "입국장 영접 지원 (데모)" });
  if (done("AIRPORT")) add("airport_assignment", key, { service_item_id: services.AIRPORT.id,
    attendant_name: `데모 의전담당 ${String.fromCharCode(65 + (i % 26))}`, meeting_point: "인천공항 T2 입국장 A", meeting_at: at(arrive + H / 2) });
  if (requested("DIETARY")) people.forEach((p, k) => {
    const dietary_code = HALAL.has(country) ? "HALAL" : country === "IN" ? "VEGETARIAN" : k === 1 && i % 4 === 1 ? "ALLERGY" : i % 7 === 3 ? "VEGAN" : "NONE";
    add("dietary_requirement", `${key}:${k}`, { service_item_id: services.DIETARY.id, participant_id: p.id, dietary_code,
      note: dietary_code === "ALLERGY" ? "갑각류 알레르기 (가상)" : "가상 식이 요청" });
  });
  return { delegation_id, people, guests, staff, services };
}

function addLargeEvent(add, users, serviceIds, ctx) {
  const { base, tenant_id } = ctx;
  const attending = [];
  COUNTRIES.forEach(([country, name, airport], i) => {
    const stage = i === 51 ? "BOUNCED" : STAGES[i % 18];
    const [invite_status, rsvp, completeness] = STAGE_INFO[stage];
    const level = i % 5 === 0 ? 0 : i % 5 < 3 ? 1 : 2;
    // 7과 54는 서로소라 (i*7)%54가 0~53을 한 번씩 돌아 동반자가 정확히 34명입니다.
    const types = ["VIP", ...((i * 7) % 54 < 34 ? ["COMPANION"] : []), ...(i % 3 === 0 ? ["STAFF"] : [])];
    const statusOf = (type) => {
      if (stage === "DECL") return "NOT_APPLICABLE";
      if (["O", "SENT", "BOUNCED"].includes(stage)) return "DRAFT";
      if (stage === "IP") return i % 4 === 1 && type === "DIETARY" ? "DRAFT" : "REQUESTED";
      if (stage === "S") {
        if (i % 9 === 0 && type === (i % 2 ? "AIRPORT" : "LODGING")) return "CANCEL_REQ";
        return { FLIGHT: i % 3 ? "IN_PROGRESS" : "CONFIRMED", LODGING: "IN_PROGRESS", DIETARY: i % 2 ? "IN_PROGRESS" : "REQUESTED" }[type] ?? "REQUESTED";
      }
      if (stage === "CH") return type === "FLIGHT" || type === "TRANSFER" || (i % 2 && type === "LODGING") ? "CHANGING" : "CONFIRMED";
      // 확정 대표단도 차량·영접은 막바지에 확정되는 경우가 많습니다.
      if (type === "TRANSFER" && i % 3 === 0) return "IN_PROGRESS";
      if (type === "AIRPORT" && i % 4 === 1) return "REQUESTED";
      return i % 2 && (type === "AIRPORT" || type === "DIETARY") ? "NOTIFIED" : "CONFIRMED";
    };
    const arrive = Date.UTC(2027, 1, 28) + ((i * 7) % 36) * H; // 28 Feb 2027 09:00 ~ 1 Mar 20:00 KST
    const leave = Date.UTC(2027, 2, 4, 1) + (i % 10) * H;
    const { delegation_id, people, guests, staff, services } = addDelegation(add, users, serviceIds, ctx, { key: country, country, name, airport,
      i, level, types, invite_status, rsvp, completeness, statusOf, arrive, leave,
      participantStatus: stage === "DECL" ? "CANCELLED" : stage === "C" || stage === "CH" ? "CONFIRMED" : "REGISTERED" });
    if (["C", "CH", "S"].includes(stage)) {
      for (const [c, category] of ["REQUIRED", "OPTIONAL", "SENSITIVE", "UNIQUE_ID", "OVERSEAS_TRANSFER", "REUSE_STORAGE"].entries()) {
        for (const p of people) add("consent_record", `${category}:${p.id}`, { tenant_id, delegation_id, participant_id: p.id,
          item_id: demoId(`consent_item:${category}`), proxy_user_id: users.proxy, policy_version: 1, agreed: c !== 1 || i % 2 === 0,
          status: stage === "S" && c === 2 && i % 4 === 2 ? "NEEDS_REAGREEMENT" : "VALID" });
      }
    }
    if (["C", "CH", "S", "IP"].includes(stage)) {
      const confirmed = stage === "C" || stage === "CH";
      const attend = (program, p, k, attendance) => add("program_attendance", `${program}:${country}:${k}`, {
        tenant_id, program_id: demoId(`program:${program}`), participant_id: p, role: "ATTENDEE", status: attendance });
      attend(0, people[0].id, 0, confirmed ? "CONFIRMED" : "INVITED");
      guests.forEach((p, k) => attend(1, p, k, !confirmed ? "INVITED" : i % 6 === 5 ? "DECLINED" : "CONFIRMED"));
      if (confirmed && level === 0) attend(2, people[0].id, 0, "INVITED");
      if (confirmed && staff) attend(5, staff.id, 0, "CONFIRMED");
      attending.push({ country, stage, services, arrive });
    }
  });

  const candidates = attending.filter((d) => d.stage !== "IP");
  // 템플릿을 두 바퀴 돌려 20건. 두 번째 바퀴는 미종결로 두고, 일부는 확인 기한을 이미 넘긴 상태로 만듭니다.
  [...ISSUES, ...ISSUES].forEach(([summary, before, after, sourceType, template, max_urgency, affected], t) => {
    const status = t < ISSUES.length ? template : template === "CLOSED" ? "OPEN" : template;
    const overdue = status === "OPEN" && t % 3 === 0;
    const d = candidates[(t * 7) % candidates.length];
    const vendorUser = (type) => users[DEMO_VENDOR_USERS[type]];
    const issue_id = add("change_issue", `large:${t}`, { ...base, delegation_id: demoId(`delegation:${d.country}`), issue_no: `DEMO-${t + 4}`,
      source: sourceType === "PCO" ? "PCO" : "VENDOR", source_user_id: sourceType === "PCO" ? users.manager : vendorUser(sourceType),
      origin_service_id: d.services[sourceType === "PCO" ? affected[0][0] : sourceType].id, summary, before, after, status, max_urgency,
      ...(status === "CLOSED" ? { closed_at: "2027-02-22T00:00:00Z" } : {}) });
    affected.forEach(([type, instruction], j) => {
      const resolved = status === "CLOSED" || (status === "IN_PROGRESS" && j === 0);
      add("adjustment_item", `large:${t}:${type}`, { issue_id, service_item_id: d.services[type].id,
        assignee_vendor_id: demoId(`vendor:${type}`), instruction, urgency: max_urgency,
        status: resolved ? "DONE" : status === "OPEN" ? "ACTION_REQUIRED" : "IN_PROGRESS",
        due_at: overdue ? "2026-10-22T09:00:00Z" : at(d.arrive - 24 * H),
        ...(resolved ? { resolution_note: "데모 변경 반영 완료", resolved_at: "2027-02-22T00:00:00Z", resolved_by: vendorUser(type) } : {}) });
    });
  });
}

// 준비 중 행사(2027년 6월)는 초청 발송 직후라 대부분 요청 전·요청 단계입니다.
// 종료 행사(2026년 9월)는 모든 서비스가 끝났고 업체 정산까지 완료되어 업체 화면에서는 보이지 않습니다.
const OTHER_EVENTS = [
  { key: "prep", event: "preparing", countries: COUNTRIES.slice(0, 18), arriveBase: Date.UTC(2027, 5, 14), closed: false,
    programs: [["개막식", "PLENARY", "TENTATIVE", "PUBLIC"], ["전통 공연 관람", "COMPANION", "TENTATIVE", "STAKEHOLDER"]] },
  { key: "closed", event: "closed", countries: COUNTRIES.slice(28, 52), arriveBase: Date.UTC(2026, 8, 14), closed: true,
    programs: [["개막 총회", "PLENARY", "DONE", "PUBLIC"], ["환영 만찬", "BANQUET", "DONE", "STAKEHOLDER"],
      ["산업 시찰", "COMPANION", "DONE", "STAKEHOLDER"], ["폐막식", "PLENARY", "DONE", "PUBLIC"]] },
];
const PREP_STAGES = [["READY", null, 0], ["SENT", null, 0], ["SENT", null, 0], ["OPENED", "UNDECIDED", 10], ["IN_PROGRESS", "ATTENDING", 40], ["SUBMITTED", "ATTENDING", 70]];

function addOtherEvents(add, users, serviceIds, tenant_id) {
  for (const { key, event, countries, arriveBase, closed, programs } of OTHER_EVENTS) {
    const base = { tenant_id, event_id: demoId(`event:${event}`) };
    const levels = ["국빈급", "장관급", "일반 초청"].map((name, n) =>
      add("protocol_level", `${key}:${n}`, { ...base, name, sort_order: n, defaults: { room_type: n ? "Deluxe" : "Suite" } }));
    const eventVendors = Object.fromEntries(SERVICE_TYPES.map((type) => [type, add("event_vendor", `${key}:${type}`, {
      ...base, vendor_id: demoId(`vendor:${type}`), service_types: [type],
      ...(closed ? { settled_at: "2026-10-05T00:00:00Z", settlement_note: "데모 정산 완료" } : {}) })]));
    for (const type of SERVICE_TYPES) for (const participant_type of ["VIP", "COMPANION", "STAFF"]) {
      add("support_policy", `${key}:${type}:${participant_type}`, { ...base, service_type: type, participant_type,
        support_type: participant_type === "STAFF" && type === "FLIGHT" ? "SELF_BOOKED" : "SUPPORTED",
        guide_text: { ko: "데모 지원 정책: VIP·동반자 지원, 수행원 항공 자비 예약", en: "Demo support policy" } });
    }
    const ctx = { base, tenant_id, levels, eventVendors };
    const delegations = countries.map(([country, name, airport], j) => {
      const declined = closed && j % 8 === 7;
      const [invite_status, rsvp, completeness] = closed ? (declined ? ["DECLINED", "DECLINED", 0] : ["CONFIRMED", "ATTENDING", 100])
        : j === 7 ? ["BOUNCED", null, 0] : PREP_STAGES[j % 6];
      const statusOf = (type) => {
        if (declined) return "NOT_APPLICABLE";
        if (closed) return type === "TRANSFER" && j % 6 === 2 ? "CANCELLED" : type === "AIRPORT" || type === "DIETARY" ? "NOTIFIED" : "CONFIRMED";
        if (invite_status === "SUBMITTED") return type === "FLIGHT" && j % 4 === 1 ? "IN_PROGRESS" : "REQUESTED";
        return invite_status === "IN_PROGRESS" && (type === "FLIGHT" || type === "LODGING") ? "REQUESTED" : "DRAFT";
      };
      const arrive = arriveBase + ((j * 5) % 30) * H;
      const types = ["VIP", ...((closed ? j % 3 !== 1 : j % 2 === 0) ? ["COMPANION"] : []), ...(closed && j % 4 === 0 ? ["STAFF"] : [])];
      return { invite_status, ...addDelegation(add, users, serviceIds, ctx, { key: `${key}:${country}`, country, name, airport, i: j,
        level: j % 5 === 0 ? 0 : j % 5 < 3 ? 1 : 2, types, invite_status, rsvp, completeness, statusOf, arrive,
        leave: arriveBase + 4 * 24 * H + (j % 8) * H, participantStatus: declined ? "CANCELLED" : closed ? "DEPARTED" : "REGISTERED" }) };
    });

    const attending = delegations.filter((d) => closed ? d.invite_status === "CONFIRMED" : ["IN_PROGRESS", "SUBMITTED"].includes(d.invite_status));
    programs.forEach(([name, program_type, status, visibility], n) => {
      const program_id = add("program", `${key}:${n}`, { ...base, name: `${name} [DEMO]`, program_type, status, visibility,
        organizer_type: "HOST", organizer_delegation_id: null, registered_by_type: "PCO", transfer_needed: false,
        start_at: at(arriveBase + (2 + Math.floor(n / 2)) * 24 * H + (n % 2 ? 9 : 1) * H),
        end_at: at(arriveBase + (2 + Math.floor(n / 2)) * 24 * H + (n % 2 ? 11 : 3) * H),
        venue: "[DEMO] 서울컨벤션센터", audience_mode: "SPECIFIC_PARTICIPANTS" });
      for (const d of attending) {
        const invitees = program_type === "COMPANION" ? d.guests.slice(1) : program_type === "BANQUET" ? d.guests : [d.people[0].id];
        for (const participant_id of invitees) add("program_attendance", `${key}:${n}:${participant_id}`, {
          tenant_id, program_id, participant_id, role: "ATTENDEE", status: closed ? "CONFIRMED" : "INVITED" });
      }
    });

    // 종료 행사는 모두 종결된 변경 이력, 준비 중 행사는 막 접수된 변경 1건입니다.
    const issues = closed ? [ISSUES[0], ISSUES[1], ISSUES[5]] : [["대표단 규모 확대 (1명 → 2명)", { size: 1 }, { size: 2 }, "PCO", "OPEN", "CAUTION",
      [["LODGING", "객실 구성 변경"], ["FLIGHT", "동반자 항공 요청 추가"]]]];
    const targets = attending.filter((d) => closed || d.invite_status === "SUBMITTED");
    issues.forEach(([summary, before, after, sourceType, , max_urgency, affected], t) => {
      const d = targets[t * 2];
      const status = closed ? "CLOSED" : "OPEN";
      const issue_id = add("change_issue", `${key}:${t}`, { ...base, delegation_id: d.delegation_id, issue_no: `DEMO-${t + 1}`,
        source: sourceType === "PCO" ? "PCO" : "VENDOR", source_user_id: sourceType === "PCO" ? users.manager : users[DEMO_VENDOR_USERS[sourceType]],
        origin_service_id: d.services[sourceType === "PCO" ? affected[0][0] : sourceType].id, summary, before, after, status, max_urgency,
        ...(closed ? { closed_at: at(arriveBase - 24 * H) } : {}) });
      affected.forEach(([type, instruction]) => add("adjustment_item", `${key}:${t}:${type}`, { issue_id, service_item_id: d.services[type].id,
        assignee_vendor_id: demoId(`vendor:${type}`), instruction, urgency: max_urgency, status: closed ? "DONE" : "ACTION_REQUIRED",
        due_at: at(arriveBase - 30 * 24 * H),
        ...(closed ? { resolution_note: "데모 변경 반영 완료", resolved_at: at(arriveBase - 2 * 24 * H), resolved_by: users[DEMO_VENDOR_USERS[type]] } : {}) }));
    });
  }
}
