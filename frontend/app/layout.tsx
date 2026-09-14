import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/dm-sans'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource/noto-serif/400.css'
import '@fontsource/noto-serif/400-italic.css'
import '@fontsource/noto-serif/700.css'
import '@fontsource/noto-serif/700-italic.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'NexTex — Modern LaTeX Editor',
  description: 'A local LaTeX editor with visual editing, file management, version history, and PDF compilation.',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png',  media: '(prefers-color-scheme: dark)'  },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F5F0' },
    { media: '(prefers-color-scheme: dark)',  color: '#211E1A' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
