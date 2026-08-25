import Link from 'next/link'

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: '#0d1518', color: '#f4f7f8',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          MOOX <span style={{ color: '#00cbdc' }}>·</span> Commerce Backend
        </h1>
        <p style={{ color: '#7e9097', marginTop: '0.5rem' }}>
          Next.js BFF untuk fitur commerce situs MOOX
        </p>
        <p style={{ marginTop: '2rem', display: 'flex', gap: '1.25rem', justifyContent: 'center', fontSize: '0.9rem' }}>
          <Link href="/products" style={{ color: '#00cbdc' }}>Storefront /produk</Link>
          <Link href="/docs" style={{ color: '#00cbdc' }}>Dokumentasi API</Link>
          <a href="https://eyesonmoox.com" style={{ color: '#7e9097' }}>Situs utama ↗</a>
        </p>
      </div>
    </div>
  )
}
