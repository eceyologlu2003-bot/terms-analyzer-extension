document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveKeyBtn = document.getElementById('saveKeyBtn');
  const saveStatus = document.getElementById('saveStatus');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const loadingDiv = document.getElementById('loading');
  const resultsDiv = document.getElementById('results');
  const errorBox = document.getElementById('errorBox');
  const riskScoreSpan = document.getElementById('riskScore');
  const clausesList = document.getElementById('clausesList');

  // API Anahtarını yükle
  chrome.storage.local.get(['apiKey'], function(result) {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
  });

  // API Anahtarını kaydet
  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    chrome.storage.local.set({ apiKey: key }, () => {
      saveStatus.textContent = " Kaydedildi!";
      setTimeout(() => { saveStatus.textContent = ""; }, 2000);
    });
  });

  // Analizi Başlat
  analyzeBtn.addEventListener('click', async () => {
    errorBox.classList.add('hidden');
    resultsDiv.classList.add('hidden');
    
    // API anahtarı kontrolü
    const key = apiKeyInput.value.trim();
    if (!key) {
      showError("Lütfen önce API anahtarınızı girin ve kaydedin.");
      return;
    }

    loadingDiv.classList.remove('hidden');
    analyzeBtn.disabled = true;

    try {
      // 1. Aktif sekmeyi bul
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error("Aktif sekme bulunamadı.");

      // 2. Content script'i inject et (eğer henüz çalışmadıysa) ve metni al
      // V3'te scripting API ile inject edebiliriz veya message gönderebiliriz.
      // Eklentiler bazen sayfa yenilenmeden content script'i yüklemez, bu yüzden inject etmek daha güvenlidir.
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content/content.js']
        });
      } catch (e) {
        // Zaten yüklüyse veya sayfaya erişilemiyorsa (chrome:// sayfaları vb)
        console.warn("Script injection uyarısı:", e);
      }

      // 3. Sayfa metnini iste
      chrome.tabs.sendMessage(tab.id, { action: "GET_PAGE_TEXT" }, (response) => {
        if (chrome.runtime.lastError) {
          loadingDiv.classList.add('hidden');
          analyzeBtn.disabled = false;
          showError("Sayfa içeriği okunamadı. Bu sayfa uzantıların çalışmasına izin vermiyor olabilir (ör. chrome:// sayfaları). Lütfen sayfayı yenileyip tekrar deneyin.");
          return;
        }

        if (!response || !response.text) {
          loadingDiv.classList.add('hidden');
          analyzeBtn.disabled = false;
          showError("Sayfadan metin alınamadı.");
          return;
        }

        // 4. Background script'e analiz için gönder
        chrome.runtime.sendMessage({ 
          action: "ANALYZE_TERMS", 
          sourceText: response.text 
        }, (analyzeRes) => {
          loadingDiv.classList.add('hidden');
          analyzeBtn.disabled = false;

          if (chrome.runtime.lastError) {
             showError("Arka plan servisi hatası: " + chrome.runtime.lastError.message);
             return;
          }

          if (analyzeRes.error || !analyzeRes.success) {
            showError("Analiz başarısız: " + (analyzeRes.error || "Bilinmeyen hata"));
            return;
          }

          // 5. Sonuçları göster
          renderResults(analyzeRes.data);
        });
      });
      
    } catch (err) {
      loadingDiv.classList.add('hidden');
      analyzeBtn.disabled = false;
      showError(err.message);
    }
  });

  function renderResults(data) {
    resultsDiv.classList.remove('hidden');
    riskScoreSpan.textContent = data.risk_skoru || "-";
    clausesList.innerHTML = '';

    if (!data.riskli_maddeler || data.riskli_maddeler.length === 0) {
      clausesList.innerHTML = `
        <div class="clause-item">
          <p>Riskli madde bulunamadı veya emin olunamadı.</p>
          <div class="uncertain-clause">Belirsiz madde / Doğrulanamadı</div>
        </div>`;
      return;
    }

    data.riskli_maddeler.forEach(madde => {
      const item = document.createElement('div');
      item.className = 'clause-item';
      
      const original = document.createElement('div');
      original.className = 'clause-original';
      original.textContent = `"${madde.orijinal_alinti}"`;
      
      const explanation = document.createElement('div');
      explanation.className = 'clause-explanation';
      explanation.textContent = madde.sade_turkce_aciklama;
      
      item.appendChild(original);
      item.appendChild(explanation);
      
      // Halüsinasyon veya belirsiz senaryoları için ek gösterge
      if (!madde.orijinal_alinti || madde.orijinal_alinti.length < 5) {
         const uncertain = document.createElement('div');
         uncertain.className = 'uncertain-clause';
         uncertain.textContent = "Belirsiz madde / Doğrulanamadı";
         item.appendChild(uncertain);
      }

      clausesList.appendChild(item);
    });
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  }
});
