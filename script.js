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

  document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
  document.getElementById("languageBtn").textContent = language === "pt" ? "EN" : "PT-BR";
  localStorage.setItem("cyber-us-language", language);
}

document.getElementById("languageBtn").addEventListener("click", () => {
  language = language === "en" ? "pt" : "en";
  applyLanguage();
});

document.getElementById("year").textContent = new Date().getFullYear();

/*
  IMPORTANT:
  Replace the "#" below with your actual Ko-fi page.
  Example:
  document.getElementById("kofiLink").href = "https://ko-fi.com/SEUNOME";
*/
document.getElementById("kofiLink").href = "#";

applyLanguage();
