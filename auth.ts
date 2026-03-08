import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'

/**
 * Auth.js v5 config — GitHub OAuth only.
 * Requires AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, and AUTH_SECRET env vars.
 */
function requireEnv (name: 'AUTH_GITHUB_ID' | 'AUTH_GITHUB_SECRET') {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not configured`)
  }

  return value
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: requireEnv('AUTH_GITHUB_ID'),
      clientSecret: requireEnv('AUTH_GITHUB_SECRET')
    })
  ],
  callbacks: {
    // Expose the GitHub username in the session so the client can use it
    session ({ session, token }) {
      if (token.githubUsername) {
        const sessionUser = session.user as typeof session.user & { githubUsername?: string }
        sessionUser.githubUsername = token.githubUsername as string
      }
      return session
    },
    jwt ({ token, profile }) {
      // On initial sign-in, persist the GitHub login (username) in the JWT
      if (profile?.login) {
        token.githubUsername = profile.login
      }
      return token
    }
  }
})
