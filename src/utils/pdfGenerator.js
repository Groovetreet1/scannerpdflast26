import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as ImageManipulator from 'expo-image-manipulator';

export async function generatePDF(formData, imageUri) {
  const dateStr = formData.date || new Date().toLocaleDateString('fr-FR');

  let imgTag = '';
  try {
    const resized = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 600 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
    );
    const b64 = await FileSystem.readAsStringAsync(resized.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    imgTag = `<img src="data:image/jpeg;base64,${b64}" />`;
  } catch (e) {
    imgTag = '<p style="color:#999">(Image non disponible)</p>';
  }

  const html = `
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: sans-serif; padding: 20px; }
        h1 { text-align: center; color: #1a73e8; font-size: 22px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        td, th { border: 1px solid #333; padding: 10px; text-align: left; }
        th { background: #f0f0f0; font-weight: bold; width: 30%; }
        .photo-container { text-align: center; margin-top: 20px; }
        .photo-container img { max-width: 100%; height: auto; max-height: 500px; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <h1>Document Scanné</h1>
      <table>
        <tr><th>Date</th><td>${dateStr}</td></tr>
        <tr><th>Type</th><td>${formData.type || '-'}</td></tr>
        <tr><th>Désignation</th><td>${formData.designation || '-'}</td></tr>
        <tr><th>Destination</th><td>${formData.destination || '-'}</td></tr>
        <tr><th>Montant</th><td>${formData.montant || '-'} ${formData.montant ? 'MAD' : ''}</td></tr>
        <tr><th>Document scanné</th><td>Oui</td></tr>
        <tr><th>Accusé</th><td>${formData.accuse || '-'}</td></tr>
      </table>
      <div class="photo-container">
        ${imgTag}
      </div>
      <div class="footer">
        Généré le ${new Date().toLocaleString('fr-FR')}
      </div>
    </body>
    </html>
  `;
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

export async function sharePDF(uri) {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri);
  }
}
