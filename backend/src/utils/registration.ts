export function registrationFields(body: any) {
  const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length <= max ? value.trim() : "";
  const username = text(body?.username, 30);
  const email = text(body?.email, 254).toLowerCase();
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128) return null;
  return { username, email, password };
}
