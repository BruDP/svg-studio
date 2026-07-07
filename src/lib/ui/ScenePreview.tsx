'use client'

export function ScenePreview({ svg }: { svg: string }) {
  return (
    <div
      className="w-full max-w-[1000px] aspect-square border border-zinc-200 bg-white"
      // l'SVG è generato SERVER-SIDE dal renderer canonico (stesso output dell'export) —
      // non è input utente arbitrario: il testo è già XML-escapato e le icone sono sanitizzate/approvate
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
