// Clear stats from storage when a tab is updated to a new page
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.storage.session.remove(tabId.toString());
  }
});
