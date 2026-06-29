import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as ImageManipulator from 'expo-image-manipulator';

export async function generatePDF(formData, imageUri) {
  const dateStr = formData.date || new Date().toLocaleDateString('fr-FR');

  // Try embedding image, skip on any error
  let imgHtml = '';
  try {
    const smallImg = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 400 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
    );
    const b64 = await FileSystem.readAsStringAsync(smallImg.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    imgHtml = `<div class="photo-container"><img src="data:image/jpeg;base64,${b64}" /></div>`;
  } catch (e) {
    imgHtml = '<p style="color:#999;text-align:center;margin-top:20px">(Image non disponible)</p>';
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Helvetica,Arial,sans-serif;padding:30px;color:#222}
h1{text-align:center;color:#1a73e8;font-size:20px;margin-bottom:24px}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
td{border:1px solid #ccc;padding:10px 12px;font-size:14px;vertical-align:top}
td:first-child{background:#f5f7fa;font-weight:600;width:35%;color:#333}
.photo-container{text-align:center;margin-top:16px}
.photo-container img{max-width:100%;height:auto;max-height:400px}
.footer{text-align:center;margin-top:32px;font-size:11px;color:#999}
</style></head>
<body>
<h1>Document Scanné</h1>
<table>
<tr><td>Date</td><td>${escHtml(dateStr)}</td></tr>
<tr><td>Type</td><td>${escHtml(formData.type || '-')}</td></tr>
<tr><td>Désignation</td><td>${escHtml(formData.designation || '-')}</td></tr>
<tr><td>Destination</td><td>${escHtml(formData.destination || '-')}</td></tr>
<tr><td>Montant</td><td>${escHtml(formData.montant || '-')}${formData.montant ? ' MAD' : ''}</td></tr>
<tr><td>Document scanné</td><td>Oui</td></tr>
<tr><td>Accusé</td><td>${escHtml(formData.accuse || '-')}</td></tr>
</table>
${imgHtml}
<div class="footer">Généré le ${new Date().toLocaleString('fr-FR')}</div>
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, function (m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    return '&#039;';
  });
}

export async function sharePDF(uri) {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri);
  }
}
