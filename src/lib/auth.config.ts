import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe конфиг (без bcrypt и Prisma) — используется в middleware.
 * Провайдеры и authorize() добавляются в auth.ts.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  providers: [],
  callbacks: {
    authorized: async ({ auth, request }) => {
      const path = request.nextUrl.pathname;
      const isAdmin = path.startsWith("/admin");
      const isLogin = path.startsWith("/admin/login");
      // PWA-манифест админки должен быть доступен и без авторизации
      // (его запрашивает браузер на странице логина для установки приложения).
      const isManifest = path === "/admin/manifest.webmanifest";
      if (!isAdmin) return true;
      if (isLogin || isManifest) return true;
      return !!auth;
    },
    jwt: async ({ token, user }) => {
      if (user) token.uid = user.id;
      return token;
    },
    session: async ({ session, token }) => {
      if (token.uid && session.user) {
        (session.user as { id?: string }).id = token.uid as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
