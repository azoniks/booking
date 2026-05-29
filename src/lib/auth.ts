import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { authConfig } from "./auth.config";
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  getClientIp,
  recordLoginFailure,
} from "./rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      authorize: async (credentials, request) => {
        const ip = getClientIp(request?.headers as Headers | undefined);
        const key = `login:${ip}`;

        const status = checkLoginRateLimit(key);
        if (status.blocked) return null;

        const email = String(credentials?.email || "").toLowerCase().trim();
        const password = String(credentials?.password || "");
        if (!email || !password) {
          recordLoginFailure(key);
          return null;
        }

        const user = await prisma.adminUser.findUnique({ where: { email } });
        if (!user || !user.isActive) {
          recordLoginFailure(key);
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          recordLoginFailure(key);
          return null;
        }

        clearLoginRateLimit(key);

        await prisma.adminUser.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
});
