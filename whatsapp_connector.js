(function () {
  if (document.querySelector('.whatsapp-float')) return;
  var phone = "919173569555";
  var pageUrl = new URL(window.location.href);
  pageUrl.search = "";
  pageUrl.hash = "";
  var pageTitle = document.title.trim() || "SIAOS website";
  var message = [
    "Hello SIAOS, I need assistance with this page:",
    pageTitle,
    pageUrl.href
  ].join("\n");

  var link = document.createElement("a");
  link.href = "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.className = "whatsapp-float";
  link.setAttribute("aria-label", "Chat with SIAOS on WhatsApp about this page");
  link.setAttribute("title", "Chat with SIAOS on WhatsApp");
  link.innerHTML =
    '<svg viewBox="0 0 32 32" width="30" height="30" fill="#fff">' +
    '<path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.34.66 4.523 1.804 6.377L4 29l7.816-1.762A11.93 11.93 0 0 0 16.001 27C22.629 27 28 21.627 28 15S22.629 3 16.001 3zm0 21.818a9.77 9.77 0 0 1-4.98-1.362l-.357-.211-4.64 1.046 1.06-4.522-.232-.37A9.78 9.78 0 0 1 6.18 15c0-5.42 4.4-9.818 9.82-9.818S25.82 9.58 25.82 15 21.42 24.818 16 24.818zm5.37-7.34c-.294-.147-1.74-.858-2.01-.956-.27-.099-.466-.147-.663.147-.196.294-.76.955-.932 1.152-.171.196-.343.221-.637.074-.294-.147-1.24-.457-2.362-1.457-.873-.779-1.462-1.741-1.634-2.035-.171-.294-.018-.453.129-.6.132-.132.294-.343.441-.514.147-.172.196-.294.294-.49.098-.196.049-.368-.025-.515-.074-.147-.663-1.6-.909-2.192-.24-.577-.484-.499-.663-.508-.171-.008-.368-.01-.564-.01-.196 0-.515.074-.784.368-.27.294-1.03 1.006-1.03 2.454 0 1.447 1.055 2.845 1.202 3.042.147.196 2.077 3.17 5.032 4.445.703.303 1.251.484 1.679.62.705.224 1.347.192 1.855.117.566-.085 1.74-.712 1.986-1.4.245-.688.245-1.278.171-1.4-.073-.123-.269-.196-.563-.343z"/>' +
    "</svg>";

  var style = document.createElement("style");
  style.textContent =
    ".whatsapp-float{position:fixed;bottom:24px;right:24px;background-color:#25D366;" +
    "width:58px;height:58px;border-radius:50%;display:flex;align-items:center;" +
    "justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.25);z-index:9999;" +
    "transition:transform 0.2s ease;}" +
    ".whatsapp-float:hover{transform:scale(1.08);}" +
    "@media (max-width:480px){.whatsapp-float{width:50px;height:50px;bottom:16px;right:16px;}}";

  document.head.appendChild(style);
  document.body.appendChild(link);
})();
