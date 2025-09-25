// Hide the editoria11y accessibility checker
const style = document.createElement('style');
style.innerHTML = `
  every-element-tip {
    display: none !important;
  }
`;
document.head.appendChild(style);

const bodyElement = document.body;
const bodyText = bodyElement.innerText;
const wordCount = bodyText.split(/\s+/).length;
const bodyClasses = Array.from(bodyElement.classList);
const bodyId = bodyElement.id;

// --- Link Analysis ---
const allLinks = document.getElementsByTagName('a');
const linkCount = allLinks.length;
const editLinks = [];
for (const link of allLinks) {
  const rawHref = link.getAttribute('href');
  if (typeof rawHref === 'string') {
    const isAbsolute = rawHref.startsWith('http://') || rawHref.startsWith('https://');
    if (isAbsolute && rawHref.includes('edit-')) {
      editLinks.push(rawHref);
    }
  }
}

// --- Page Size Calculation ---
const resourceEntries = performance.getEntriesByType("resource");
let totalSizeInBytes = resourceEntries.reduce((acc, resource) => acc + resource.transferSize, 0);
const navigation = performance.getEntriesByType("navigation")[0];
if (navigation) {
  totalSizeInBytes += navigation.transferSize;
}
const totalSizeMB = (totalSizeInBytes / (1024 * 1024)).toFixed(2);

// --- Load Time Calculation ---
let actualLoadTime = 0;
if (navigation) {
  actualLoadTime = (navigation.duration / 1000).toFixed(2);
}
const speeds = {
  'Slow 3G (400 Kbps)': (400 / 8) * 1024,
  'Fast 3G (1.6 Mbps)': (1600 / 8) * 1024,
  '4G (10 Mbps)': (10000 / 8) * 1024,
  'Fiber (100 Mbps)': (100000 / 8) * 1024,
};
const estimatedTimes = {};
for (const speedName in speeds) {
  const speedInBps = speeds[speedName];
  estimatedTimes[speedName] = (totalSizeInBytes / speedInBps).toFixed(2);
}

// --- Performance Metrics ---
let fcp = null;
let lcp = null;
let cls = 0;

const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
if (fcpEntry) {
  fcp = fcpEntry.startTime.toFixed(2);
}

const lcpEntry = performance.getEntriesByName('largest-contentful-paint')[0];
if (lcpEntry) {
  lcp = lcpEntry.startTime.toFixed(2);
}

// Calculate CLS (snapshot)
performance.getEntriesByType('layout-shift').forEach(entry => {
  if (!entry.hadRecentInput) { // Exclude shifts caused by user input
    cls += entry.value;
  }
});
cls = cls.toFixed(3);

// --- Image Stats Calculation ---
const allImageUrls = new Set();

// 1. Find all `<img>` tags
Array.from(document.getElementsByTagName('img')).forEach(img => {
    if (img.src) {
        allImageUrls.add(new URL(img.src, window.location.href).href);
    }
});

// 2. Find all CSS background images
const elements = document.querySelectorAll('*');
const urlRegex = /url\("?([^"]+)"?\)/g;

elements.forEach(el => {
    const style = window.getComputedStyle(el);
    if (style.backgroundImage && style.backgroundImage !== 'none') {
        let match;
        while ((match = urlRegex.exec(style.backgroundImage)) !== null) {
            allImageUrls.add(new URL(match[1], window.location.href).href);
        }
    }
});

const imageCount = allImageUrls.size;

const imageDetails = Array.from(allImageUrls).map(src => {
    const resource = resourceEntries.find(r => r.name === src);
    // Use transferSize for a more accurate representation of download impact
    return {
        src: src,
        size: resource ? resource.transferSize : 0
    };
}).filter(img => img.size > 0);

imageDetails.sort((a, b) => b.size - a.size);

const topImages = imageDetails.slice(0, 5).map(img => ({
    name: new URL(img.src).pathname.split('/').pop() || 'image',
    sizeMB: (img.size / (1024 * 1024)).toFixed(3),
    src: img.src
}));

// --- Theme Color Extraction ---
const themeColors = new Set();
// 1. Check for meta theme-color
const metaThemeColor = document.querySelector('meta[name="theme-color"]');
if (metaThemeColor) {
  themeColors.add(metaThemeColor.content);
}

// 2. Analyze styles of common elements
const colorCounts = {};
const elementsToScan = document.querySelectorAll('body, h1, h2, a, button, p, div, header, footer');

const rgbToHex = (rgb) => {
  if (!rgb || !rgb.startsWith('rgb')) return rgb;
  const result = rgb.match(/\d+/g).map(Number);
  return "#" + result.map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

elementsToScan.forEach(el => {
  const style = window.getComputedStyle(el);
  const colors = [style.backgroundColor, style.color, style.borderColor];
  colors.forEach(color => {
    if (color && color !== 'transparent' && !color.startsWith('rgba(0, 0, 0, 0)')) {
      const hexColor = rgbToHex(color).toLowerCase();
      // Filter out shades of white, black, and gray
      if (hexColor !== '#ffffff' && hexColor !== '#000000' && !/^#([0-9a-f])\1\1$/.test(hexColor.substring(0,4)) ) {
          colorCounts[hexColor] = (colorCounts[hexColor] || 0) + 1;
      }
    }
  });
});

const sortedColors = Object.keys(colorCounts).sort((a, b) => colorCounts[b] - colorCounts[a]);
sortedColors.slice(0, 5).forEach(color => themeColors.add(color));


// --- Delayed Service Detection & Message Sending ---
setTimeout(() => {
  const detectedServices = {};

  // Helper to add services and IDs neatly
  const addService = (name, id = null) => {
    if (!detectedServices[name]) {
      detectedServices[name] = { ids: new Set() };
    }
    if (id) {
      detectedServices[name].ids.add(id);
    }
  };

  // 1. Check for window variables (presence detection)
  if (window.dataLayer || window.google_tag_manager) addService('Google Tag Manager');
  if (window.ga || window.gtag || window._gaq) addService('Google Analytics');
  if (window._fbq) addService('Facebook Pixel');
  if (window.hj) addService('Hotjar');
  if (window._hsq) addService('HubSpot');

  // 2. Check script sources for IDs
  document.querySelectorAll('script[src]').forEach(script => {
    const src = script.src;
    try {
      const url = new URL(src);
      if (src.includes('googletagmanager.com/gtm.js')) {
        const id = url.searchParams.get('id');
        if (id) addService('Google Tag Manager', id);
      }
      if (src.includes('googletagmanager.com/gtag/js')) {
        const id = url.searchParams.get('id');
        if (id) addService('Google Analytics', id);
      }
    } catch (e) { /* Ignore invalid URLs */ }
  });

  // 3. Check GTM noscript tags for IDs
  document.querySelectorAll('noscript iframe[src*="googletagmanager.com/ns.html"]').forEach(iframe => {
    try {
        const url = new URL(iframe.src);
        const id = url.searchParams.get('id');
        if (id) addService('Google Tag Manager', id);
    } catch(e) { /* Ignore invalid URLs */ }
  });

  // 4. Check for Iframe-based Services
  const iframeServices = {
    'Fireside21 Form': /forms\.house\.gov/i,
    'IQ Form': /iqconnect\.house\.gov/i,
    'Google Form': /docs\.google\.com\/forms/i,
    'Airtable Form': /airtable\.com\/(embed|shr)/i,
    'Microsoft Form': /forms\.office\.com/i
  };
  document.querySelectorAll('iframe').forEach(iframe => {
    const src = iframe.src;
    if (!src) return;
    for (const name in iframeServices) {
      if (iframeServices[name].test(src)) {
        addService(name);
      }
    }
  });

  // 5. Drupal-specific check
  try {
    const drupalSettingsJSON = document.querySelector('script[data-drupal-selector="drupal-settings-json"]');
    if (drupalSettingsJSON) {
      const settings = JSON.parse(drupalSettingsJSON.textContent);
      if (settings.gtm && settings.gtm.tagIds) {
        settings.gtm.tagIds.forEach(id => addService('Google Tag Manager', id));
      }
      if (settings.gtag && settings.gtag.tagId) {
        addService('Google Analytics', settings.gtag.tagId);
      }
    }
  } catch (e) { /* Ignore parsing errors */ }

  // Convert Sets to Arrays for sending
  const finalServices = {};
  for (const name in detectedServices) {
    finalServices[name] = { ids: Array.from(detectedServices[name].ids) };
  }

  chrome.runtime.sendMessage({stats: {
    wordCount: wordCount,
    linkCount: linkCount,
    editLinks: editLinks,
    pageSize: totalSizeMB,
    actualLoadTime: actualLoadTime,
    estimatedTimes: estimatedTimes,
    imageCount: imageCount,
    topImages: topImages,
    themeColors: Array.from(themeColors),
    fcp: fcp,
    lcp: lcp,
    cls: cls,
    detectedServices: finalServices,
    bodyClasses: bodyClasses,
    bodyId: bodyId
  }});

}, 1000); // 1-second delay

// --- Listener for messages from the popup ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'highlightImage' && request.src) {
    const imageToHighlight = document.querySelector(`img[src="${request.src}"]`);
    if (imageToHighlight) {
      // Scroll to the image
      imageToHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Add a highlight style
      const highlightStyleId = 'gemini-highlight-style';
      if (!document.getElementById(highlightStyleId)) {
        const style = document.createElement('style');
        style.id = highlightStyleId;
        style.innerHTML = `
          .gemini-image-highlight {
            outline: 4px solid #FFA500 !important;
            box-shadow: 0 0 20px #FFA500 !important;
            transition: outline 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
          }
        `;
        document.head.appendChild(style);
      }
      
      imageToHighlight.classList.add('gemini-image-highlight');

      // Remove the highlight after a few seconds
      setTimeout(() => {
        imageToHighlight.classList.remove('gemini-image-highlight');
      }, 3000);
    }
  }
});