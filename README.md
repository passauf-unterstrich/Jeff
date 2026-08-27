# Jeff

Jeff ist ein privater, mobil optimierter Küchen-Workspace. Die App hält das aktuelle Rezept samt Kochfortschritt, eine nach Edeka-Laufrichtung sortierte Einkaufsliste und einen bewusst einfachen Vorrat zusammen.

Technik: SvelteKit 5 · TypeScript · Supabase Auth/Postgres/RLS · Vercel.

## Was bereits funktioniert

- **Kochen:** editierbares Tagesrezept, ausführlich coachende Schritte, Mise-en-Place- und Schritt-Fortschritt, Lernfokus, Notiz und Kochabschluss.
- **Historie:** frühere Rezepte chronologisch wiederfinden und samt gespeichertem Kochstand öffnen.
- **Einkaufen:** feste Abteilungsreihenfolge, antippbare Checkboxen, Hinzufügen, Bearbeiten, Löschen und Reaktivieren.
- **Checkout:** Nur tatsächlich abgehakte Einkäufe gelangen in den Vorrat; offene Punkte lassen sich gezielt für die nächste KI-Liste merken.
- **Kochabschluss:** Exakt verfolgte Hauptzutaten werden erst beim tatsächlichen Abschluss einmalig abgezogen; Favoriten bleiben zusätzlich markiert.
- **Vorrat:** Suche und Lagerortfilter; entweder genaue Menge oder nur `vorhanden / wenig / leer`; Mengen reduzieren; Artikel direkt auf die Einkaufsliste setzen; Verbrauchsdaten sind optional und werden dezent markiert.
- **Persistenz:** ohne Konfiguration lokal im Browser; mit Supabase nutzergebunden und geräteübergreifend.
- **Login:** E-Mail/Passwort und Magic Link.

Beim ersten Laden einer leeren Supabase-Datenbank legt Jeff für den angemeldeten Nutzer automatisch das Beispielrezept, die Einkaufsliste und den Demo-Vorrat an.

## 1. Lokal starten (sofort im Demo-Modus)

Voraussetzung: Node.js 22.

```sh
cd /Users/linus/Desktop/Tech/Jeff
npm install
npm run dev
```

Dann [http://localhost:5173](http://localhost:5173) öffnen. Solange keine `.env` existiert, speichert Jeff Demo-Änderungen in diesem Browser und zeigt einen dezenten Hinweis.

Qualitätsprüfungen:

```sh
npm run check
npm run build
```

## 2. Supabase einrichten

1. Auf [supabase.com/dashboard](https://supabase.com/dashboard) ein neues Projekt erstellen.
2. Im Projekt **SQL Editor → New query** öffnen.
3. Den gesamten Inhalt von [`supabase/schema.sql`](supabase/schema.sql) einfügen und mit **Run** ausführen.
4. Unter **Authentication → Providers → Email** E-Mail aktivieren. Für den privaten Start kannst du E-Mail/Passwort nutzen; Magic Link funktioniert ebenfalls.
5. Unter **Authentication → URL Configuration** lokal `http://localhost:5173` als Site URL und Redirect URL eintragen. Nach dem Vercel-Deploy zusätzlich die Produktions-URL ergänzen.
6. Unter **Project Settings → API** die Project URL und den `anon`/`publishable` Key kopieren.

Wichtig: Jeff nutzt im Browser nur den öffentlichen `anon`/`publishable` Key. Die Sicherheit entsteht durch die aktivierte Row-Level Security. Ein Supabase Service-Role-Key gehört **nie** in `.env`, Vercel-Browservariablen oder Git.

## 3. Umgebungsvariablen setzen

```sh
cd /Users/linus/Desktop/Tech/Jeff
cp .env.example .env
```

Danach `.env` ausfüllen:

```dotenv
PUBLIC_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
PUBLIC_SUPABASE_ANON_KEY=DEIN_ANON_ODER_PUBLISHABLE_KEY
```

Den Entwicklungsserver neu starten. `/login` zeigt dann die echte Anmeldung; die Startseite leitet nicht angemeldete Nutzer dorthin weiter.

## 4. Eigenes GitHub-Repository anlegen

Das lokale Repository ist bereits als `main` initialisiert. Zuerst lokal committen:

```sh
cd /Users/linus/Desktop/Tech/Jeff
git add .
git commit -m "Initial Jeff kitchen workspace"
```

Dann auf [github.com/new](https://github.com/new) ein **privates**, leeres Repository namens `Jeff` erstellen – ohne README oder `.gitignore`. Anschließend die von GitHub angezeigte URL einsetzen:

```sh
git remote add origin https://github.com/DEIN-NAME/Jeff.git
git push -u origin main
```

Alternativ mit bereits angemeldeter GitHub CLI:

```sh
gh repo create Jeff --private --source=. --remote=origin --push
```

## 5. Auf Vercel deployen

1. Auf [vercel.com/new](https://vercel.com/new) das private GitHub-Repository `Jeff` importieren.
2. Vercel erkennt SvelteKit automatisch. Build Command und Output Directory unverändert lassen.
3. Unter **Environment Variables** beide `PUBLIC_SUPABASE_*`-Variablen für Production, Preview und Development eintragen.
4. **Deploy** ausführen.
5. Die fertige `https://…vercel.app`-Adresse in Supabase unter **Authentication → URL Configuration** als Site URL und Redirect URL ergänzen.

Spätere Änderungen werden nach `git push` automatisch neu deployed.

## Daten- und KI-Architektur

Die Oberfläche arbeitet über eine kleine Repository-Schicht in `src/lib/repository.ts`. Heute kann ein Mensch alles direkt editieren. Eine spätere Koch-Coach-Anbindung kann dieselben Supabase-Tabellen befüllen: Der Coach liest den nutzergebundenen Vorrat, schreibt ein detailliertes Rezept oder aktualisiert die aktuelle Einkaufsliste, und Jeff zeigt das Ergebnis sofort auf allen Geräten.

Die verbindlichen Regeln für diese spätere Anbindung – inklusive Schrittqualität, spontanem Abendmodus, Wocheneinkauf und einfacher Vorratslogik – stehen in [`docs/coach-contract.md`](docs/coach-contract.md).

Das bewusst kleine KI-Eingabeformat ist als JSON Schema in [`docs/recipe.schema.json`](docs/recipe.schema.json) definiert. Ein Rezept enthält geordnete Arrays statt einer fest eingebauten Schrittzahl. Jeder Schritt trennt Handlung, sichtbares Ziel und eine kurze wissenschaftliche Erklärung. Der Kochfortschritt bleibt als eigene Session vom Rezeptinhalt getrennt.

Für Einkaufsplanungen gibt es zusätzlich [`docs/shopping-list.schema.json`](docs/shopping-list.schema.json). Es trennt die sichtbare Einkaufsmenge vom späteren Vorratszugang. Der vollständige Kreislauf für einen offenen Claude- oder anderen KI-Chat steht in [`docs/coach-contract.md`](docs/coach-contract.md).

Eine direkt nutzbare Arbeitsanweisung für den Claude-Chat „KI Bootcamp Einkaufsplanung“ liegt in [`docs/claude-coach-prompt.md`](docs/claude-coach-prompt.md). Ohne eine später einzurichtende geschützte Schnittstelle kann der Cloud-Chat Jeff noch nicht selbstständig lesen oder verändern.

Für diese spätere Anbindung gehört ein geheimer KI- oder Service-Schlüssel ausschließlich in eine geschützte serverseitige Funktion (zum Beispiel eine Supabase Edge Function oder Vercel Function). Er darf niemals in eine `PUBLIC_*`-Variable oder den Browser gelangen. Version 1 enthält absichtlich noch keine KI-API und keinen Chat.

## Datenbank-Sicherheit

Alle fachlichen Tabellen tragen `user_id`. Row-Level Security ist auf jeder Tabelle aktiv und erlaubt Lesen, Anlegen, Ändern und Löschen nur, wenn `auth.uid()` der jeweiligen Nutzer-ID entspricht. Einkaufseinträge, Kochschritte und Fortschritt besitzen zusätzlich eigene `user_id`-Spalten, sodass auch direkte Tabellenzugriffe abgesichert sind.
