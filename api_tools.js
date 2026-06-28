function bgFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: "fetch", url, options }, (response) => {
                if (chrome.runtime.lastError) {
                    return reject(new Error(chrome.runtime.lastError.message));
                }
                if (!response) {
                    return reject(new Error("Aucune reponse du background script."));
                }
                if (response.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response.error));
                }
            });
        } else {
            fetch(url, options)
                .then(async res => {
                    const data = await res.json();
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return data;
                })
                .then(resolve)
                .catch(reject);
        }
    });
}
window.bgFetch = bgFetch;

function cleanWikipediaText(value) {
    return String(value || "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

async function searchWikipedia(query) {
    const safeQuery = cleanWikipediaText(query).slice(0, 140);
    if (!safeQuery) {
        return "Recherche Wikipedia ignoree: requete vide.";
    }

    try {
        const searchUrl = `https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(safeQuery)}&srlimit=3&utf8=&format=json&origin=*`;
        const searchData = await bgFetch(searchUrl);
        const results = searchData?.query?.search || [];

        if (results.length === 0) {
            return `Aucun resultat Wikipedia pour "${safeQuery}".`;
        }

        const pageIds = results.map((item) => item.pageid).join("|");
        const extractUrl = `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&pageids=${pageIds}&format=json&origin=*`;
        const extractData = await bgFetch(extractUrl);
        const pages = extractData?.query?.pages || {};

        const summaries = results.map((item) => {
            const page = pages[item.pageid] || {};
            const extract = cleanWikipediaText(page.extract || item.snippet).slice(0, 520);
            return `- ${item.title}: ${extract}`;
        });

        return [
            `Resultats Wikipedia pour "${safeQuery}" (source secondaire, a croiser avec une source officielle):`,
            ...summaries
        ].join("\n");
    } catch (error) {
        console.error("Erreur Wikipedia:", error);
        return "Erreur technique lors de la recherche Wikipedia. Ne pas inventer de source; utiliser NON VERIFIABLE si necessaire.";
    }
}

// Clé API Tavily locale (pour prototype)
const TAVILY_API_KEY = "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";

async function searchTavily(query) {
    const safeQuery = cleanWikipediaText(query).slice(0, 140);
    if (!safeQuery) {
        return "Recherche Tavily ignorée: requête vide.";
    }

    try {
        const data = await bgFetch("https://api.tavily.com/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                api_key: TAVILY_API_KEY,
                query: safeQuery,
                search_depth: "basic",
                include_answer: false,
                max_results: 3
            })
        });

        const results = data.results || [];

        if (results.length === 0) {
            return `Aucun résultat d'actualité Tavily pour "${safeQuery}".`;
        }

        const summaries = results.map(item => `- ${item.title}: ${item.content}`);

        return [
            `Résultats d'actualité en temps réel (Tavily) pour "${safeQuery}":`,
            ...summaries
        ].join("\n");
    } catch (error) {
        console.error("Erreur Tavily:", error);
        return "Erreur technique lors de la recherche internet Tavily.";
    }
}

window.searchWikipedia = searchWikipedia;
window.searchTavily = searchTavily;
