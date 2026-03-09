import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import { SignJWT, importPKCS8 } from 'jose'

/**
 * Auth.js v5 config — GitHub OAuth only.
 * Requires AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, and AUTH_SECRET env vars.
 * CONVEX_AUTH_PRIVATE_KEY is needed for signing Convex auth JWTs.
 */
function requireEnv (name: 'AUTH_GITHUB_ID' | 'AUTH_GITHUB_SECRET') {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not configured`)
  }

  return value
}

const CONVEX_TOKEN_ISSUER = 'https://madison-exchange.firecrawl.dev'
const CONVEX_TOKEN_AUDIENCE = 'madison-exchange'
const CONVEX_TOKEN_TTL_SECONDS = 3600

let cachedPrivateKey: CryptoKey | null = null

async function getConvexSigningKey () {
  if (cachedPrivateKey) return cachedPrivateKey
  const pem = process.env.CONVEX_AUTH_PRIVATE_KEY
  if (!pem) return null
  cachedPrivateKey = await importPKCS8(pem, 'RS256')
  return cachedPrivateKey
}

async function signConvexToken (githubUsername: string): Promise<string | null> {
  const key = await getConvexSigningKey()
  if (!key) return null

  return new SignJWT({ github: githubUsername })
    .setProtectedHeader({ alg: 'RS256', kid: 'convex-auth-key', typ: 'JWT' })
    .setSubject(githubUsername)
    .setIssuer(CONVEX_TOKEN_ISSUER)
    .setAudience(CONVEX_TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${CONVEX_TOKEN_TTL_SECONDS}s`)
    .sign(key)
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: requireEnv('AUTH_GITHUB_ID'),
      clientSecret: requireEnv('AUTH_GITHUB_SECRET')
    })
  ],
  callbacks: {
    session ({ session, token }) {
      if (token.githubUsername) {
        const sessionUser = session.user as typeof session.user & {
          githubUsername?: string;
          convexToken?: string;
        }
        sessionUser.githubUsername = token.githubUsername as string
        sessionUser.convexToken = token.convexToken as string | undefined
      }
      return session
    },
    async jwt ({ token, profile, trigger }) {
      // On initial sign-in, persist the GitHub login (username) in the JWT
      if (profile?.login) {
        token.githubUsername = profile.login
      }

      // Sign a Convex token when we have a GitHub username and either:
      // - it's the initial sign-in
      // - the existing token has expired (or doesn't exist yet)
      const github = token.githubUsername as string | undefined
      if (github) {
        const existingExpiry = token.convexTokenExpiry as number | undefined
        const needsRefresh = !existingExpiry || Date.now() / 1000 > existingExpiry - 300
        if (trigger === 'signIn' || needsRefresh) {
          const convexToken = await signConvexToken(github)
          if (convexToken) {
            token.convexToken = convexToken
            token.convexTokenExpiry = Math.floor(Date.now() / 1000) + CONVEX_TOKEN_TTL_SECONDS
          }
        }
      }

      return token
    }
  }
})
