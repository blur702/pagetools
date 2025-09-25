function renderStats(stats) {
  const statsContainer = document.getElementById('stats');
  statsContainer.innerHTML = ''; // Clear previous stats

  // Helper to create a section
  function createSection(title, content, collapsible = false) {
    if (!content) return;
    const section = document.createElement('div');
    section.className = 'stats-section';

    if (collapsible) {
      section.innerHTML = `
        <details>
          <summary><h2>${title}</h2></summary>
          <div class="content">${content}</div>
        </details>
      `;
    } else {
      section.innerHTML = `<h2>${title}</h2><div class="content">${content}</div>`;
    }
    statsContainer.appendChild(section);
  }

  // General Stats
  let generalContent = `
    <p><strong>Words:</strong> ${stats.wordCount}</p>
    <p><strong>Links:</strong> ${stats.linkCount}</p>
    <p><strong>Images:</strong> ${stats.imageCount}</p>
    <p><strong>Page Size:</strong> ${stats.pageSize} MB</p>
    <p><strong>Load Time:</strong> ${stats.actualLoadTime} s</p>
  `;
  createSection('General', generalContent);

  // Body Classes and ID
  if (stats.bodyId || (stats.bodyClasses && stats.bodyClasses.length > 0)) {
    let bodyContent = '';
    if (stats.bodyId) {
      bodyContent += `<p><strong>ID:</strong> ${stats.bodyId}</p>`;
    }
    if (stats.bodyClasses && stats.bodyClasses.length > 0) {
      bodyContent += `<strong>Classes:</strong><ul>`;
      stats.bodyClasses.forEach(cls => {
        bodyContent += `<li>${cls}</li>`;
      });
      bodyContent += '</ul>';
    }
    createSection('Body Tag', bodyContent, true);
  }

  // Theme Colors
  if (stats.themeColors && stats.themeColors.length > 0) {
    let colorsContent = '<ul>';
    stats.themeColors.forEach(color => {
      colorsContent += `<li><span class="color-swatch" style="background-color:${color};"></span> ${color}</li>`;
    });
    colorsContent += '</ul>';
    createSection('Theme Colors', colorsContent, true);
  }
  
  // Edit Links
  if (stats.editLinks && stats.editLinks.length > 0) {
    let editLinksContent = '<ul>';
    stats.editLinks.forEach(link => {
      editLinksContent += `<li>${link}</li>`;
    });
    editLinksContent += '</ul>';
    createSection(`"edit-" Links (${stats.editLinks.length})`, editLinksContent);
  }

  // Largest Images
  if (stats.topImages && stats.topImages.length > 0) {
    let imagesContent = '<ul>';
    stats.topImages.forEach(img => {
      if (parseFloat(img.sizeMB) > 0) {
        imagesContent += `<li class="clickable-image" data-src="${img.src}">${img.name} (${img.sizeMB} MB) <a href="${img.src}" target="_blank" class="open-image-icon" title="Open image in new tab">&#x2197;</a></li>`;
      }
    });
    imagesContent += '</ul>';
    createSection('Largest Images', imagesContent, true);
  }

  // Estimated Load Times
  if (stats.estimatedTimes) {
    let loadTimesContent = '<ul>';
    for (const speedName in stats.estimatedTimes) {
      loadTimesContent += `<li><strong>${speedName}:</strong> ${stats.estimatedTimes[speedName]} s</li>`;
    }
    loadTimesContent += '</ul>';
    createSection('Est. Load Times', loadTimesContent, true);
  }

  // Detected Services
  const serviceNames = Object.keys(stats.detectedServices || {});
  if (serviceNames.length > 0) {
    let servicesContent = '<ul>';
    serviceNames.sort().forEach(name => {
      servicesContent += `<li><strong>${name}</strong>`;
      const service = stats.detectedServices[name];
      if (service.ids && service.ids.length > 0) {
        servicesContent += '<ul>';
        service.ids.forEach(id => {
          servicesContent += `<li>${id}</li>`;
        });
        servicesContent += '</ul>';
      }
      servicesContent += '</li>';
    });
    servicesContent += '</ul>';
    createSection('Detected Services', servicesContent, true);
  }
}

// Function to get current active tab
function getCurrentActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      resolve(tabs[0]);
    });
  });
}

// Function to load stats for a specific tab
async function loadStatsForTab(tabId) {
  if (!tabId) return;

  // Add event listener for the reload button
  document.getElementById('reload-button').addEventListener('click', async () => {
    const currentTab = await getCurrentActiveTab();
    if (currentTab) {
        chrome.tabs.reload(currentTab.id, { bypassCache: true });
    }
  });

  const tab = await new Promise(resolve => chrome.tabs.get(tabId, resolve));

  // Do not run on chrome:// or edge:// pages
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
    document.getElementById('stats').innerHTML = '<p>Statistics are not available for this page.</p>';
    return;
  }

  // Try to get stats from session storage first
  chrome.storage.session.get(tabId.toString(), (result) => {
    if (result[tabId.toString()]) {
      // Stats found in storage, render them
      renderStats(result[tabId.toString()]);
    } else {
      // No stats in storage, execute content script to get them
      document.getElementById('stats').innerHTML = '<p>Loading stats...</p>';
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
    }
  });
}

// Initialize sidebar
async function initializeSidebar() {
  const activeTab = await getCurrentActiveTab();
  if (activeTab) {
    await loadStatsForTab(activeTab.id);
  }
}

// Listen for tab changes and update sidebar accordingly
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await loadStatsForTab(activeInfo.tabId);
});

// Listen for tab updates (page navigation)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const activeTab = await getCurrentActiveTab();
    if (activeTab && activeTab.id === tabId) {
      await loadStatsForTab(tabId);
    }
  }
});

// Listen for stats from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.stats && sender.tab) {
    // Render the stats and save them to session storage
    renderStats(request.stats);
    chrome.storage.session.set({ [sender.tab.id.toString()]: request.stats });
  }
});

// Event delegation for clickable images
document.getElementById('stats').addEventListener('click', async (event) => {
  const target = event.target.closest('.clickable-image');
  if (target && target.dataset.src) {
    const currentTab = await getCurrentActiveTab();
    chrome.tabs.sendMessage(currentTab.id, { action: 'highlightImage', src: target.dataset.src });
    // Don't close sidebar - keep it open for continued use
  }
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeSidebar);