(function() { // IIFE to scope variables and prevent re-declaration errors

  // Function to collect font data by traversing the DOM
  function collectFonts() {
    const tagByFont = new Map(); // font -> Set of tags
    const countsByFontAndTag = new Map(); // font -> tag -> count (for serialization)

    // Traverse all elements
    const allElements = document.querySelectorAll('*');
    allElements.forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'style') {
        return; // Skip <style> tags entirely (internal, not user-visible)
      }

      const computedStyle = window.getComputedStyle(el);
      if (
        computedStyle.display === 'none' ||
        computedStyle.visibility === 'hidden' ||
        el.offsetWidth <= 0 ||
        el.offsetHeight <= 0
      ) {
        return; // Skip invisible elements
      }

      // Check for direct text content (immediate text nodes with trimmed content)
      const hasDirectText = Array.from(el.childNodes).some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== ''
      );
      if (!hasDirectText) {
        return; // Skip elements without direct text
      }

      const fontFamily = computedStyle.fontFamily.trim();
      if (fontFamily) {
        // Split the font stack and find the first actual (loaded) font
        const fontStack = fontFamily.split(',').map((f) => f.trim().replace(/['"]/g, ''));
        let actualFont = null;
        for (const font of fontStack) {
          if (document.fonts.check(`16px ${font}`, 'abcdefghijklmnopqrstuvwxyz')) {
            actualFont = font;
            break;
          }
        }
        if (!actualFont) return; // Skip if no loaded font found

        // Categorize by font
        if (!tagByFont.has(actualFont)) {
          tagByFont.set(actualFont, new Set());
        }
        tagByFont.get(actualFont).add(tag);

        // Track counts (no need for full elements here)
        if (!countsByFontAndTag.has(actualFont)) {
          countsByFontAndTag.set(actualFont, new Map());
        }
        if (!countsByFontAndTag.get(actualFont).has(tag)) {
          countsByFontAndTag.get(actualFont).set(tag, 0);
        }
        const currentCount = countsByFontAndTag.get(actualFont).get(tag);
        countsByFontAndTag.get(actualFont).set(tag, currentCount + 1);
      }
    });

    // Serialize for messaging
    const serializedTagByFont = {};
    tagByFont.forEach((tags, font) => {
      serializedTagByFont[font] = Array.from(tags);
    });

    const serializedCountsByFontAndTag = {};
    countsByFontAndTag.forEach((tagMap, font) => {
      serializedCountsByFontAndTag[font] = {};
      tagMap.forEach((count, tag) => {
        serializedCountsByFontAndTag[font][tag] = count;
      });
    });

    return { tagByFont: serializedTagByFont, countsByFontAndTag: serializedCountsByFontAndTag };
  }

  // Function to highlight elements and scroll to first
  const highlightClass = 'font-inspector-highlight';
  function highlightElements(elements) {
    // Remove existing highlights
    document.querySelectorAll(`.${highlightClass}`).forEach((el) => {
      el.classList.remove(highlightClass);
    });

    // Add new highlights
    elements.forEach((el) => {
      el.classList.add(highlightClass);
    });

    // Scroll to first element with a tiny delay to ensure highlight applies
    setTimeout(() => {
      elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  // Helper to get actual font from computed style
  function getActualFont(el) {
    const computedStyle = window.getComputedStyle(el);
    const fontFamily = computedStyle.fontFamily.trim();
    const fontStack = fontFamily.split(',').map((f) => f.trim().replace(/['"]/g, ''));
    for (const font of fontStack) {
      if (document.fonts.check(`16px ${font}`, 'abcdefghijklmnopqrstuvwxyz')) {
        return font;
      }
    }
    return null;
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getFonts') {
      sendResponse(collectFonts());
    } else if (request.action === 'highlightFontAndTag') {
      const selectedFont = request.font;
      const selectedTag = request.tag.toLowerCase();
      const elementsToHighlight = []; // Explicit highlight list

      if (selectedTag === 'html' || selectedTag === 'body') {
        // Special handling for root tags: Collect visible elements with direct text, non-overridden font
        document.querySelectorAll('*').forEach((el) => {
          if (el.tagName.toLowerCase() === 'style') {
            return; // Skip <style> tags
          }
          const computedStyle = window.getComputedStyle(el);
          const hasDirectText = Array.from(el.childNodes).some(
            (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== ''
          );
          if (
            hasDirectText &&
            computedStyle.display !== 'none' &&
            computedStyle.visibility !== 'hidden' &&
            el.offsetWidth > 0 &&
            el.offsetHeight > 0
          ) {
            const actualFont = getActualFont(el);
            if (
              actualFont === selectedFont &&
              (!el.style.fontFamily || el.style.fontFamily.trim() === '') // No local override
            ) {
              elementsToHighlight.push(el);
            }
          }
        });
      } else {
        // Standard handling: Collect only elements of the selected tag with direct text, visible, and matching font
        document.querySelectorAll(selectedTag).forEach((el) => {
          if (el.tagName.toLowerCase() === 'style') {
            return; // Skip <style> tags
          }
          const computedStyle = window.getComputedStyle(el);
          const hasDirectText = Array.from(el.childNodes).some(
            (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== ''
          );
          if (
            hasDirectText &&
            computedStyle.display !== 'none' &&
            computedStyle.visibility !== 'hidden' &&
            el.offsetWidth > 0 &&
            el.offsetHeight > 0
          ) {
            const actualFont = getActualFont(el);
            if (actualFont === selectedFont) {
              elementsToHighlight.push(el);
            }
          }
        });
      }

      highlightElements(elementsToHighlight);
      sendResponse({ success: true });
    }
    return true; // Keep port open for async
  });

  // Define the highlight style (injected into the page)
  const style = document.createElement('style');
  style.textContent = `
    .${highlightClass} {
      outline: 2px solid red !important;
      background-color: rgba(255, 0, 0, 0.2) !important;
      box-shadow: 0 0 10px red !important;
      animation: font-inspector-pulse 1s ease-in-out 2 !important;
      transition: outline 0.5s ease, box-shadow 0.5s ease;
    }
    @keyframes font-inspector-pulse {
      0% { box-shadow: 0 0 0 red; }
      50% { box-shadow: 0 0 15px red; }
      100% { box-shadow: 0 0 10px red; }
    }
  `;
  document.head.appendChild(style);
})();