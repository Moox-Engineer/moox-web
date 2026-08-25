'use client'

import { useState } from 'react'

/**
 * Adds one unit by read-merge-write against PUT /api/v1/cart (the cart API
 * replaces state wholesale). Good enough until a dedicated POST endpoint
 * earns its keep.
 */
export default function AddToCart({ sku, disabled }: { sku: string; disabled?: boolean }) {
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle')

  async function add() {
    setState('busy')
    try {
      const current = await fetch('/api/v1/cart').then((r) => r.json())
      const items = (current.cart?.items ?? []).map((i: { sku: string; qty: number }) => ({ sku: i.sku, qty: i.qty }))
      const existing = items.find((i: { sku: string }) => i.sku === sku)
      if (existing) existing.qty = Math.min(10, existing.qty + 1)
      else items.push({ sku, qty: 1 })

      const res = await fetch('/api/v1/cart', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error(await res.text())
      setState('ok')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('err')
      setTimeout(() => setState('idle'), 3500)
    }
  }

  return (
    <>
      <button className="btn" onClick={add} disabled={disabled || state === 'busy'}>
        {state === 'busy' ? 'Menambahkan…' : 'Tambah ke keranjang'}
      </button>
      {state === 'ok' && <span className="btn__note btn__note--ok">✓ ditambahkan</span>}
      {state === 'err' && <span className="btn__note">gagal — coba lagi</span>}
    </>
  )
}
