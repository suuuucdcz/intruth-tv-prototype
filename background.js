chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetch") {
        fetch(request.url, request.options)
            .then(async response => {
                const isJson = response.headers.get("content-type")?.includes("application/json");
                const data = isJson ? await response.json() : await response.text();
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
                }
                
                return data;
            })
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        
        // Return true to indicate that sendResponse will be called asynchronously
        return true; 
    }
});
