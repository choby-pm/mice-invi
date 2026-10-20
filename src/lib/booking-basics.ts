export function bookingBasics(form: FormData) {
  const birthDate = String(form.get("birthDate") ?? "").trim();
  const gender = String(form.get("gender") ?? "").trim();
  if (birthDate && (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !Number.isFinite(Date.parse(birthDate))
    || new Date(birthDate).toISOString().slice(0, 10) !== birthDate || birthDate > new Date().toISOString().slice(0, 10))) throw new Error("생년월일을 확인해 주세요.");
  if (gender && !["M", "F", "X"].includes(gender)) throw new Error("여권상 성별을 확인해 주세요.");
  return { birth_date: birthDate || null, gender: gender || null };
}
