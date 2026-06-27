import { useState, useRef, useMemo } from 'react';
import {
  StyleSheet, Text, View, Image, TouchableOpacity, Dimensions,
  PanResponder, ActivityIndicator,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

const SCREEN = Dimensions.get('window');
const IMAGE_MARGIN = 10;
const IMAGE_WIDTH = SCREEN.width - IMAGE_MARGIN * 2;
const HANDLE_SIZE = 28;

export default function EditScreen({ route, navigation }) {
  const { photoUri } = route.params;
  const [imageUri, setImageUri] = useState(photoUri);
  const [imageSize, setImageSize] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [crop, setCrop] = useState({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const cropRef = useRef(crop);
  cropRef.current = crop;
  const startStateRef = useRef(null);

  const layoutRef = useRef({ x: 0, y: 0, w: IMAGE_WIDTH, h: IMAGE_WIDTH * 0.75 });

  const handleImageLoad = (evt) => {
    const { width, height } = evt.nativeEvent.source;
    const aspect = width / height;
    let dispW = IMAGE_WIDTH;
    let dispH = dispW / aspect;
    if (dispH > SCREEN.height * 0.55) {
      dispH = SCREEN.height * 0.55;
      dispW = dispH * aspect;
    }
    layoutRef.current = {
      x: (IMAGE_WIDTH - dispW) / 2 + IMAGE_MARGIN,
      y: 55,
      w: dispW,
      h: dispH,
    };
    setImageSize({ width, height });
  };

  const clampCrop = (x, y, w, h) => ({
    x: Math.max(0, Math.min(1 - w, x)),
    y: Math.max(0, Math.min(1 - h, y)),
    w: Math.max(0.08, Math.min(1, w)),
    h: Math.max(0.08, Math.min(1, h)),
  });

  const createPanResponder = (handle) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      startStateRef.current = { ...cropRef.current };
    },
    onPanResponderRelease: () => {
      startStateRef.current = null;
    },
    onPanResponderMove: (_, g) => {
      const layout = layoutRef.current;
      const dx = g.dx / layout.w;
      const dy = g.dy / layout.h;
      const s = startStateRef.current;
      if (!s) return;

      let c;
      switch (handle) {
        case 'tl':
          c = { x: s.x + dx, y: s.y + dy, w: s.w - dx, h: s.h - dy }; break;
        case 'tr':
          c = { x: s.x, y: s.y + dy, w: s.w + dx, h: s.h - dy }; break;
        case 'bl':
          c = { x: s.x + dx, y: s.y, w: s.w - dx, h: s.h + dy }; break;
        case 'br':
          c = { x: s.x, y: s.y, w: s.w + dx, h: s.h + dy }; break;
        case 'move':
          c = { x: s.x + dx, y: s.y + dy, w: s.w, h: s.h }; break;
        default:
          c = s;
      }
      setCrop(clampCrop(c.x, c.y, c.w, c.h));
    },
  });

  const panResponders = useMemo(() => ({
    tl: createPanResponder('tl'),
    tr: createPanResponder('tr'),
    bl: createPanResponder('bl'),
    br: createPanResponder('br'),
    move: createPanResponder('move'),
  }), []);

  const handleRotate = async () => {
    setProcessing(true);
    try {
      const r = await ImageManipulator.manipulateAsync(imageUri, [{ rotate: 90 }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.9 });
      setImageUri(r.uri);
    } finally { setProcessing(false); }
  };

  const handleEnhance = async () => {
    setProcessing(true);
    try {
      const r = await ImageManipulator.manipulateAsync(imageUri,
        [{ contrast: 1.35 }, { brightness: 0.08 }, { saturate: 1.25 }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.95 });
      setImageUri(r.uri);
    } finally { setProcessing(false); }
  };

  const handleApplyCrop = async () => {
    if (!imageSize) return;
    setProcessing(true);
    try {
      const c = cropRef.current;
      const region = {
        originX: Math.round(c.x * imageSize.width),
        originY: Math.round(c.y * imageSize.height),
        width: Math.round(c.w * imageSize.width),
        height: Math.round(c.h * imageSize.height),
      };
      const r = await ImageManipulator.manipulateAsync(imageUri, [{ crop: region }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.95 });
      setImageUri(r.uri);
      setCrop({ x: 0, y: 0, w: 1, h: 1 });
    } finally { setProcessing(false); }
  };

  const handleConfirm = () => {
    navigation.replace('Form', { photoUri: imageUri });
  };

  const renderOverlay = () => {
    const l = layoutRef.current;
    const c = crop;
    const left = l.x + c.x * l.w;
    const top = l.y + c.y * l.h;
    const w = c.w * l.w;
    const h = c.h * l.h;

    return (
      <>
        <View style={[styles.mask, { top: 0, bottom: 0, left: 0, width: left }]} />
        <View style={[styles.mask, { top: 0, bottom: 0, right: 0, width: IMAGE_WIDTH - left - w + IMAGE_MARGIN }]} />
        <View style={[styles.mask, { top: 0, left, width: w, height: top }]} />
        <View style={[styles.mask, { top: top + h, left, width: w, bottom: 0 }]} />

        <View style={[styles.cropBorder, { left, top, width: w, height: h }]}>
          <View style={styles.grid}>
            {[1, 2].map(i => (
              <View key={`v${i}`} style={[styles.gridLineV, { left: w * i / 3 }]} />
            ))}
            {[1, 2].map(i => (
              <View key={`h${i}`} style={[styles.gridLineH, { top: h * i / 3 }]} />
            ))}
          </View>
        </View>

        <View style={[styles.moveArea, { left, top, width: w, height: h }]} {...panResponders.move.panHandlers} />
        <View style={[styles.handle, { left: left - HANDLE_SIZE/2, top: top - HANDLE_SIZE/2 }]} {...panResponders.tl.panHandlers} />
        <View style={[styles.handle, { left: left + w - HANDLE_SIZE/2, top: top - HANDLE_SIZE/2 }]} {...panResponders.tr.panHandlers} />
        <View style={[styles.handle, { left: left - HANDLE_SIZE/2, top: top + h - HANDLE_SIZE/2 }]} {...panResponders.bl.panHandlers} />
        <View style={[styles.handle, { left: left + w - HANDLE_SIZE/2, top: top + h - HANDLE_SIZE/2 }]} {...panResponders.br.panHandlers} />
      </>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.imageArea}>
        <Image source={{ uri: imageUri }} style={[styles.image, { width: IMAGE_WIDTH }]}
          resizeMode="contain" onLoad={handleImageLoad} />
        {imageSize && renderOverlay()}
        {processing && <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>}
      </View>

      <View style={styles.tools}>
        <ToolBtn icon="↻" label="Rotation" onPress={handleRotate} />
        <ToolBtn icon="⊞" label="Recadrer" onPress={handleApplyCrop} />
        <ToolBtn icon="✦" label="Améliorer" onPress={handleEnhance} />
        <ToolBtn icon="⟲" label="Réinitialiser" onPress={() => setCrop({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 })} />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.retake]} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Reprendre</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.confirm]} onPress={handleConfirm}>
          <Text style={styles.btnText}>Confirmer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ToolBtn({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.toolBtn} onPress={onPress}>
      <Text style={styles.toolIcon}>{icon}</Text>
      <Text style={styles.toolLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  imageArea: {
    flex: 1, margin: IMAGE_MARGIN, borderRadius: 8, overflow: 'hidden',
    position: 'relative',
  },
  image: { flex: 1 },
  mask: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  cropBorder: {
    position: 'absolute', borderWidth: 1.5, borderColor: '#fff',
  },
  grid: { flex: 1, position: 'relative' },
  gridLineV: {
    position: 'absolute', backgroundColor: 'rgba(255,255,255,0.35)', width: 1, height: '100%',
  },
  gridLineH: {
    position: 'absolute', backgroundColor: 'rgba(255,255,255,0.35)', height: 1, width: '100%',
  },
  moveArea: { position: 'absolute', backgroundColor: 'transparent', zIndex: 5 },
  handle: {
    position: 'absolute', width: HANDLE_SIZE, height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2, backgroundColor: '#fff',
    borderWidth: 2.5, borderColor: '#1a73e8', zIndex: 10,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  tools: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 10, backgroundColor: '#1a1a1a',
    borderTopWidth: 1, borderTopColor: '#333',
  },
  toolBtn: { alignItems: 'center', padding: 6, minWidth: 64 },
  toolIcon: { fontSize: 22, color: '#fff' },
  toolLabel: { fontSize: 10, color: '#aaa', marginTop: 3 },
  actions: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 16, paddingHorizontal: 20, backgroundColor: '#0a0a0a',
    paddingBottom: 30,
  },
  btn: { paddingVertical: 14, paddingHorizontal: 44, borderRadius: 10, minWidth: 140, alignItems: 'center' },
  retake: { backgroundColor: '#c0392b' },
  confirm: { backgroundColor: '#27ae60' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
