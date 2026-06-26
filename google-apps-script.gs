/**
 * Google Apps Script - Web App Scanner PDF
 *
 * Déploiement :
 * 1. Crée un nouveau script sur https://script.google.com
 * 2. Copie ce fichier dans l'éditeur
 * 3. Va dans "Déployer" > "Nouveau déploiement"
 * 4. Choisis "Application Web" (Web App)
 * 5. Exécute en tant que : "Moi"
 * 6. Accès : "Tout le monde" (anonymous)
 * 7. Copie l'URL et mets-la dans src/config.js
 */

const SHEET_ID = "1CQmObzftvfrwNhO2IMhcuPn6DfddUffnSGoUai9InqU";
const SHEET_NAME = "Sheet1";
const FOLDER_ID = "1jnuP_XkSAaZkjkk0Nk4Cx8OhNGrTSaI6";

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({ status: "ok", message: "Web App active" })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);

    // Ajoute les en-têtes si la feuille est vide
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Date", "Type", "Désignation", "Destination",
        "Montant", "Document scanné", "Accusé", "Lien PDF", "Horodatage"
      ]);
    }

    var pdfUrl = "";

    // Upload du PDF vers Google Drive si présent
    if (data.pdfBase64 && data.pdfName) {
      try {
        var blob = Utilities.base64Decode(data.pdfBase64);
        var folder = DriveApp.getFolderById(FOLDER_ID);
        var file = folder.createFile(blob, data.pdfName, "application/pdf");
        pdfUrl = file.getUrl();
      } catch (driveErr) {
        pdfUrl = "Erreur upload: " + driveErr.toString();
      }
    }

    sheet.appendRow([
      data.date,
      data.type,
      data.designation,
      data.destination,
      data.montant,
      data.documentScanne || "Oui",
      data.accuse || "-",
      pdfUrl,
      data.timestamp || new Date().toISOString()
    ]);

    return ContentService.createTextOutput(
      JSON.stringify({ status: "success", pdfUrl: pdfUrl })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
