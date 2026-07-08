import { test, expect, type Page } from '@playwright/test'

// Apre /studio e lancia "Proponi" per lo SKU dato, in modo robusto rispetto alla
// race di idratazione di Next in dev: Playwright può riempire l'input e cliccare
// prima che React idrati, così l'onChange non scatta e lo stato controllato `sku`
// resta vuoto (pulsante disabilitato) anche se il valore è nel DOM. Ri-fillo a ogni
// iterazione finché il PULSANTE risulta abilitato — l'unico segnale che lo stato React
// ha davvero recepito lo SKU (cioè che un fill è avvenuto post-idratazione) — poi clicco.
async function apriEProponi(page: Page, sku: string) {
  await page.goto('/studio')
  const input = page.getByLabel('SKU')
  const proponi = page.getByRole('button', { name: 'Proponi' })
  await expect(async () => {
    await input.fill(sku)
    await expect(proponi).toBeEnabled()
  }).toPass({ timeout: 15_000 })
  await proponi.click()
}

test('SKU → anteprima → export', async ({ page }) => {
  await apriEProponi(page, '2137070')

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
  await apriEProponi(page, 'SKU-CHE-NON-ESISTE')
  // Next.js in dev inietta un secondo elemento role="alert" (route-announcer) accanto
  // a quello dell'app: filtriamo sul testo per isolare il messaggio d'errore reale.
  await expect(page.getByRole('alert').filter({ hasText: 'non trovato' })).toBeVisible({ timeout: 30_000 })
})

test('modifica: rimuovere una feature aggiorna anteprima ed export', async ({ page }) => {
  await apriEProponi(page, '2137070')
  await expect(page.locator('svg').filter({ hasText: 'barbecue' })).toBeVisible({ timeout: 30_000 })

  // conteggio etichette prima
  const etichette = page.getByLabel(/^Etichetta /)
  const primaN = await etichette.count()
  expect(primaN).toBeGreaterThan(0)

  // rimuovi la prima feature
  await page.getByRole('button', { name: /^Rimuovi / }).first().click()
  await expect(etichette).toHaveCount(primaN - 1)

  // export continua a funzionare (riflette la scena modificata)
  await page.getByRole('button', { name: 'Esporta JPEG' }).click()
  await expect(page.getByAltText('Anteprima esportata')).toBeVisible({ timeout: 30_000 })
})

test('salva e riprendi: la scheda modificata persiste', async ({ page }) => {
  await apriEProponi(page, '2137070')
  await expect(page.locator('svg').filter({ hasText: 'barbecue' })).toBeVisible({ timeout: 30_000 })

  const etichette = page.getByLabel(/^Etichetta /)
  const primaN = await etichette.count()
  expect(primaN).toBeGreaterThan(0)
  await page.getByRole('button', { name: /^Rimuovi / }).first().click()
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByText('Scheda salvata')).toBeVisible({ timeout: 30_000 })

  // ri-proponi (pagina già idratata) e riprendi la salvata → deve avere una feature in meno
  await page.getByRole('button', { name: 'Proponi' }).click()
  await expect(etichette).toHaveCount(primaN, { timeout: 30_000 }) // proposta fresca = conteggio pieno
  await page.getByRole('button', { name: 'Riprendi salvata' }).click()
  await expect(etichette).toHaveCount(primaN - 1, { timeout: 30_000 }) // salvata = una in meno
})

test('drag di una maniglia quota sposta l\'estremo', async ({ page }) => {
  await apriEProponi(page, '2137070')
  await expect(page.locator('svg').filter({ hasText: 'barbecue' })).toBeVisible({ timeout: 30_000 })

  const maniglia = page.locator('[data-testid^="quota-"]').first()
  await expect(maniglia).toBeVisible()
  const prima = await maniglia.boundingBox()
  expect(prima).not.toBeNull()

  // trascina la maniglia di ~80px a sinistra e ~40px in basso
  await maniglia.hover()
  await page.mouse.down()
  await page.mouse.move(prima!.x + prima!.width / 2 - 80, prima!.y + prima!.height / 2 + 40, { steps: 8 })
  await page.mouse.up()

  const dopo = await maniglia.boundingBox()
  expect(Math.abs(dopo!.x - prima!.x) + Math.abs(dopo!.y - prima!.y)).toBeGreaterThan(20)

  // l'export riflette comunque la scena modificata
  await page.getByRole('button', { name: 'Esporta JPEG' }).click()
  await expect(page.getByAltText('Anteprima esportata')).toBeVisible({ timeout: 30_000 })
})

test('cambio foto: selezionare una miniatura non rompe anteprima ed export', async ({ page }) => {
  await apriEProponi(page, '2137070')
  await expect(page.locator('svg').filter({ hasText: 'barbecue' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Foto 2' }).click()
  await expect(page.locator('svg').filter({ hasText: 'barbecue' })).toBeVisible()
  await page.getByRole('button', { name: 'Esporta JPEG' }).click()
  await expect(page.getByAltText('Anteprima esportata')).toBeVisible({ timeout: 30_000 })
})

test('ricerca per nome trova il prodotto e lo carica', async ({ page }) => {
  await page.goto('/studio')
  const cerca = page.getByLabel('Cerca per nome')
  await expect(async () => {
    await cerca.fill('barbecue')
    await expect(page.getByRole('button', { name: 'Cerca' })).toBeEnabled()
  }).toPass({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Cerca' }).click()
  await page.getByRole('button', { name: 'Scegli 2137070' }).click()
  await expect(page.locator('svg').filter({ hasText: 'barbecue' })).toBeVisible({ timeout: 30_000 })
})
