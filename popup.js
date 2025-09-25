function renderStats(stats) {
  const statsContainer = document.getElementById('stats');
  statsContainer.innerHTML = ''; // Clear previous stats

  // Helper to create a section
  function createSection(title, content) {
    if (!content) return;
    const section = document.createElement('div');
    section.className = 'stats-section';
    section.innerHTML = `<h2>${title}</h2><div class="content">${content}</div>`;
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

  

  // Theme Colors
  if (stats.themeColors && stats.themeColors.length > 0) {
    let colorsContent = '<ul>';
    stats.themeColors.forEach(color => {
      colorsContent += `<li><span class="color-swatch" style="background-color:${color};"></span> ${color}</li>`;
    });
    colorsContent += '</ul>';
    createSection('Theme Colors', colorsContent);
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
    createSection('Largest Images', imagesContent);
  }

  // Estimated Load Times
  if (stats.estimatedTimes) {
    let loadTimesContent = '<ul>';
    for (const speedName in stats.estimatedTimes) {
      loadTimesContent += `<li><strong>${speedName}:</strong> ${stats.estimatedTimes[speedName]} s</li>`;
    }
    loadTimesContent += '</ul>';
    createSection('Est. Load Times', loadTimesContent);
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
    createSection('Detected Services', servicesContent);
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
  const activeTab = tabs[0];
  if (!activeTab) return;

  // Add event listener for the reload button
  document.getElementById('reload-button').addEventListener('click', () => {
    chrome.tabs.reload(activeTab.id, { bypassCache: true });
    window.close(); // Close the popup
  });

  // Try to get stats from session storage first
  chrome.storage.session.get(activeTab.id.toString(), (result) => {
    if (result[activeTab.id.toString()]) {
      // Stats found in storage, render them
      renderStats(result[activeTab.id.toString()]);
    } else {
      // No stats in storage, execute content script to get them
      document.getElementById('stats').innerHTML = '<p>Loading stats...</p>';
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js']
      });
    }
  });
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
document.getElementById('stats').addEventListener('click', (event) => {
  const target = event.target.closest('.clickable-image');
  if (target && target.dataset.src) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'highlightImage', src: target.dataset.src });
      window.close(); // Close the popup immediately
    });
  }
});
