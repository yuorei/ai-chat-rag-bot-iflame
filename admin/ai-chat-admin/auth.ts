import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const authorizedEmails = (process.env.AUTHORIZED_EMAILS || "")
  .split(",")
  .map((email) => email.trim())
  .filter((email) => email.length > 0);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      if (authorizedEmails.length === 0) return true;
      return authorizedEmails.includes(user.email);
    },
    async session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
});
