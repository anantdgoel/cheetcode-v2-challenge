#!/usr/bin/env node

/**
 * Generate RSA key pair for Convex custom JWT authentication.
 *
 * Outputs:
 *   CONVEX_AUTH_PRIVATE_KEY  — PEM private key (set in .env.local for Next.js)
 *   CONVEX_AUTH_JWKS         — JWKS JSON (set in Convex env via `npx convex env set`)
 */

import { exportJWK, exportPKCS8, generateKeyPair } from 'jose'

const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true })

const privatePem = await exportPKCS8(privateKey)
const publicJwk = await exportJWK(publicKey)
publicJwk.kid = 'convex-auth-key'
publicJwk.alg = 'RS256'
publicJwk.use = 'sig'

const jwks = JSON.stringify({ keys: [publicJwk] })

console.log('=== Add to .env.local (Next.js) ===\n')
console.log(`CONVEX_AUTH_PRIVATE_KEY="${privatePem.replace(/\n/g, '\\n')}"`)
console.log('')
console.log('=== Set in Convex ===')
console.log('npx convex env set CONVEX_AUTH_JWKS \'%s\'\n', jwks)
console.log('=== Raw JWKS (for reference) ===')
console.log(jwks)
