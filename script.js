const translations = {
  en: document.querySelectorAll("[data-en]"),
  pt: document.querySelectorAll("[data-pt]")
};

let language = localStorage.getItem("cyber-us-language") || "en";

function applyLanguage() {
  const target = language === "pt" ? "data-pt" : "data-en";
  document.querySelectorAll("[data-en], [data-pt]").forEach(el => {
    const value = el.getAttribute(target);
    if (value) el.textContent = value;
  });

  // Decorative panels also follow the chosen language; keep their existing line breaks.
  const fanartsArt = document.querySelector('.fanarts-teaser-art');
  if (fanartsArt) {
    fanartsArt.querySelector('span:first-child').textContent = language === 'pt' ? 'CYBER / US · COMUNIDADE' : 'CYBER / US · COMMUNITY';
    fanartsArt.querySelector('strong').innerHTML = language === 'pt' ? 'ARTE<br>SEM<br>FRONTEIRAS' : 'ART<br>WITHOUT<br>BORDERS';
    fanartsArt.querySelector('span:last-child').textContent = language === 'pt' ? 'TRANSMISSÃO // PENDENTE' : 'TRANSMISSION // PENDING';
  }
  const newsletterArt = document.querySelector('.newsletter-teaser-art');
  if (newsletterArt) {
    newsletterArt.querySelector('strong').innerHTML = language === 'pt' ? 'SINAL<br>A CAMINHO' : 'INCOMING<br>SIGNAL';
    newsletterArt.querySelector('span:last-child').textContent = language === 'pt' ? 'TRANSMISSÃO PENDENTE · · ·' : 'TRANSMISSION PENDING · · ·';
  }

  document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
  document.getElementById("languageBtn").textContent = language === "pt" ? "EN" : "PT-BR";
  localStorage.setItem("cyber-us-language", language);
}

document.getElementById("languageBtn").addEventListener("click", () => {
  language = language === "en" ? "pt" : "en";
  applyLanguage();
});

document.getElementById("year").textContent = new Date().getFullYear();

/* Keep the homepage layout intact; route its existing Comic / Read buttons to our official reader. */
document.querySelector('.site-header nav a[href="#comic"]')?.setAttribute('href', 'catalogo.html');
document.querySelector('.hero-buttons a[href="#comic"]')?.setAttribute('href', 'catalogo.html');

applyLanguage();
