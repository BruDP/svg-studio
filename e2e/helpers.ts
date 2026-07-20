import { expect, type Page } from '@playwright/test'

/**
 * Apre /studio, cerca `query` nel banco, aggiunge lo SKU atteso alla lista di lavoro e apre
 * l'editor. Ri-fillo il campo di ricerca finché il bottone "+ Aggiungi" non risulta visibile —
 * stesso pattern anti-race di idratazione già usato per l'input SKU nella UI precedente (Next
 * in dev può idratare dopo che Playwright ha già riempito il campo).
 */
export async function apriDalBanco(page: Page, query: string, sku: string) {
  await page.goto('/studio')
  const ricerca = page.getByLabel('Cerca per codice o descrizione')
  const aggiungi = page.getByRole('button', { name: `Aggiungi ${sku} alla lista di lavoro` })
  await expect(async () => {
    await ricerca.fill(query)
    await expect(aggiungi).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 15_000 })
  await aggiungi.click()
  await page.getByRole('button', { name: `Apri ${sku}` }).click()
}
