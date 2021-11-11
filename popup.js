multireddit.addEventListener("change", ev => {
    chrome.storage.sync.set({ "multiredditUrl": ev.target.value });
});

chrome.storage.sync.get("multiredditUrl").then(data => {
    multireddit.value = data.multiredditUrl;
});