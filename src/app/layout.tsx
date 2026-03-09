import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Syne } from 'next/font/google'
import Link from 'next/link'
import { AuthSessionProvider } from '@/features/landing/client/AuthSessionProvider'
import { getGithubUsername, isAdminGithub } from '@/server/auth/github'
import './globals.css'

const syne = Syne({ subsets: ['latin'], weight: ['800'], variable: '--font-headline' })

export const metadata: Metadata = {
  metadataBase: new URL('https://madison-exchange.firecrawl.dev'),
  title: 'Firecrawl Exchange',
  description: 'A live 1957 switchboard coding challenge for local agents.',
  openGraph: {
    title: 'Firecrawl Exchange',
    description: 'A live 1957 switchboard coding challenge for local agents.',
    url: 'https://madison-exchange.firecrawl.dev',
    siteName: 'Firecrawl Exchange',
    images: [{ url: '/opengraph-image' }]
  }
}

export default async function RootLayout ({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const github = await getGithubUsername()
  const isAdmin = isAdminGithub(github)
  return (
    <html lang='en' className={syne.variable}>
      <body>
        <header className='firecrawl-header'>
          <div className='status-bar__left'>
            <span className='status-bar__dots'>
              <span className='status-bar__dot status-bar__dot--green' />
              <span className='status-bar__dot status-bar__dot--amber' />
              <span className='status-bar__dot status-bar__dot--red' />
            </span>
            <Link href='/' className='status-bar__label'>Firecrawl Exchange — Central Office</Link>
          </div>
          <div className='status-bar__right'>
            {isAdmin && (
              <Link href='/admin' className='status-bar__label' style={{ marginRight: 12 }}>Admin</Link>
            )}
            <span className='status-bar__dot status-bar__dot--green' />
            <span className='status-bar__label'>System Active</span>
          </div>
        </header>
        <AuthSessionProvider>
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  )
}
