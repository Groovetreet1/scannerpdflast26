import { useState, useEffect, useRef } from 'react';
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
  const [imageValid, setImageValid] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    return () => { mounted.current = false; };
  }, []);

  const handleGeneratePDF = async () => {
    setSaving(true);
    try {
      const uri = await generatePDF(formData, photoUri);
      if (!mounted.current) return;
      const fileName = `document_${Date.now()}.pdf`;
      const dest = FileSystem.documentDirectory + fileName;
      await FileSystem.moveAsync({ from: uri, to: dest });
      if (!mounted.current) return;
      setPdfUri(dest);
      Alert.alert('Succès', `PDF généré : ${fileName}`);
    } catch (e) {
      if (mounted.current) {
        Alert.alert('Erreur', e.message || 'Échec de génération du PDF');
      }
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const handleShare = async () => {
    if (pdfUri) await sharePDF(pdfUri);
  };

  const handleSaveToSheets = async () => {
    if (!GOOGLE_SHEETS_WEBHOOK_URL) {
      Alert.alert('Configuration requise', "Ajoute l'URL du Google Apps Script dans src/config.js");
      return;
    }
    setSaving(true);
    try {
      let pdfBase64 = "", pdfName = "";
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
        pdfBase64, pdfName,
        timestamp: new Date().toISOString(),
      };

      const res = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(data),
      });
      let text = await res.text();

      if (text.startsWith('<!')) {
        const params = Object.keys(data).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(data[k])).join('&');
        const res2 = await fetch(GOOGLE_SHEETS_WEBHOOK_URL + '?' + params, { method: 'GET' });
        text = await res2.text();
      }

      let result;
      try { result = JSON.parse(text); } catch { Alert.alert('Erreur', 'Réponse: ' + text.substring(0, 200)); return; }

      if (result.status === 'success') {
        Alert.alert('Succès', 'Données envoyées au Sheet !' + (result.pdfUrl ? '\nPDF: ' + result.pdfUrl : ''));
      } else {
        Alert.alert('Erreur', result.message || 'Réponse inconnue');
      }
    } catch (e) {
      Alert.alert('Erreur', e.message || 'Échec de communication');
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    if (!pdfUri) await handleGeneratePDF();
    if (pdfUri) await handleSaveToSheets();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Document scanné</Text>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo}
            onError={() => setImageValid(false)} />
        ) : null}
        {!imageValid ? <Text style={styles.errorText}>Image indisponible</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Informations</Text>
        <InfoRow label="Date" value={formData.date} />
        <InfoRow label="Type" value={formData.type} />
        <InfoRow label="Désignation" value={formData.designation} />
        <InfoRow label="Destination" value={formData.destination} />
        <InfoRow label="Montant" value={formData.montant ? formData.montant + ' MAD' : '-'} />
        <InfoRow label="Document scanné" value="Oui" />
        <InfoRow label="Accusé" value={formData.accuse || '-'} />
      </View>

      <View style={styles.actions}>
        {!pdfUri ? (
          <TouchableOpacity style={[styles.btn, styles.pdfBtn]} onPress={handleGeneratePDF} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Générer le PDF</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.btn, styles.shareBtn]} onPress={handleShare}>
            <Text style={styles.btnText}>Partager le PDF</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.btn, styles.sheetsBtn]} onPress={handleSaveToSheets} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Upload PDF + Sheets</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.allBtn]} onPress={handleSaveAll} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Tout en 1 clic</Text>}
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
  errorText: { textAlign: 'center', color: '#999', padding: 20 },
  infoRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  infoLabel: { width: 120, fontWeight: '600', color: '#555', fontSize: 14 },
  infoValue: { flex: 1, color: '#333', fontSize: 14 },
  actions: { padding: 12, marginBottom: 40 },
  btn: { padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 8 },
  pdfBtn: { backgroundColor: '#e67e22' },
  shareBtn: { backgroundColor: '#3498db' },
  sheetsBtn: { backgroundColor: '#0f9d58' },
  allBtn: { backgroundColor: '#1a73e8' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
