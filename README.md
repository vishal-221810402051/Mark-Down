# Mark-Down (ChatGPT Doc -> Professional PDF)

## Dev (Local)
```powershell
npm install
npm run dev
```

Open http://localhost:3000

## Dev (Docker)
```powershell
docker compose up --build
```

Open http://localhost:3000

If port 3000 is occupied:
```powershell
$env:APP_PORT=3001
docker compose up --build
```

## Lint / Build
```powershell
npm run lint
npm run build
```

## Phase 0 Validation Checklist (MUST PASS)

Run these:

### Local checks
```powershell
npm run lint
npm run build
```

### Docker checks
```powershell
docker compose up --build
```

Open http://localhost:3000 and confirm page loads.

Stop containers:

```powershell
docker compose down
```

## Phase 0 PASS criteria

✅ npm run lint passes

✅ npm run build passes

✅ docker compose up --build runs and site loads
