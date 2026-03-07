import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { UserRole } from "@/types";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const PolicyholderLoginSchema = z.object({
  policyNumber: z.string().min(1),
  email: z.string().email(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        console.log("[auth] authorize called, credentials keys:", credentials ? Object.keys(credentials) : null);
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) {
          console.log("[auth] zod parse failed:", parsed.error.issues);
          return null;
        }

        const { email, password } = parsed.data;
        console.log("[auth] looking up user:", email);

        const user = await prisma.user.findUnique({ where: { email } });
        console.log("[auth] user found:", !!user, "active:", user?.active);
        if (!user || !user.active) return null;

        const passwordMatch = await bcrypt.compare(password, user.password);
        console.log("[auth] password match:", passwordMatch);
        if (!passwordMatch) return null;

        console.log("[auth] returning user:", user.id, user.role);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as UserRole,
          policyholderID: null,
        };
      },
    }),
    Credentials({
      id: "policyholder",
      name: "Espace Assuré",
      credentials: {
        policyNumber: { label: "Numéro de police" },
        email: { label: "Email" },
      },
      async authorize(credentials) {
        const parsed = PolicyholderLoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { policyNumber, email } = parsed.data;

        const ph = await prisma.policyholder.findFirst({
          where: { policyNumber, email },
          include: { user: true },
        });
        if (!ph) return null;

        // Créer ou retrouver le User POLICYHOLDER lié
        let user = ph.user;
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: ph.email,
              name: `${ph.firstName} ${ph.lastName}`,
              role: "POLICYHOLDER",
              password: "",
              active: true,
              policyholderProfile: { connect: { id: ph.id } },
            },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: "POLICYHOLDER" as UserRole,
          policyholderID: ph.id,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: UserRole }).role;
        token.policyholderID =
          (user as { policyholderID?: string | null }).policyholderID ?? null;
        // Shorter session for policyholder
        if (account?.providerId === "policyholder") {
          token.exp = Math.floor(Date.now() / 1000) + 4 * 60 * 60;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.policyholderID =
          (token.policyholderID as string | null) ?? null;
      }
      return session;
    },
  },
});

// Extend NextAuth types
declare module "next-auth" {
  interface User {
    role: UserRole;
    policyholderID?: string | null;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      policyholderID?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    policyholderID?: string | null;
  }
}
