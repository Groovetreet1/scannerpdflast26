import { useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { generatePDF, sharePDF } from '../utils/pdfGenerator';
import { GOOGLE_SHEETS_WEBHOOK_URL } from '../config';

export default function PreviewScreen({ route, navigation }) {
  const { photoUri, formData } = route.params;
  const [saving, setSaving] = useState(false);
  const [pdfUri, setPdfUri] = useState(null);

  const handleGeneratePDF = async () => {
    setSaving(true);
    try {
      const uri = await generatePDF(formData, photoUri);
      const fileName = `document_${Date.now()}.pdf`;
      const dest = FileSystem.documentDirectory + fileName;
      await FileSystem.moveAsync({ from: uri, to: dest });
      setPdfUri(dest);
      Alert.alert('Succès', `PDF généré : ${fileName}`);
    } catch (e) {
      Alert.alert('Erreur', "Impossible de générer le PDF");
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (pdfUri) await sharePDF(pdfUri);
  };

  const handleSaveToSheets = async () => {
    if (!GOOGLE_SHEETS_WEBHOOK_URL) {
      Alert.alert(
        'Configuration requise',
        "Ajoute l'URL du Google Apps Script dans src/config.js"
      );
      return;
    }

    setSaving(true);
    try {
      var pdfBase64 = "";
      var pdfName = "";
      if (pdfUri) {
        pdfBase64 = await FileSystem.readAsStringAsync(pdfUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        pdfName = pdfUri.split('/').pop();
      }

      const data = {
        date: formData.date,
        type: formData.type,
        designation: formData.designation,
        destination: formData.destination,
        montant: formData.montant,
        documentScanne: 'Oui',
        accuse: formData.accuse || '-',
        pdfBase64: pdfBase64,
        pdfName: pdfName,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (result.status === 'success') {
        var msg = 'Données envoyées au Sheet !';
        if (result.pdfUrl) {
          msg += '\nPDF uploadé : ' + result.pdfUrl;
        }
        Alert.alert('Succès', msg);
      } else {
        Alert.alert('Erreur', result.message || 'Réponse inconnue');
      }
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de contacter le serveur. Vérifie ton URL.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    if (!pdfUri) {
      await handleGeneratePDF();
    }
    if (pdfUri) {
      await handleSaveToSheets();
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Document scanné</Text>
        <Image source={{ uri: photoUri }} style={styles.photo} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Informations</Text>
        <InfoRow label="Date" value={formData.date} />
        <InfoRow label="Type" value={formData.type} />
        <InfoRow label="Désignation" value={formData.designation} />
        <InfoRow label="Destination" value={formData.destination} />
        <InfoRow label="Montant" value={`${formData.montant} MAD`} />
        <InfoRow label="Document scanné" value="Oui" />
        <InfoRow label="Accusé" value={formData.accuse || '-'} />
      </View>

      <View style={styles.actions}>
        {!pdfUri ? (
          <TouchableOpacity
            style={[styles.button, styles.pdfButton]}
            onPress={handleGeneratePDF}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Générer le PDF</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.button, styles.shareButton]} onPress={handleShare}>
            <Text style={styles.buttonText}>Partager le PDF</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.sheetsButton]}
          onPress={handleSaveToSheets}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Upload PDF + Sheets</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.saveAllButton]}
          onPress={handleSaveAll}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Tout en 1 clic</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  card: { backgroundColor: '#fff', margin: 12, padding: 16, borderRadius: 12, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  photo: { width: '100%', height: 200, resizeMode: 'contain', borderRadius: 8 },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: { width: 120, fontWeight: '600', color: '#555', fontSize: 14 },
  infoValue: { flex: 1, color: '#333', fontSize: 14 },
  actions: { padding: 12, gap: 10, marginBottom: 40 },
  button: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  pdfButton: { backgroundColor: '#e67e22' },
  shareButton: { backgroundColor: '#3498db' },
  sheetsButton: { backgroundColor: '#0f9d58' },
  saveAllButton: { backgroundColor: '#1a73e8' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
