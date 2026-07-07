import { StudioClient } from './StudioClient'

export default function StudioPage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-semibold text-zinc-800">SVG Studio</h1>
      <StudioClient />
    </main>
  )
}
