// cypress/e2e/popup.cy.js

describe('Terms Analyzer Extension UI Tests', () => {

  beforeEach(() => {
    // Eklenti sayfalarının chrome.* API'lerini mocklayarak doğrudan tarayıcıda test edilebilir hale getiriyoruz.
    cy.visit('src/popup/popup.html', {
      onBeforeLoad(win) {
        win.chrome = {
          storage: {
            local: {
              get: cy.stub().callsFake((keys, cb) => cb({ apiKey: 'fake_api_key' })),
              set: cy.stub().callsFake((data, cb) => cb())
            }
          },
          tabs: {
            query: cy.stub().resolves([{ id: 1 }]),
            sendMessage: cy.stub() // Test senaryosuna göre aşağıda mocklanacak
          },
          scripting: {
            executeScript: cy.stub().resolves()
          },
          runtime: {
            sendMessage: cy.stub() // Test senaryosuna göre aşağıda mocklanacak
          }
        };
      }
    });
  });

  it('Mutlu Yol: Başarılı analiz ve riskli maddelerin gösterimi', () => {
    cy.window().then((win) => {
      // Content script'ten başarılı metin dönmesini simüle et
      win.chrome.tabs.sendMessage.callsFake((tabId, msg, cb) => {
        cb({ text: "Kullanıcı verilerinizi üçüncü taraf reklam şirketlerine satma hakkımızı saklı tutarız." });
      });

      // Background script'ten başarılı LLM sonucu dönmesini simüle et
      win.chrome.runtime.sendMessage.callsFake((msg, cb) => {
        cb({
          success: true,
          data: {
            risk_skoru: 8,
            riskli_maddeler: [
              {
                orijinal_alinti: "Kullanıcı verilerinizi üçüncü taraf reklam şirketlerine satma hakkımızı saklı tutarız.",
                sade_turkce_aciklama: "Verileriniz izniniz ve bildirim olmaksızın reklam şirketlerine satılabilir."
              }
            ]
          }
        });
      });
    });

    // Zorunlu hukuki uyarı var mı kontrol et
    cy.contains('DİKKAT: Bu uygulama hukuki tavsiye vermez.').should('be.visible');
    cy.wait(1500);

    // Analizi başlat
    cy.get('#analyzeBtn').click();
    cy.wait(1000);

    // Sonuçların geldiğini doğrula
    cy.get('#results').should('not.have.class', 'hidden');
    cy.get('#riskScore').should('contain', '8');
    cy.get('.clause-explanation').should('contain', 'Verileriniz izniniz ve bildirim olmaksızın reklam şirketlerine satılabilir.');
    cy.wait(3000);
  });

  it('Sistemin Belirsizliği Dürüstçe Gösterdiği Senaryo: Halüsinasyon veya eksik data', () => {
    cy.window().then((win) => {
      win.chrome.tabs.sendMessage.callsFake((tabId, msg, cb) => {
        cb({ text: "Standart ve güvenli üyelik sözleşmesi metni." });
      });

      // Background script, halüsinasyon durumunda alıntıyı kaynakta bulamaz ve maddeyi eler
      win.chrome.runtime.sendMessage.callsFake((msg, cb) => {
        cb({
          success: true,
          data: {
            risk_skoru: 2,
            riskli_maddeler: [] // Deterministik filtrelemeden geçemediği için elendi
          }
        });
      });
    });

    cy.wait(1500);
    cy.get('#analyzeBtn').click();
    cy.wait(1000);

    cy.get('#results').should('not.have.class', 'hidden');
    cy.get('.uncertain-clause').should('contain', 'Belirsiz madde / Doğrulanamadı');
    cy.get('.clause-item').should('contain', 'Riskli madde bulunamadı veya emin olunamadı.');
    cy.wait(3000);
  });
});
