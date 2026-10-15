/**
 * Alibaba Page-Agent (github.com/alibaba/page-agent) prensibiyle DOM İşlemleri:
 * Ekran görüntüsü (vision) yerine DOM'u metin olarak yapılandırıp token tasarruflu
 * ve deterministik şekilde okur.
 */

function extractPageText() {
  // Sayfadaki gereksiz gürültü elemanlarını (script, style, nav, footer, reklam vb.) temizle
  const clone = document.body.cloneNode(true);
  
  const removeSelectors = [
    'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
    'nav', 'footer', 'header', '.ad', '#cookie-banner', '.cookie-consent',
    '[role="navigation"]', '[aria-hidden="true"]'
  ];
  
  removeSelectors.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  });

  // Metni yapılandırılmış ve temizlenmiş olarak çıkart
  let text = clone.innerText || clone.textContent || '';
  text = text.replace(/\r\n|\r/g, '\n');
  text = text.replace(/\t/g, ' ');
  text = text.replace(/ +/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n\n').trim();
  
  return text;
}

// Orijinal alıntıyı sayfa içinde bulup vurgulama (Highlight) yeteneği
function highlightClauseInPage(quoteText) {
  if (!quoteText || quoteText.length < 5) return false;
  
  // Basit tarayıcı içi arama ve odaklama
  if (window.find && window.find(quoteText)) {
    return true;
  }
  return false;
}

// Eklenti Popup'ından veya background'dan gelen istekleri dinle
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_PAGE_TEXT") {
    const text = extractPageText();
    sendResponse({ text: text });
  } else if (request.action === "HIGHLIGHT_CLAUSE") {
    const success = highlightClauseInPage(request.quote);
    sendResponse({ success });
  }
  return true;
});
