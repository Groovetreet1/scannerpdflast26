/**
 * Google Apps Script - Scanner PDF
 *
 * Déploiement :
 * 1. Va sur https://script.google.com → Nouveau projet
 * 2. Copie ce fichier dans l'éditeur
 * 3. Déployer → Nouveau déploiement → Application Web
 * 4. Exécuter en tant que : Moi
 * 5. Accès : Tout le monde (Anonymous)
 * 6. Copie l'URL et mets-la dans src/config.js
 */

const SHEET_ID = "1CQmObzftvfrwNhO2IMhcuPn6DfddUffnSGoUai9InqU";
const SHEET_NAME = "Sheet1";
const FOLDER_ID = "1jnuP_XkSAaZkjkk0Nk4Cx8OhNGrTSaI6";

function getSheet() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Date", "Type", "Designation", "Destination",
      "Montant", "Document scanné", "Accuse", "Lien PDF", "Horodatage"
    ]);
  }
  return sheet;
}

function processData(data) {
  var pdfUrl = "";

  if (data.pdfBase64 && data.pdfName) {
    var blob = Utilities.base64Decode(data.pdfBase64);
    var folder = DriveApp.getFolderById(FOLDER_ID);
    var file = folder.createFile(blob, data.pdfName, "application/pdf");
    pdfUrl = file.getUrl();
  }

  var sheet = getSheet();
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
}

function doGet(e) {
  if (e && e.parameter && e.parameter.date) {
    return processData(e.parameter);
  }
  return ContentService.createTextOutput(
    JSON.stringify({ status: "ok", message: "Web App active" })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData ? e.postData.contents : "{}");
    if (!data.date) throw new Error("Missing date field");
    return processData(data);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
