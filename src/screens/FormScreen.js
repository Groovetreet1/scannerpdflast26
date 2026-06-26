import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, ScrollView,
  TouchableOpacity, Image, Platform,
} from 'react-native';

const TYPES = ['Facture', 'Reçu', 'Contrat', 'Devis', 'Autre'];

export default function FormScreen({ route, navigation }) {
  const { photoUri } = route.params;
  const today = new Date().toLocaleDateString('fr-CA'); // YYYY-MM-DD

  const [date, setDate] = useState(today);
  const [type, setType] = useState('');
  const [designation, setDesignation] = useState('');
  const [destination, setDestination] = useState('');
  const [montant, setMontant] = useState('');
  const [accuse, setAccuse] = useState('');
  const [showTypes, setShowTypes] = useState(false);

  const handleNext = () => {
    if (!date || !type || !designation || !destination || !montant) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }
    navigation.navigate('Preview', {
      photoUri,
      formData: { date, type, designation, destination, montant, accuse },
    });
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.photoPreview}>
        <Image source={{ uri: photoUri }} style={styles.thumbnail} />
        <Text style={styles.photoLabel}>Document scanné</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Date *</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Type *</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowTypes(!showTypes)}>
          <Text style={type ? styles.inputText : styles.placeholder}>
            {type || 'Sélectionner un type'}
          </Text>
        </TouchableOpacity>
        {showTypes && (
          <View style={styles.dropdown}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={styles.dropdownItem}
                onPress={() => { setType(t); setShowTypes(false); }}
              >
                <Text style={styles.dropdownText}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Désignation *</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={designation}
          onChangeText={setDesignation}
          placeholder="Description du document"
          placeholderTextColor="#999"
          multiline
        />

        <Text style={styles.label}>Destination *</Text>
        <TextInput
          style={styles.input}
          value={destination}
          onChangeText={setDestination}
          placeholder="Service / Personne"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Montant *</Text>
        <TextInput
          style={styles.input}
          value={montant}
          onChangeText={setMontant}
          placeholder="0.00 MAD"
          placeholderTextColor="#999"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Accusé</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={accuse}
          onChangeText={setAccuse}
          placeholder="Notes / Accusé de réception"
          placeholderTextColor="#999"
          multiline
        />

        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>Générer le PDF</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  photoPreview: { alignItems: 'center', padding: 16, backgroundColor: '#fff' },
  thumbnail: { width: '100%', height: 150, resizeMode: 'cover', borderRadius: 8 },
  photoLabel: { marginTop: 6, fontSize: 12, color: '#666' },
  form: { padding: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  inputText: { fontSize: 16, color: '#333' },
  placeholder: { fontSize: 16, color: '#999' },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  dropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 4,
  },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  dropdownText: { fontSize: 16 },
  nextButton: {
    backgroundColor: '#1a73e8',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 40,
  },
  nextButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
