import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "SUPER_ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
      schoolId?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "ADMIN" | "SUPER_ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
    schoolId?: string;
  }
}
