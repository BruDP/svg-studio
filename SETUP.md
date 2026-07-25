# Setup Sviluppatore — SVG Studio

## Pre-commit Hook (Protezione Secrets)

Dopo il clone, **installa il pre-commit hook** che blocca i commit contenenti secrets (API keys, password, token).

### Installazione (una volta)

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```

### Cosa fa

Il hook controlla ogni commit staged e blocca se trova:
- `GEMINI_API_KEY=`
- `OPENAI_API_KEY=`
- `DATABASE_PASSWORD=`
- `private_key`, `-----BEGIN PRIVATE`, ecc.
- `aws_secret_access_key`, `github_token`, `stripe_secret`

### Esempio blocco

```
❌ RILEVATO: GEMINI_API_KEY=
❌ COMMIT BLOCCATO: Segreti rilevati nel codice!

Azioni:
1. Rimuovi il segreto dal file
2. Aggiungi il file a .gitignore se è un file di configurazione
3. Usa 'git reset' per unstage se sbagliato
```

### Se hai messo un secret per sbaglio

```bash
# 1. Rimuovi il file o il segreto
git reset HEAD <file>   # unstage
# 2. Modifica il file
# 3. Riprova il commit
```

### Aggiungere pattern nuovi

Edit `.githooks/pre-commit` e aggiungi pattern alla lista `SECRET_PATTERNS`:

```bash
SECRET_PATTERNS=(
  "GEMINI_API_KEY="
  "TUO_PATTERN_NUOVO="
  ...
)
```

## Environment

Copia `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

Riempi i valori (non verranno mai committati, `.env.local` è nel `.gitignore`):

```env
GEMINI_API_KEY=your_actual_key_here
DATABASE_URL=...
```

## Development Server

```bash
npm install
npm run dev
```

App su http://localhost:3000

## Database

SQLite with better-sqlite3:

```bash
# Init
npx prisma db push

# Studio browser
npx prisma studio
```

## Tests

```bash
npm run test          # unit + integration
npm run test:e2e      # Playwright E2E
```

---

**🔒 Ricorda:** Mai committare `.env.local`, chiavi API, o token. Il pre-commit hook è la rete di protezione.
