const jwks = process.env.CONVEX_AUTH_JWKS

const authConfig = {
  providers: [
    {
      type: 'customJwt' as const,
      applicationID: 'madison-exchange',
      issuer: 'https://madison-exchange.firecrawl.dev',
      algorithm: 'RS256' as const,
      ...(jwks
        ? { jwks: `data:application/json,${encodeURIComponent(jwks)}` }
        : {})
    }
  ]
}

export default authConfig
