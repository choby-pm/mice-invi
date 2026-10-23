import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { DemoRole } from "@/lib/demo";
import { getDemoAccount } from "@/server/auth/demo-account";

// 데모 계정은 모든 체험자가 함께 쓰는 공용 계정이라, 세션을 브라우저 쿠키 대신 서버가 역할별로 보관합니다.
// 역할 9개 세션(각 ~3KB)을 쿠키로 들고 다니면 요청 헤더 한도를 넘기 때문입니다.
// shortcut: 서버 인스턴스마다 메모리에 보관하고 토큰 만료(기본 1시간) 전 50분마다 새로 발급합니다. 데모 전용.
const TTL_MS = 50 * 60 * 1000;
type Entry = { cookies: { name: string; value: string }[]; issuedAt: number };
const sessions = new Map<DemoRole, Promise<Entry>>();

export async function demoSessionCookies(role: DemoRole, now = Date.now()) {
  const cached = sessions.get(role);
  const entry = cached && await cached.catch(() => null);
  if (entry && now - entry.issuedAt < TTL_MS) return entry.cookies;
  const issuing = issue(role, now);
  sessions.set(role, issuing);
  issuing.catch(() => { if (sessions.get(role) === issuing) sessions.delete(role); });
  return (await issuing).cookies;
}

async function issue(role: DemoRole, now: number): Promise<Entry> {
  const { admin, email } = await getDemoAccount(role);
  // Generate a server-only token for a verified demo account; no email or password is sent.
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const jar = new Map<string, string>();
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error: sessionError } = await client.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (sessionError) throw sessionError;
  return { cookies: [...jar].map(([name, value]) => ({ name, value })), issuedAt: now };
}
