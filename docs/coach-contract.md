# Jeff · Vertrag für den späteren Koch-Coach

Dieses Dokument beschreibt die fachliche Schnittstelle für eine spätere KI-Anbindung. Version 1 enthält absichtlich noch keine KI-API. Der Coach soll später über eine geschützte Serverfunktion dieselben Supabase-Daten schreiben, die Jeff heute manuell bearbeitet.

## Abendmodus: „Ich habe Hunger – was kochen wir?“

1. Aktuellen Vorrat des angemeldeten Nutzers lesen.
2. Genaue Artikel nach Menge, Lagerort und optionalem Verbrauchsdatum priorisieren. Basics mit Status `leer` nicht verwenden; `wenig` nur sparsam einplanen.
3. Eine kleine, vollständige Portion planen. Verderbliche Reste nur erzeugen, wenn ihre nächste Verwendung klar ist.
4. Rezept, Mise en Place und Schritte als neue Datensätze speichern; Koch-Session und Notiz leer anlegen.
5. Jeff lädt das neueste Rezept und zeigt es sofort als Kochmodus.

## Einkaufsmodus: „Was kaufen wir für die Woche?“

1. Vorrat lesen und leere oder knappe Basics berücksichtigen.
2. Kreative Gerichte für kleine Portionen und strategisch gemeinsame Zutaten planen.
3. Nur tatsächlich fehlende Mengen einkaufen.
4. Eine aktuelle Einkaufsliste anlegen und Einträge exakt diesen Kategorien zuordnen:
   `Gemüse & Obst` → `Brot, Trockenware & Saucen` → `Kühlregal` → `Fleischtheke & Käse` → `Tiefkühl` → `Getränke & Snacks` → `Küchenabteilung`.
5. Mengen in alltagstauglicher Einkaufsform schreiben, zum Beispiel `2 Stück`, `1 Bund` oder `180 g`.

## Pflichtqualität jedes Kochschritts

Ein Schritt ist kein Titel mit Alibitext. `instruction` muss so konkret sein, dass ein lernender Mensch ihn ohne Rückfrage ausführen kann. Jeder relevante Schritt enthält:

- exakte Aktion und Reihenfolge;
- konkrete Menge, Dauer und passende Herdstufe, sofern relevant;
- ein hör-, riech- oder sichtbares Signal für den richtigen Moment;
- das Kernziel der Technik;
- eine kurze Korrektur für den wahrscheinlichsten Fehler.

Beispiel: Nicht nur „Hack braten“, sondern Pfanne vorheizen, Fleisch flach einlegen, zunächst nicht bewegen, gewünschte Bräunung beschreiben und erklären, was bei austretendem Wasser zu tun ist.

Die Erklärung bleibt handlungsnah. Keine Küchengeschichte, keine langen Exkurse, keine Nährwertabsätze und kein dekoratives Storytelling.

## Vorratsregeln

- `exact`: verderbliche oder portionsrelevante Artikel wie Bananen, Eier, Fleisch, Gemüse, Käse, Reste und Tiefkühlportionen. Mengen in sinnvollen Einheiten; Gramm nur dort, wo sie praktisch helfen.
- `basic`: Gewürze, Öl, Essig, Mehl, Stärke, Reis, Pasta und Saucen. Nur `vorhanden`, `wenig` oder `leer`.
- Ein im Gespräch als leer gemeldeter Basic-Artikel wird auf `leer` gesetzt und in die aktuelle Einkaufsliste aufgenommen.
- Keine erzwungenen Verbrauchsdaten für haltbare Basics.

## Sicherheit

Der Coach handelt immer im Kontext des angemeldeten Nutzers. Geheime Schlüssel liegen ausschließlich in einer serverseitigen Funktion. Der Supabase Service-Role-Key und ein KI-Schlüssel dürfen nie an Jeffs Browsercode oder eine `PUBLIC_*`-Variable ausgegeben werden.
