import Link from 'next/link'
import { getProducts, assetUrl, type ProductSummary } from '@/lib/middleware'

export const metadata = { title: 'Produk · MOOX' }

const idr = (n: number) => n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export default async function ProductsPage() {
  const { items, total } = await getProducts('perPage=50')

  return (
    <>
      <p className="store__kicker">Katalog</p>
      <h1 className="store__h1">Produk MOOX</h1>
      <p className="store__sub">{total} produk · data live dari commerce middleware</p>

      <div className="grid">
        {items.map((p: ProductSummary) => (
          <Link key={p.sku} className="card" href={`/products/${p.slug}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="card__img" src={assetUrl(p.image)} alt={p.name} />
            <div className="card__body">
              <span className="card__cat">{p.categorySlug}</span>
              <span className="card__name">{p.name}</span>
              {p.status === 'active' ? (
                <span className="price">
                  {idr(p.price.amount)}
                  {p.compareAt && <s>{idr(p.compareAt.amount)}</s>}
                </span>
              ) : (
                <span className="chip chip--soon">Segera hadir</span>
              )}
              {p.featured && p.status === 'active' && <span className="chip">Unggulan</span>}
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
