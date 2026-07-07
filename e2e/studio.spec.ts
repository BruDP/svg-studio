import { test, expect } from '@playwright/test'

test('SKU → anteprima → export', async ({ page }) => {
  await page.goto('/studio')
  await page.getByLabel('SKU').fill('2137070')
  await page.getByRole('button', { name: 'Proponi' }).click()

  // l'anteprima SVG appare (filtrata sul contenuto per non intercettare l'svg
  // della dev toolbar di Next.js, anch'esso presente nel DOM in modalità dev)
  const anteprima = page.locator('svg').filter({ hasText: 'barbecue' })
  await expect(anteprima).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('SKU 2137070')).toBeVisible()

  // export → miniatura di conferma
  await page.getByRole('button', { name: 'Esporta JPEG' }).click()
  await expect(page.getByAltText('Anteprima esportata')).toBeVisible({ timeout: 30_000 })
})

test('SKU inesistente → errore chiaro', async ({ page }) => {
  await page.goto('/studio')
  await page.getByLabel('SKU').fill('SKU-CHE-NON-ESISTE')
  await page.getByRole('button', { name: 'Proponi' }).click()
  // Next.js in dev inietta un secondo elemento role="alert" (route-announcer) accanto
  // a quello dell'app: filtriamo sul testo per isolare il messaggio d'errore reale.
  await expect(page.getByRole('alert').filter({ hasText: 'non trovato' })).toBeVisible()
})
