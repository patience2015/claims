/**
 * auth.config.ts — Config Edge-compatible (sans Prisma ni bcrypt)
 * Utilisé par le middleware (Edge Runtime)
 */
import type { NextAuthConfig } from "next-auth";
import { UserRole } from "@/types";

export const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: UserRole }).role;
        token.policyholderID =
          (user as { policyholderID?: string | null }).policyholderID ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        (session.user as { policyholderID?: string | null }).policyholderID =
          (token.policyholderID as string | null) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
