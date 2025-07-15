# Literaturverzeichnis-Checker

Dieser Prototyp ermöglicht das Extrahieren und Prüfen von Literaturverzeichnissen aus PDF-Dokumenten direkt im Browser. Er ist quick and dirty zusammengeschustert und kann falsche Ergebnisse liefern.

---

## Funktionsweise

1. **PDF-Text Extraktion:**  
   Mittels [pdf.js](https://mozilla.github.io/pdf.js/) wird der Text aus dem PDF im Browser extrahiert.

2. **Referenzen erkennen:**  
   Der extrahierte Text wird an ein Language Model (Mistral 3.2, instruct) über die [OpenRouter API](https://openrouter.ai/) gesendet, das daraus strukturierte JSON-Daten mit den Literaturverweisen erzeugt.

3. **Quellenprüfung:**  
   Jede Referenz wird automatisiert überprüft:  
   - Falls eine DOI vorhanden ist, wird deren Erreichbarkeit getestet.  
   - Falls eine URL vorhanden ist, wird diese geprüft.  
   - Andernfalls wird nacheinander über die APIs von Google Books, Crossref und OpenAlex versucht, die Quelle anhand von Autor, Titel und Jahr zu verifizieren.

4. **Ergebnisanzeige:**  
   Die Referenzen und ihre Prüfstatus werden tabellarisch dargestellt und fortlaufend aktualisiert.

---

## Nutzung

- Trage deinen OpenRouter API-Key im Eingabefeld ein (wird lokal im Browser gespeichert).  
- Lade eine PDF-Datei mit einem Literaturverzeichnis hoch.  
- Warte, bis die Extraktion und Prüfung abgeschlossen sind.

---

## Hinweise

- Der API-Key bleibt nur lokal im Browser gespeichert und wird nur zum Call von OpenRouter verwendet. 
- Die Quellprüfung ist auf öffentlich zugängliche Informationen beschränkt.  
- Diese Anwendung ist ein Prototyp und dient zur Demonstration von Referenz-Checks im Browser.

---

## Dateien im Repository

- `index.html`: Hauptseite  
- `style.css`: Styling  
- `script.js`: JavaScript-Logik  
- `libs/pdf.js`: PDF-Parsing-Bibliothek


