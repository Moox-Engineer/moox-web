export const metadata = { title: 'API Docs · MOOX' }

const BACKEND_ENDPOINTS: [string, string, string][] = [
  ['GET', '/api/v1/products', 'Proxy katalog ke middleware (category, q, featured, skus, page, perPage).'],
  ['GET', '/api/v1/products/{slug}', 'Detail produk, harga & stok live.'],
  ['GET', '/api/v1/categories', 'Daftar kategori.'],
  ['GET', '/api/v1/cart', 'Keranjang pemanggil (cookie → DB) + enrich harga/stok live.'],
  ['PUT', '/api/v1/cart', 'Ganti isi keranjang: { items: [{ sku, qty }] }.'],
  ['POST', '/api/v1/checkout', '{ customer, paymentMethod? } → order (+payment). Keranjang dari cookie.'],
  ['GET', '/api/v1/orders/{id}?email=', 'Status order (guest access: email harus cocok).'],
]

const MIDDLEWARE_ENDPOINTS: [string, string, string][] = [
  ['GET', '/health', 'Liveness + mode (mock/odoo).'],
  ['GET', '/catalog/products', 'Katalog: category, q, featured, skus, page, perPage.'],
  ['GET', '/catalog/products/{slug}', 'Detail + stok.'],
  ['GET', '/catalog/categories', 'Kategori.'],
  ['GET', '/inventory?skus=', 'Stok per SKU (on-hand, reserved, free).'],
  ['POST', '/customers', 'Upsert customer by email.'],
  ['POST', '/orders', 'Buat draft order (harga server-side; Idempotency-Key).'],
  ['GET', '/orders/{id}', 'Status order.'],
  ['POST', '/orders/{id}/confirm', 'Konfirmasi manual (transfer/COD).'],
  ['POST', '/orders/{id}/cancel', 'Batalkan (draft/payment_pending).'],
  ['POST', '/payments/initiate', '{ orderId, method } → QRIS/VA/e-wallet/redirect.'],
  ['GET', '/payments/{id}', 'Status pembayaran.'],
  ['POST', '/payments/webhook', 'Callback gateway (simulator pembayaran di mock).'],
]

function Table({ rows, title }: { rows: [string, string, string][]; title: string }) {
  return (
    <section style={{ marginTop: '2.5rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{title}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem', fontSize: '0.85rem' }}>
        <tbody>
          {rows.map(([m, path, desc]) => (
            <tr key={m + path} style={{ borderTop: '1px solid rgba(174,188,193,.15)' }}>
              <td style={{ padding: '.5rem .75rem .5rem 0', fontFamily: 'ui-monospace, monospace', color: '#00cbdc', whiteSpace: 'nowrap' }}>{m}</td>
              <td style={{ padding: '.5rem .75rem .5rem 0', fontFamily: 'ui-monospace, monospace', color: '#f4f7f8', whiteSpace: 'nowrap' }}>{path}</td>
              <td style={{ padding: '.5rem 0', color: '#7e9097' }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default function DocsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0d1518', color: '#f4f7f8', fontFamily: 'ui-sans-serif, system-ui, sans-serif', padding: '3rem clamp(1.25rem, 4vw, 3rem)' }}>
      <div style={{ maxWidth: 900, marginInline: 'auto' }}>
        <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.7rem', letterSpacing: '.16em', textTransform: 'uppercase', color: '#00cbdc' }}>Referensi</p>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Commerce API</h1>
        <p style={{ color: '#7e9097', marginTop: '.5rem', maxWidth: '70ch' }}>
          Kontrak lengkap ada di <code>docs/commerce/middleware-api.md</code> di repo. Auth: bearer
          token (backend↔middleware); error envelope seragam <code>{`{ error: { code, message, retryable } }`}</code>.
        </p>
        <Table rows={BACKEND_ENDPOINTS} title="Backend (BFF) — dipakai storefront" />
        <Table rows={MIDDLEWARE_ENDPOINTS} title="Middleware — hanya dipakai backend" />
      </div>
    </div>
  )
}
