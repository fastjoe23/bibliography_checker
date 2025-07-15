// pdf.js global initialisieren
pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.js';

// Verbesserter Prompt als Template-String (kannst du leicht editieren)
const REFERENCE_EXTRACTION_PROMPT = `
You are an expert in extracting literature sources from texts.  
From the following text, you extract all references (books, articles, websites, papers, etc.) as a JSON list with the following fields:

- title (title of the source)
- authors (list of authors, if available)
- year (year of publication, if available)
- url (link to the source, if available, please always enter or generate a plausible URL)
- publisher (publisher or institution, if available)

If some information is missing, simply leave these fields blank (instead of empty or zero). Don't add any additional fields like urls or metadata.

Please output the result as a pure JSON array, without any other text or explanations. 
Please **only** return a valid JSON string, with no verbiage, no Markdown formatting, no introduction. The JSON should start directly!
Example output:
[
  {
    "title": "Deep Learning",
    "authors": ["Ian Goodfellow", "Yoshua Bengio", "Aaron Courville"],
    "year": 2016,
    "url": "https://www.deeplearningbook.org",
    "publisher": "MIT Press"
  },
  {
    "title": "Einführung in die Versicherungswirtschaft",
    "authors": ["Max Mustermann"],
    "year": 2020
  }
]

This is the text from which you should extract the references:
'''
<<BIBLIOGRAPHYTEXT>>
'''
`;

let userApiKey = '';

function saveApiKey() {
  const input = document.getElementById('apiKey');
  userApiKey = input.value.trim();
  if (userApiKey.startsWith('sk-')) {
    console.log('API-Key gespeichert.');
    // Optional: im SessionStorage ablegen
    sessionStorage.setItem('openrouterApiKey', userApiKey);
  } else {
    alert('Bitte gültigen API-Key eingeben.');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const storedKey = sessionStorage.getItem('openrouterApiKey');
  if (storedKey) {
    userApiKey = storedKey;
    document.getElementById('apiKey').value = storedKey;
  }
});


//PDF-Upload-Event-Listener startet die ganze Verarbeitung
document.getElementById('pdf-upload').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('status').textContent = 'PDF wird gelesen...';
    // PDF lesen und Text extrahieren
    const text = await extractTextFromPDF(file);

    // Text an LLM senden und Referenzen extrahieren
    document.getElementById('status').textContent = 'Text wird analysiert...(kann etwas länger dauern)';

    const refs = await extractReferencesWithLLM(text);

    // Extraktierte Referenzen anzeigen
    
    renderResultsTable(refs);
    
    // Extraktierte Referenzen ueberpruefen
    document.getElementById('status').textContent = 'Referenzen werden geprüft...';
    checkStatusOfReferences(refs);

    // JSON Rohdaten-Ausgabe 
    const rawJsonContainer = document.getElementById('jsonBlock');
    rawJsonContainer.textContent = JSON.stringify(refs, null, 2);
    rawJsonContainer.style.display = refs.length > 0 ? 'block' : 'none';

    document.getElementById('status').textContent = 'Fertig.';
});

async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map(item => item.str);
        text += strings.join(' ') + '\n';
    }
    return text;
}

async function extractReferencesWithLLM(pdfText) {
    // Prompt mit eingefügtem Text
    const prompt = REFERENCE_EXTRACTION_PROMPT.replace('<<BIBLIOGRAPHYTEXT>>', pdfText.slice(0, 12000));

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${userApiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "mistralai/mistral-small-3.2-24b-instruct:free",
            messages: [
                { role: "user", content: prompt }
            ]
        })
    });

    const data = await response.json();
    const message = await data.choices[0].message.content;
    try {
        return extractJsonFromResponse(message);
    } catch (e) {
        alert("Fehler bei der Antwort des LLM.");
        return [];
    }
}

function extractJsonFromResponse(content) {
    // Entferne Markdown-Wrapper wie ```json ... ```
    const cleaned = content
        .replace(/```json\n?/i, '')  // Anfang: ```json oder ```json\n
        .replace(/```$/, '')         // Ende: ```
        .trim();

    try {
        return JSON.parse(cleaned);
    } catch (e) {
        console.error("Fehler beim Parsen von JSON:", e);
        return null;
    }
}


function renderResultsTable(refs) {
  const tbody = document.getElementById('results-body');
  tbody.innerHTML = '';

  refs.forEach((ref, index) => {
    const row = document.createElement('tr');
    row.setAttribute('data-index', index);  // Index speichern für späteres Update

    const statusCell = document.createElement('td');
    statusCell.textContent = '?'; // Platzhalter, Status kommt später
    row.appendChild(statusCell);

    const titleCell = document.createElement('td');
    titleCell.textContent = ref.title || '';
    row.appendChild(titleCell);

    const authorCell = document.createElement('td');
    authorCell.textContent = Array.isArray(ref.authors) ? ref.authors.join(', ') : '';
    row.appendChild(authorCell);

    const yearCell = document.createElement('td');
    yearCell.textContent = ref.year || '';
    row.appendChild(yearCell);

    const publisherCell = document.createElement('td');
    publisherCell.textContent = ref.publisher || '';
    row.appendChild(publisherCell);

    const linkCell = document.createElement('td');
    if (ref.doi) {
      const a = document.createElement('a');
      a.href = `https://doi.org/${ref.doi}`;
      a.textContent = ref.doi;
      a.target = "_blank";
      linkCell.appendChild(a);
    } else if (ref.url) {
      const a = document.createElement('a');
      a.href = ref.url;
      a.textContent = ref.url;
      a.target = "_blank";
      linkCell.appendChild(a);
    }
    row.appendChild(linkCell);

    tbody.appendChild(row);
  });
}

// Hilfsfunktion, um Statuszelle der Zeile zu aktualisieren
function updateStatusCell(index, status) {
  const tbody = document.getElementById('results-body');
  const row = tbody.querySelector(`tr[data-index="${index}"]`);
  if (!row) return;
  const statusCell = row.querySelector('td:first-child');
  statusCell.textContent = status;
  statusCell.className = status === 'OK' ? 'ok' : status === 'NOK' ? 'nok' : 'not-checked';
}

async function checkStatusOfReferences(refs) {
    async function checkDOIWithCrossref(doi) {
        const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
        try {
            const res = await fetch(url);
            return res.ok; // true wenn DOI existiert, false wenn 404
        } catch {
            return false;
        }
    }

    async function checkLink(url) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            await fetch(url, { method: 'GET', mode: 'no-cors', signal: controller.signal });

            clearTimeout(timeoutId);
            return true; // kein Fehler → Seite erreichbar
        } catch {
            return false;
        }
    }

    async function searchGoogleBooks(ref) {
        const title = encodeURIComponent(ref.title || '');
        const author = encodeURIComponent((ref.author || '').toString());
        const query = `${title}+inauthor:${author}`;

        const url = `https://www.googleapis.com/books/v1/volumes?q=${query}`;
        try {
            const res = await fetch(url);
            if (!res.ok) return false;

            const data = await res.json();
            return data?.totalItems > 0;
        } catch {
            return false;
        }
    }

    async function searchCrossref(ref) {
        const author = encodeURIComponent(ref.author || '');
        const title = encodeURIComponent(ref.title || '');
        const year = ref.year || '';
        const yearFilter = year ? `&filter=from-pub-date:${year},until-pub-date:${year}` : '';

        const url = `https://api.crossref.org/works?query.author=${author}&query.bibliographic=${title}${yearFilter}`;
        try {
            const res = await fetch(url);
            if (!res.ok) return false;

            const data = await res.json();
            return data?.message?.items?.length > 0;
        } catch {
            return false;
        }
    }

    async function searchOpenAlex(ref) {
        const title = encodeURIComponent(ref.title || '');
        const author = encodeURIComponent(ref.author || '');
        const query = `${title} ${author}`;
        const url = `https://api.openalex.org/works?search=${query}`;

        try {
            const res = await fetch(url);
            if (!res.ok) return false;

            const data = await res.json();
            return data?.results?.length > 0;
        } catch {
            return false;
        }
    }

    refs.forEach(async (ref, i) => {
        let status = 'NOT_CHECKED';

        if (ref.doi) {
            // DOI prüfen
            status = (await checkDOIWithCrossref(ref.doi)) ? 'OK' : 'NOK';
        } else if (ref.url) {
            status = (await checkLink(ref.url)) ? 'OK' : 'NOK';
        } else {
            // Kein DOI, keine URL: Metadaten-Suche
            const foundInBooks = await searchGoogleBooks(ref);
            if (foundInBooks) {
                status = 'LIKELY_FOUND_GOOGLE_BOOKS';
            } else {
                const foundInCrossref = await searchCrossref(ref);
                if (foundInCrossref) {
                    status = 'LIKELY_FOUND_CROSSREF';
                } else {
                    const foundInOpenAlex = await searchOpenAlex(ref);
                    status = foundInOpenAlex ? 'LIKELY_FOUND_OPENALEX' : 'NOT_FOUND';
                }
            }
        }

        updateStatusCell(i, status);
    });
}
