import { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';

export default function CameraScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const takePicture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const picture = await cameraRef.current.takePictureAsync();
      const processed = await ImageManipulator.manipulateAsync(
        picture.uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      setPhoto(processed.uri);
    } finally {
      setCapturing(false);
    }
  };

  const usePhoto = () => {
    navigation.navigate('Edit', { photoUri: photo });
  };

  const retake = () => {
    setPhoto(null);
  };

  if (!permission) {
    return <View style={styles.container}><Text>Demande d'autorisation...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text>Autorisation caméra requise</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Accorder l'accès</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (photo) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: photo }} style={styles.preview} />
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.button, styles.retakeBtn]} onPress={retake}>
            <Text style={styles.buttonText}>Reprendre</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.useBtn]} onPress={usePhoto}>
            <Text style={styles.buttonText}>Utiliser</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        <View style={styles.captureContainer}>
          <TouchableOpacity style={styles.captureButton} onPress={takePicture} />
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  captureContainer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  preview: { flex: 1, resizeMode: 'contain' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: '#111',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  retakeBtn: { backgroundColor: '#e74c3c' },
  useBtn: { backgroundColor: '#2ecc71' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
