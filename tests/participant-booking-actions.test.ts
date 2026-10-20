import { beforeEach, expect, it, vi } from "vitest";
import { saveParticipantSensitive, viewParticipantSensitive } from "@/server/modules/participant/sensitive-actions";
import { readFlightBookingIdentity } from "@/server/modules/participant/flight-booking-actions";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn(), from: vi.fn(), single: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  const query = { select: () => query, eq: () => query, update: mocks.update, single: mocks.single, maybeSingle: async () => ({ data: { id: "p" }, error: null }) };
  mocks.from.mockReturnValue(query); mocks.update.mockReturnValue(query);
  mocks.single.mockResolvedValue({ data: { birth_date: "1980-02-29", gender: "F" }, error: null });
  mocks.rpc.mockResolvedValue({ data: [], error: null });
});
it("여권이 아직 없어도 기존 생년월일·성별을 편집 폼에 보존", async () => {
  expect(await viewParticipantSensitive("p")).toMatchObject({ birth_date: "1980-02-29", gender: "F", passport_no: null });
});
it("고객의 발권 기본정보 수정은 동일 참가자에 저장", async () => {
  const form = new FormData(); form.set("participantId", "p"); form.set("birthDate", "1980-02-29"); form.set("gender", "F");
  await saveParticipantSensitive(form);
  expect(mocks.update).toHaveBeenCalledWith({ birth_date: "1980-02-29", gender: "F" });
});
it("영문 성명 수정은 기존 생년월일·성별을 지우지 않음", async () => {
  const form = new FormData(); form.set("participantId", "p"); form.set("lastName", "UPDATED");
  await saveParticipantSensitive(form);
  expect(mocks.update).toHaveBeenCalledWith({ last_name: "UPDATED" });
});
it("생년월일 필드가 없는 기존 요청은 기본정보를 지우지 않음", async () => {
  const form = new FormData(); form.set("participantId", "p");
  await saveParticipantSensitive(form); expect(mocks.update).not.toHaveBeenCalled();
});
it("여권 저장 실패를 성공으로 처리하지 않음", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "denied" } });
  const form = new FormData(); form.set("participantId", "p");
  await expect(saveParticipantSensitive(form)).rejects.toThrow("저장하지 못했습니다");
  expect(mocks.update).not.toHaveBeenCalled();
});
it("업체 열람 실패와 빈 예약 대상 명단을 구분", async () => {
  expect(await readFlightBookingIdentity("flight")).toEqual([]);
  expect(mocks.rpc).toHaveBeenCalledWith("read_flight_booking_identity", { p_service_item_id: "flight" });
  mocks.rpc.mockResolvedValue({ error: { message: "not authorized" } });
  await expect(readFlightBookingIdentity("other")).rejects.toThrow("열람할 수 없습니다");
});
