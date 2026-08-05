import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      isAdmin?: boolean;
      githubLogin?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    isAdmin?: boolean;
    githubLogin?: string | null;
  }
}
