# Databas

Produktionsdatabasen är Supabase-projektet **training-agent** (Postgres 17, eu-central-1).
Schemat är versionshanterat i `migrations/` — kör dem i nummerordning mot en tom databas.

## Backup

**Automatiskt:** `.github/workflows/backup.yml` kör `pg_dump` söndag och onsdag och sparar
dumpen som artefakt i GitHub Actions i 90 dagar (Actions → Databasbackup → välj körning → Artifacts).
Kräver repo-secret `SUPABASE_DB_URL` (samma värde som `DATABASE_URL`, session pooler).
Körningarna håller också gratisprojektet vaket.

**Manuellt:** `.venv/bin/python scripts/backup_db.py` → JSON per tabell i `backups/<datum>/`.

## Återställning

```bash
pg_restore --no-owner --no-privileges --clean --if-exists -d "$DATABASE_URL" training-agent-ÅÅÅÅ-MM-DD.dump
```

Garmin-lösenord och tokens är krypterade med `ENCRYPTION_KEY`. Utan samma nyckel går de inte
att dekryptera efter en återställning — då måste användarna ange Garmin-uppgifterna igen.
**Spara `ENCRYPTION_KEY` i en lösenordshanterare.**
