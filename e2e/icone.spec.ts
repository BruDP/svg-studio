import { test, expect } from '@playwright/test'
import { apriDalBanco } from './helpers'

test('picker: scegliere un\'icona la mostra marcata; l\'export segnala le non approvate', async ({ page }) => {
  await apriDalBanco(page, '2137070', '2137070')
  await expect(page.getByTestId('anteprima-editor')).toBeVisible({ timeout: 30_000 })

  // cambia icona della prima feature
  await page.getByRole('button', { name: /^Cambia icona / }).first().click()
  // il dialog del picker (role="dialog") disambigua dal bottone "Cerca" del banco — senza lo
  // scoping, getByRole('button', { name: 'Cerca' }) rischia di matchare bottoni omonimi altrove.
  const dialog = page.getByRole('dialog')
  const cerca = dialog.getByLabel('Cerca icona')
  await cerca.fill('stella')
  await dialog.getByRole('button', { name: 'Cerca' }).click()
  await dialog.getByRole('button', { name: /^Usa / }).first().click()

  // l'icona scelta è marcata "da approvare"
  await expect(page.locator('[data-testid^="icona-marcata-"]').first()).toBeVisible({ timeout: 30_000 })

  // export segnala le non approvate
  await page.getByRole('button', { name: 'Esporta PNG + SVG' }).click()
  await expect(page.getByText(/non approvate/i)).toBeVisible({ timeout: 30_000 })
})

test('griglia /icone: approvare rimuove lo stato in-revisione', async ({ page }) => {
  // prima crea un'icona in-revisione via il picker (riusa il flusso), poi vai su /icone
  await page.goto('/icone')
  await page.getByRole('button', { name: 'Semina dal dizionario' }).click()
  // dopo il seed ci sono icone in-revisione: approvale tutte
  const approvaTutte = page.getByRole('button', { name: /^Approva tutte/ })
  await expect(approvaTutte).toBeEnabled({ timeout: 30_000 })
  await approvaTutte.click()
  await expect(page.getByRole('button', { name: /^Approva tutte/ })).toBeDisabled({ timeout: 30_000 })
})
