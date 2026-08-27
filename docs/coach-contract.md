# Jeff · Vertrag für den späteren Koch-Coach

Dieses Dokument beschreibt die fachliche Schnittstelle für eine spätere KI-Anbindung. Version 1 enthält absichtlich noch keine KI-API. Der Coach soll später über eine geschützte Serverfunktion dieselben Supabase-Daten schreiben, die Jeff heute manuell bearbeitet.

Der offene Cloud-Chat – zum Beispiel „KI Bootcamp Einkaufsplanung“ in Claude – ist der denkende Koch-Coach. Jeff ist kein Chatbot, sondern die verlässliche Daten- und Arbeitsoberfläche. Die Zusammenarbeit folgt immer demselben Kreislauf:

`Einkauf planen → im Laden abhaken → Checkout → Vorrat aktualisieren → Rezept planen → kochen → Kochabschluss → Vorrat aktualisieren → Historie/Favorit`

Die KI plant; nur eine ausdrückliche Handlung des Menschen bestätigt die Realität. Das Erstellen einer Einkaufsliste erhöht noch keinen Vorrat. Das Erstellen eines Rezepts verbraucht noch keine Zutaten.

## Abendmodus: „Ich habe Hunger – was kochen wir?“

1. Aktuellen Vorrat des angemeldeten Nutzers lesen.
2. Genaue Artikel nach Menge, Lagerort und optionalem Verbrauchsdatum priorisieren. Basics mit Status `leer` nicht verwenden; `wenig` nur sparsam einplanen.
3. Eine kleine, vollständige Portion planen. Verderbliche Reste nur erzeugen, wenn ihre nächste Verwendung klar ist.
4. Rezept, Mise en Place und Schritte als neue Datensätze speichern; Koch-Session und Notiz leer anlegen.
5. Jeff lädt das neueste Rezept und zeigt es sofort als Kochmodus.
6. Für exakt verfolgte Hauptzutaten `stock_consumptions` mitschreiben. Gewürze und einfache Basics gehören nicht in diese Abzugsliste.

Jeder neue KI-Upload wird als neues Rezept mit Status `active` angelegt. Ein bereits offenes Rezept darf niemals überschrieben werden: Die Datenbank verschiebt es automatisch nach `archived`. Dabei entsteht kein Verbrauch. Pro Nutzer existiert höchstens ein aktives Rezept.

Das verbindliche, maschinenlesbare Eingabeformat steht in [`recipe.schema.json`](recipe.schema.json). Die Arrays dürfen beliebig viele Mise-en-Place-Punkte und Kochschritte enthalten. Ihre Reihenfolge ist die spätere Anzeigereihenfolge; technische IDs, `user_id` und Positionswerte erzeugt die geschützte Serverfunktion.

Die angefragte Personenzahl ist Teil des Auftrags an den Coach. Der Coach berechnet vor dem Speichern alle Mengen und die praktische Kochlogik passend für genau diese Portionenzahl. Jeff zeigt `servings` anschließend nur an und skaliert keine Zahlen aus freiem Text nachträglich. Insbesondere Zeiten, Hitze, Salz und benötigte Pfannenfläche dürfen nicht blind proportional verändert werden.

## Einkaufsmodus: „Was kaufen wir für die Woche?“

1. Vorrat und aktuell gemerkte, noch nicht erledigte Einkaufspunkte lesen. Gemerkte Punkte werden in die neue Liste übernommen und danach an der alten Liste deaktiviert, damit immer nur die aktuelle Liste maßgeblich ist.
2. Kreative Gerichte für kleine Portionen und strategisch gemeinsame Zutaten planen.
3. Nur tatsächlich fehlende Mengen einkaufen.
4. Eine aktuelle Einkaufsliste anlegen und Einträge exakt diesen Kategorien zuordnen:
   `Gemüse & Obst` → `Brot, Trockenware & Saucen` → `Kühlregal` → `Fleischtheke & Käse` → `Tiefkühl` → `Getränke & Snacks` → `Küchenabteilung`.
5. Mengen in alltagstauglicher Einkaufsform schreiben, zum Beispiel `2 Stück`, `1 Bund` oder `180 g`.

Das verbindliche Format steht in [`shopping-list.schema.json`](shopping-list.schema.json). Jeder sichtbare Eintrag enthält zusätzlich eine kleine strukturierte Beschreibung seines späteren Vorratszugangs. Diese Daten sind im Laden unsichtbar.

## Checkout im Supermarkt

1. Der Nutzer hakt nur tatsächlich gekaufte Dinge ab.
2. Checkout darf jederzeit erfolgen; offene Punkte blockieren ihn nicht.
3. Vor der endgültigen Bestätigung zeigt Jeff ausschließlich die nicht gekauften Punkte.
4. Nur dort erneut mit „Nächstes Mal merken“ markierte Punkte bleiben für die nächste KI-Planung erhalten. Alles andere wird vergessen.
5. Nur abgehakte Punkte werden einmalig in den Vorrat übernommen. Basics wechseln auf `vorhanden`; genaue Artikel erhöhen ihre passende Menge.
6. Die abgeschlossene Liste ist danach unveränderlich. Eine neue KI-Planung erzeugt eine neue aktuelle Liste; eine Einkaufshistorie ist in der Oberfläche nicht nötig.

## Kochabschluss

1. Ein Rezept ist bereits beim Erstellen normal in der Historie gespeichert.
2. Erst „Kochen abschließen“ bestätigt, dass wirklich gekocht wurde.
3. Jeff zieht dann einmalig die strukturierten `stock_consumptions` von den passenden genauen Vorratsartikeln ab. Mengen werden nie negativ.
4. Basics und Gewürze werden nicht automatisch verbraucht. Meldet der Nutzer dem Coach, dass etwas leer ist, wird lediglich dessen Status aktualisiert.
5. Favorisieren ist eine zusätzliche persönliche Markierung und unabhängig von der normalen Historie.
6. Checkout und Kochabschluss sind idempotent: Wiederholtes Antippen darf Bestände nie doppelt verändern.

## Abbruch, leeres Board und Archiv

- `active`: Das eine Rezept, das gerade auf dem Kochboard liegt.
- `archived`: Nicht gekocht, manuell abgebrochen oder durch einen neueren KI-Upload ersetzt. Kein Vorratsabzug und kein Eintrag in „Gekocht“.
- `completed`: Ausdrücklich als gekocht bestätigt. Verbrauch wurde einmalig gebucht und das Rezept erscheint in der normalen Historie.

„Rezept abbrechen“ setzt das aktuelle Rezept auf `archived` und räumt das Kochboard leer. Ein leerer Zustand ist normal und signalisiert, dass der Coach ein neues Rezept einstellen kann.

Im Archiv darf der Nutzer „Doch gekocht“ wählen. Vor der Buchung verlangt Jeff eine zweite Bestätigung. Danach wird dieselbe idempotente Verbrauchsfunktion wie beim normalen Kochabschluss ausgeführt und das Rezept nach `completed` verschoben. Ein Coach darf ein archiviertes Rezept nie selbstständig als gekocht markieren.

## Pflichtqualität jedes Kochschritts

Ein Schritt ist kein Titel mit Alibitext. `instruction` muss so konkret sein, dass ein lernender Mensch ihn ohne Rückfrage ausführen kann. Jeder relevante Schritt enthält:

- exakte Aktion und Reihenfolge;
- konkrete Menge, Dauer und passende Herdstufe, sofern relevant;
- ein hör-, riech- oder sichtbares Signal für den richtigen Moment;
- das Kernziel der Technik;
- eine kurze Korrektur für den wahrscheinlichsten Fehler.
- eine kurze Erklärung in `science`, welche relevante chemische, biochemische oder physikalische Logik den Arbeitsschritt wirksam macht.

Beispiel: Nicht nur „Hack braten“, sondern Pfanne vorheizen, Fleisch flach einlegen, zunächst nicht bewegen, gewünschte Bräunung beschreiben und erklären, was bei austretendem Wasser zu tun ist.

Die Erklärung bleibt handlungsnah. Keine Küchengeschichte, keine langen Exkurse, keine Nährwertabsätze und kein dekoratives Storytelling.

Jeff trennt dabei bewusst drei Ebenen: `instruction` sagt exakt, was zu tun ist; `goal` beschreibt das prüfbare Ergebnis; `science` erklärt knapp, warum die Methode funktioniert. Die Wissenschaft muss korrekt, in Alltagssprache und unmittelbar nützlich sein. Fachbegriffe wie Maillard-Reaktion, Osmose oder Emulsion dürfen vorkommen, werden aber im selben Satz verständlich gemacht.

## Modulare Anzeige und Fortschritt

- Ein Rezept ist reiner Inhalt und kann aus vier, fünf, sechs oder beliebig vielen Schritten bestehen.
- Jeff rendert die Arrays, ohne eine feste Schrittzahl vorauszusetzen.
- Der Kochfortschritt gehört nicht in das Rezept. Eine eigene `cooking_session` speichert erledigte Vorbereitungspunkte und Schritte anhand ihrer IDs.
- Dadurch kann dieselbe Rezeptstruktur später von einem Menschen oder einer KI geschrieben und auf mehreren Geräten konsistent weitergekocht werden.

## Vorratsregeln

- `exact`: verderbliche oder portionsrelevante Artikel wie Bananen, Eier, Fleisch, Gemüse, Käse, Reste und Tiefkühlportionen. Mengen in sinnvollen Einheiten; Gramm nur dort, wo sie praktisch helfen.
- `basic`: Gewürze, Öl, Essig, Mehl, Stärke, Reis, Pasta und Saucen. Nur `vorhanden`, `wenig` oder `leer`.
- Ein im Gespräch als leer gemeldeter Basic-Artikel wird auf `leer` gesetzt und in die aktuelle Einkaufsliste aufgenommen.
- Keine erzwungenen Verbrauchsdaten für haltbare Basics.

## Sicherheit

Der Coach handelt immer im Kontext des angemeldeten Nutzers. Geheime Schlüssel liegen ausschließlich in einer serverseitigen Funktion. Der Supabase Service-Role-Key und ein KI-Schlüssel dürfen nie an Jeffs Browsercode oder eine `PUBLIC_*`-Variable ausgegeben werden.

Ein Cloud-Chat erhält später nur über eine ausdrücklich eingerichtete, nutzergebundene Schnittstelle Zugriff. Bis diese Schnittstelle existiert, kann Claude die Jeff-Daten nicht selbstständig lesen oder schreiben; die vorliegenden Schemas definieren bereits exakt, welche Daten eine solche Anbindung austauschen darf.
