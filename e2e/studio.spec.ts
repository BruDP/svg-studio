import { test, expect } from '@playwright/test'
import { apriDalBanco } from './helpers'

test('cerca per codice, aggiungi alla lista, apri → anteprima ed export', async ({ page }) => {
  await apriDalBanco(page, '2137070', '2137070')

  // l'anteprima SVG appare (filtrata sul contenuto per non intercettare l'svg
  // della dev toolbar di Next.js, anch'esso presente nel DOM in modalità dev)
  const anteprima = page.getByTestId('anteprima-editor')
  await expect(anteprima).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('SKU 2137070')).toBeVisible()

  // export → miniatura di conferma
  await page.getByRole('button', { name: 'Esporta PNG + SVG' }).click()
  await expect(page.getByAltText('Anteprima esportata')).toBeVisible({ timeout: 30_000 })
})

test('cerca per descrizione: risultato aggiungibile, poi segnato come già aggiunto', async ({ page }) => {
  await page.goto('/studio')
  const ricerca = page.getByLabel('Cerca per codice o descrizione')
  const aggiungi = page.getByRole('button', { name: 'Aggiungi 2137070 alla lista di lavoro' })
  await expect(async () => {
    await ricerca.fill('barbecue')
    await expect(aggiungi).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 15_000 })

  await aggiungi.click()
  await expect(page.getByRole('button', { name: '2137070 già aggiunto alla lista' })).toBeVisible()
  await expect(page.getByText('Lista di lavoro (1)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apri 2137070' })).toBeVisible()
})

test('ricerca senza risultati mostra un messaggio chiaro', async ({ page }) => {
  await page.goto('/studio')
  const ricerca = page.getByLabel('Cerca per codice o descrizione')
  await ricerca.fill('nessun-prodotto-corrisponde-a-questo-testo')
  await expect(page.getByText(/Nessun risultato/)).toBeVisible({ timeout: 15_000 })
})

test('modifica: rimuovere una feature aggiorna anteprima ed export', async ({ page }) => {
  await apriDalBanco(page, '2137070', '2137070')
  await expect(page.getByTestId('anteprima-editor')).toBeVisible({ timeout: 30_000 })

  // conteggio etichette prima
  const etichette = page.getByLabel(/^Etichetta /)
  const primaN = await etichette.count()
  expect(primaN).toBeGreaterThan(0)

  // rimuovi la prima feature
  await page.getByRole('button', { name: /^Rimuovi / }).first().click()
  await expect(etichette).toHaveCount(primaN - 1)

  // export continua a funzionare (riflette la scena modificata)
  await page.getByRole('button', { name: 'Esporta PNG + SVG' }).click()
  await expect(page.getByAltText('Anteprima esportata')).toBeVisible({ timeout: 30_000 })
})

test('salva e riprendi: la scheda modificata persiste; tornare al banco mantiene la lista', async ({ page }) => {
  await apriDalBanco(page, '2137070', '2137070')
  await expect(page.getByTestId('anteprima-editor')).toBeVisible({ timeout: 30_000 })

  const etichette = page.getByLabel(/^Etichetta /)
  const primaN = await etichette.count()
  expect(primaN).toBeGreaterThan(0)
  await page.getByRole('button', { name: /^Rimuovi / }).first().click()
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByText('Scheda salvata')).toBeVisible({ timeout: 30_000 })

  // torna al banco: la lista di lavoro resta intatta (stessa voce ancora presente)
  await page.getByRole('button', { name: '← Torna al banco' }).click()
  await expect(page.getByText('Lista di lavoro (1)')).toBeVisible()
  const apriDiNuovo = page.getByRole('button', { name: 'Apri 2137070' })
  await expect(apriDiNuovo).toBeVisible()

  // ri-apri (propose fresca) → conteggio pieno, poi "Riprendi salvata" → una feature in meno
  await apriDiNuovo.click()
  await expect(etichette).toHaveCount(primaN, { timeout: 30_000 })
  await page.getByRole('button', { name: 'Riprendi salvata' }).click()
  await expect(etichette).toHaveCount(primaN - 1, { timeout: 30_000 })
})

test('drag di una maniglia quota sposta l\'estremo', async ({ page }) => {
  await apriDalBanco(page, '2137070', '2137070')
  await expect(page.getByTestId('anteprima-editor')).toBeVisible({ timeout: 30_000 })

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
  await page.getByRole('button', { name: 'Esporta PNG + SVG' }).click()
  await expect(page.getByAltText('Anteprima esportata')).toBeVisible({ timeout: 30_000 })
})

test('cambio foto: selezionare una miniatura non rompe anteprima ed export', async ({ page }) => {
  await apriDalBanco(page, '2137070', '2137070')
  await expect(page.getByTestId('anteprima-editor')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Foto 2' }).click()
  await expect(page.getByTestId('anteprima-editor')).toBeVisible()
  await page.getByRole('button', { name: 'Esporta PNG + SVG' }).click()
  await expect(page.getByAltText('Anteprima esportata')).toBeVisible({ timeout: 30_000 })
})

test('genera tutte: genera la scheda in blocco e mostra il riepilogo', async ({ page }) => {
  await page.goto('/studio')
  const ricerca = page.getByLabel('Cerca per codice o descrizione')
  const aggiungi = page.getByRole('button', { name: 'Aggiungi 2137070 alla lista di lavoro' })
  await expect(async () => {
    await ricerca.fill('2137070')
    await expect(aggiungi).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 15_000 })
  await aggiungi.click()

  await page.getByRole('button', { name: 'Genera tutte' }).click()
  await expect(page.getByText(/1 generate, 0 errori/)).toBeVisible({ timeout: 30_000 })
  // stato per riga: "✓ fatto" se ok, oppure "⚠ da rivedere: …" se la scheda ha segnali di qualità
  await expect(page.getByText(/✓ fatto|⚠ da rivedere/)).toBeVisible()
})
