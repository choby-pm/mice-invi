import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assignDefaultServiceVendors } from "@/server/modules/service-item/assign-default-vendors";
import { replaceServiceDetails } from "@/server/modules/service-item/replace-details";

const mocks = { update: vi.fn(), eq: vi.fn(), is: vi.fn(), in: vi.fn() };
beforeEach(() => { for (const fn of Object.values(mocks)) fn.mockReset(); });

function assignmentClient(vendors: { id: string; service_types: string[] }[]) {
  const service = { eq: mocks.eq, is: mocks.is, in: mocks.in };
  mocks.update.mockReturnValue(service); mocks.eq.mockReturnValue(service); mocks.is.mockReturnValue(service); mocks.in.mockResolvedValue({ error: null });
  let calls = 0;
  const vendor = { eq: () => ++calls === 1 ? vendor : Promise.resolve({ data: vendors, error: null }) };
  return { from: (table: string) => table === "event_vendor" ? { select: () => vendor } : { update: mocks.update } } as unknown as SupabaseClient;
}

it("분야별 단일 업체만 자동 배정하고 기존 배정은 덮어쓰지 않음", async () => {
  await assignDefaultServiceVendors(assignmentClient([{ id: "flight", service_types: ["FLIGHT"] }]), "event");
  expect(mocks.update).toHaveBeenCalledTimes(1); expect(mocks.update).toHaveBeenCalledWith({ event_vendor_id: "flight" });
  expect(mocks.is).toHaveBeenCalledWith("event_vendor_id", null);
  expect(mocks.in).toHaveBeenCalledWith("status", ["DRAFT", "REQUESTED"]);
});

it("같은 분야 업체가 여러 곳이면 임의로 고르지 않음", async () => {
  await assignDefaultServiceVendors(assignmentClient([{ id: "a", service_types: ["FLIGHT"] }, { id: "b", service_types: ["FLIGHT"] }]), "event");
  expect(mocks.update).not.toHaveBeenCalled();
});

it("새 확정 정보 저장 실패 시 기존 예약을 지우지 않음", async () => {
  const remove = vi.fn();
  const client = { from: () => ({ select: () => ({ eq: async () => ({ data: [{ id: "old" }], error: null }) }), insert: () => ({ select: async () => ({ data: null, error: new Error("write failed") }) }), delete: remove }) } as unknown as SupabaseClient;
  await expect(replaceServiceDetails(client, "flight_segment", "item", [{ service_item_id: "item" }])).rejects.toThrow("write failed");
  expect(remove).not.toHaveBeenCalled();
});

it("빈 확정 입력으로 기존 예약을 삭제하지 않음", async () => {
  const from = vi.fn();
  await expect(replaceServiceDetails({ from } as unknown as SupabaseClient, "room_assignment", "item", [])).rejects.toThrow("입력");
  expect(from).not.toHaveBeenCalled();
});
