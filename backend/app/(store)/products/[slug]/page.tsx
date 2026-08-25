import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getProduct, assetUrl, MiddlewareError } from '@/lib/middleware'
import AddToCart from './AddToCart'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const { product } = await getProduct(slug)
    return { title: `${product.name} · MOOX` }
  } catch {
    return { title: 'Produk · MOOX' }
  }
}

const idr = (n: number) => n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let product
  try {
    ;({ product } = await getProduct(slug))
  } catch (e) {
    if (e instanceof MiddlewareError && e.status === 404) notFound()
    throw e
  }

  const purchasable = product.status === 'active' && product.stock.freeQty > 0

  return (
    <>
      <p className="store__kicker">
        <Link href="/products">← Katalog</Link>
      </p>
      <div className="detail">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="detail__img" src={assetUrl(product.image)} alt={product.name} />
          <div className="detail__thumbs">
            {product.images.slice(1).map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={assetUrl(src)} alt="" />
            ))}
          </div>
        </div>
        <div>
          <h1 className="store__h1">{product.name}</h1>
          {product.status === 'active' ? (
            <p className="price">
              {idr(product.price.amount)}
              {product.compareAt && <s>{idr(product.compareAt.amount)}</s>}
            </p>
          ) : (
            <p className="chip chip--soon" style={{ display: 'inline-block' }}>Segera hadir</p>
          )}
          <p className="detail__stock">
            SKU {product.sku} · Stok tersedia: {product.stock.freeQty}
          </p>
          <p className="detail__desc">{product.descriptionLong}</p>
          <div className="detail__attrs">
            {Object.entries(product.attributes).flatMap(([name, values]) =>
              values.map((v) => (
                <span key={`${name}-${v}`} className="chip">{v}</span>
              )),
            )}
          </div>
          <AddToCart sku={product.sku} disabled={!purchasable} />
        </div>
      </div>
    </>
  )
}
