# Revisione qualità del batch — Design

Data: 2026-07-21

## Obiettivo
Dopo "Genera tutte", l'operatore deve poter correggere **solo le schede che lo richiedono**, non tutte. Ogni scheda riceve uno **stato qualità** con i motivi. Include la politica onesta per il "minimo 6 icone": riempire fino a 6 con feature di categoria marcate "da verificare", mai inventare in silenzio.

## Scope

### In
1. **Valutazione qualità** (`src/lib/quality/valuta.ts`, funzione pura `valutaQualita(scene): Qualita`).
2. **Padding minimo 6 icone** in `rankFeatures` (feature di riempimento flaggate `verificata=false`).
3. **`generaSchedaAction` ritorna `qualita`**; il **Banco** mostra lo stato per riga + contatore "da rivedere".
4. Editor: nessuna modifica (le feature `verificata=false` hanno già il bordo ambra; l'operatore le conferma tenendole/modificandole o le rimuove).

### Out (YAGNI)
- Nessun punteggio numerico; solo stato ok / da-rivedere + motivi testuali.
- Nessuna "conferma" persistita separata (tenere una feature = confermata di fatto).
- Nessun segnale "profondità da Vision vs default" (non deducibile dalla scena).
- Nessun blocco: una scheda "da rivedere" è comunque generata ed esportabile.

## Componenti

### 1. `valutaQualita(scene: Scene): Qualita`
Pura, deterministica, deriva tutto dagli elementi scena.
```ts
interface Qualita {
  icone: number          // n. elementi icona-label
  daVerificare: number   // n. icona-label con verificata === false
  problemi: string[]     // messaggi leggibili
  daRivedere: boolean    // problemi.length > 0
}
```
Regole `problemi`:
- `icone < 6` → `"solo N icone (min 6)"`
- `daVerificare > 0` → `"N caratteristiche da verificare"`
(Solo questi due segnali: alto valore, zero rumore.)

### 2. Padding minimo 6 in `rankFeatures`
Dopo aver selezionato le feature reali (già cap `MAX_ICON_FEATURES=7`), se le feature-icona sono `< 6`:
- attinge da `dict.features` con `categorie.includes(categoria)`, **non badge**, **senza valore obbligatorio** (per non produrre etichette con `{valore}` vuoto), non già presenti;
- ordina per `priorita` desc, aggiunge fino a raggiungere 6 (o fino a esaurimento categoria — es. barbecue ha 3 feature: resta a 3, non si inventa oltre il catalogo);
- le feature di riempimento hanno `verificata=false`, `valore=null`.
Le feature reali restano in testa; il padding va in coda.

### 3. `generaSchedaAction` + Banco
- `generaSchedaAction` calcola `valutaQualita(scene)` e la include nel ritorno: `{ sku, ok, path?, errore?, qualita? }`.
- `Banco` (`StatoRiga` "fatto"): mostra `✓` se `!daRivedere`, altrimenti `⚠ da rivedere` + `problemi` sotto la riga; header con contatore "N da rivedere". La voce ha già "Apri" per andare all'editor.

## Flusso dati
`generaSchedaAction(sku)` → `costruisciScena` → `scene` → `valutaQualita(scene)` → ritorno con `qualita` → `Banco` la mostra. Il padding vive a monte in `rankFeatures` (dentro `extractProposal`), quindi incide sia sul batch sia sul singolo (editor).

## Test
- `valutaQualita`: scena con <6 icone → problema "solo N"; con feature non verificate → problema "N da verificare"; scena piena → `daRivedere=false`.
- `rankFeatures` padding: input con 3 feature reali su categoria ricca → output 6 (3 reali verificate + 3 padding `verificata=false`); su categoria povera (barbecue) → resta a 3; il padding non include feature con valore obbligatorio né badge.
- `generaSchedaAction` (fake offline) ritorna `qualita` coerente.
- Golden esistenti invariati salvo dove il padding cambia legittimamente il conteggio (verificare: il golden `colonna-sinistra`/barbecue ha 2 feature, categoria barbecue con 3 feature totali → padding porterebbe a 3, cambia il golden barbecue → rigenerare; segnalare).

## Nota di onestà
Le feature di padding sono ipotesi di categoria, non confermate dal testo del prodotto: sono marcate `verificata=false` e la coda di revisione le segnala. L'export le rende come icone normali: la salvaguardia è che l'operatore rivede le schede "da rivedere" prima di usarle.
