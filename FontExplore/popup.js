document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('font-list');
  const loading = document.getElementById('loading');

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id;
    chrome.tabs.sendMessage(tabId, { action: 'getFonts' }, (response) => {
      loading.style.display = 'none';

      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
        console.error(`Font Inspector Popup: Error sending message: ${errorMsg}`);
        container.innerHTML = `<p>Error: ${errorMsg}. <br>Try refreshing the tab or testing on a different page (e.g., https://example.com).</p>`;
        return;
      }

      if (!response) {
        console.error('Font Inspector Popup: No response from content script.');
        container.innerHTML = '<p>No response from page. Refresh and try again.</p>';
        return;
      }

      const { tagByFont, countsByFontAndTag } = response;

      // Get unique fonts, sorted alphabetically
      const uniqueFonts = Object.keys(tagByFont).sort();

      uniqueFonts.forEach((font) => {
        const tags = tagByFont[font].sort(); // Sorted tags for this font

        // Calculate total elements for this font
        let totalElements = 0;
        tags.forEach((tag) => {
          totalElements += (countsByFontAndTag[font]?.[tag] || 0);
        });

        // Create section
        const section = document.createElement('div');
        section.className = 'font-section';

        // Header (prominent font name)
        const header = document.createElement('div');
        header.className = 'font-header';
        header.innerHTML = `${font} <span>(${totalElements} elements)</span>`;
        header.addEventListener('click', () => {
          details.style.display = details.style.display === 'block' ? 'none' : 'block';
        });

        // Details
        const details = document.createElement('div');
        details.className = 'font-details';
        details.innerHTML = '<p>Used in tags:</p>';
        const badgesContainer = document.createElement('div');
        badgesContainer.className = 'tag-badges';

        tags.forEach((tag) => {
          const count = (countsByFontAndTag[font]?.[tag] || 0);
          if (count === 0) return; // Skip if no elements

          const badge = document.createElement('span');
          badge.className = 'tag-badge';
          badge.textContent = `<${tag}> (${count})`;
          badge.addEventListener('click', () => {
            chrome.tabs.sendMessage(tabId, { action: 'highlightFontAndTag', font, tag }, (highlightResponse) => {
              if (chrome.runtime.lastError) {
                const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
                console.error(`Font Inspector Popup: Highlight error: ${errorMsg}`);
                alert(`Highlight failed: ${errorMsg}. Try refreshing the tab.`);
              }
            });
          });
          badgesContainer.appendChild(badge);
        });

        details.appendChild(badgesContainer);
        section.appendChild(header);
        section.appendChild(details);
        container.appendChild(section);
      });

      if (uniqueFonts.length === 0) {
        container.innerHTML = '<p>No visible fonts detected.</p>';
      }
    });
  });
});