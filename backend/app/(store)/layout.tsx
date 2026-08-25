import type { ReactNode } from 'react'
import Link from 'next/link'
import './store.css'

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="store">
      <nav className="store__nav">
        <Link className="store__brand" href="/products">
          MOOX<span>·</span>Commerce
        </Link>
        <Link href="/products">Produk</Link>
        <Link href="/docs">API Docs</Link>
        <span className="spacer" />
        <a href="https://eyesonmoox.com">Situs utama ↗</a>
      </nav>
      <main className="store__main">{children}</main>
    </div>
  )
}
