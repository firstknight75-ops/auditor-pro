export function tursoConfig(env: Record<string, string | undefined>) {
  const url = env.TURSO_DATABASE_URL;
  const authToken = env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error("أضف بيانات اتصال Turso الآمنة لإكمال الاتصال.");
  if (!/^(libsql|https):\/\//.test(url)) {
    throw new Error("رابط Turso يجب أن يبدأ بـ libsql:// أو https://، وليس ملفاً محلياً.");
  }
  return { url, authToken };
}