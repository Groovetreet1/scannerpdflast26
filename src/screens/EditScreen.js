import { useState, useRef, useMemo } from 'react';
import {
  StyleSheet, Text, View, Image, TouchableOpacity, Dimensions,
  PanResponder, ActivityIndicator, Alert,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { usePerspectiveProcessor } from '../utils/perspectiveProcessor';
import { useAutoDetect } from '../utils/autoDetect';

const SCREEN = Dimensions.get('window');
const IMAGE_MARGIN = 10;
const IMAGE_WIDTH = SCREEN.width - IMAGE_MARGIN * 2;
const HANDLE_SIZE = 28;

export default function EditScreen({ route, navigation }) {
  const { photoUri } = route.params;
  const [imageUri, setImageUri] = useState(photoUri);
  const [imageSize, setImageSize] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [mode, setMode] = useState('crop');
  const [crop, setCrop] = useState({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const cropRef = useRef(crop);
  cropRef.current = crop;
  const startStateRef = useRef(null);
  const layoutRef = useRef({ x: 0, y: 0, w: IMAGE_WIDTH, h: IMAGE_WIDTH * 0.75 });

  const [corners, setCorners] = useState([
    { x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 },
    { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 },
  ]);
  const cornersRef = useRef(corners);
  cornersRef.current = corners;
  const cornerStartRef = useRef(null);
  const dragCornerRef = useRef(-1);
  const { ready: perspReady, correctPerspective, processorComponent } = usePerspectiveProcessor();
  const { ready: detectReady, detectCorners, detectorComponent } = useAutoDetect();

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

  const clampCorner = (idx, x, y) => ({
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  });

  const createPanResponder = (handle) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      if (mode === 'crop') {
        startStateRef.current = { ...cropRef.current };
      } else {
        cornerStartRef.current = cornersRef.current.map(c => ({ ...c }));
        dragCornerRef.current = handle;
      }
    },
    onPanResponderRelease: () => {
      startStateRef.current = null;
      cornerStartRef.current = null;
      dragCornerRef.current = -1;
    },
    onPanResponderMove: (_, g) => {
      const layout = layoutRef.current;
      const dx = g.dx / layout.w;
      const dy = g.dy / layout.h;

      if (mode === 'crop') {
        const s = startStateRef.current;
        if (!s) return;
        let c;
        switch (handle) {
          case 'tl': c = { x: s.x + dx, y: s.y + dy, w: s.w - dx, h: s.h - dy }; break;
          case 'tr': c = { x: s.x, y: s.y + dy, w: s.w + dx, h: s.h - dy }; break;
          case 'bl': c = { x: s.x + dx, y: s.y, w: s.w - dx, h: s.h + dy }; break;
          case 'br': c = { x: s.x, y: s.y, w: s.w + dx, h: s.h + dy }; break;
          case 'move': c = { x: s.x + dx, y: s.y + dy, w: s.w, h: s.h }; break;
          default: c = s;
        }
        setCrop(clampCrop(c.x, c.y, c.w, c.h));
      } else if (mode === 'perspective' && handle >= 0 && handle < 4) {
        const s = cornerStartRef.current;
        if (!s) return;
        const newCorners = s.map((c, i) => {
          if (i === handle) return clampCorner(i, c.x + dx, c.y + dy);
          return c;
        });
        setCorners(newCorners);
      }
    },
  });

  const panResponders = useMemo(() => ({
    tl: createPanResponder('tl'),
    tr: createPanResponder('tr'),
    bl: createPanResponder('bl'),
    br: createPanResponder('br'),
    move: createPanResponder('move'),
    c0: createPanResponder(0),
    c1: createPanResponder(1),
    c2: createPanResponder(2),
    c3: createPanResponder(3),
  }), [mode]);

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

  const handleCorrectPerspective = async () => {
    if (!imageSize) return;
    setProcessing(true);
    try {
      const l = layoutRef.current;
      const c = cornersRef.current;
      const imgPts = c.map(p => ({
        x: p.x * imageSize.width,
        y: p.y * imageSize.height,
      }));
      const outputSize = Math.max(imageSize.width, imageSize.height);
      const dataUri = await correctPerspective(imageUri, imgPts, outputSize);
      const tempPath = FileSystem.cacheDirectory + 'persp_' + Date.now() + '.jpg';
      const base64 = dataUri.split(',')[1];
      await FileSystem.writeAsStringAsync(tempPath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setImageUri(tempPath);
      setCorners([
        { x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 },
        { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 },
      ]);
    } catch (e) {
      Alert.alert('Erreur', 'Perspective correction failed: ' + e.message);
    } finally { setProcessing(false); }
  };

  const handleAutoDetect = async () => {
    setProcessing(true);
    try {
      const result = await detectCorners(imageUri);
      if (result) {
        setCorners(result);
      } else {
        Alert.alert('Info', "Impossible de détecter les bords automatiquement. Ajuste les coins manuellement.");
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = () => {
    navigation.replace('Form', { photoUri: imageUri });
  };

  const renderCropOverlay = () => {
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

  const renderPerspectiveOverlay = () => {
    const l = layoutRef.current;
    const c = corners;
    const pts = c.map(p => ({
      x: l.x + p.x * l.w,
      y: l.y + p.y * l.h,
    }));

    return (
      <>
        <View style={[styles.perspMask, { top: 0, left: 0, right: 0, bottom: 0 }]}>
          <View style={[styles.perspQuad, {
            top: Math.min(pts[0].y, pts[1].y, pts[2].y, pts[3].y),
            left: Math.min(pts[0].x, pts[1].x, pts[2].x, pts[3].x),
            width: Math.max(pts[0].x, pts[1].x, pts[2].x, pts[3].x) - Math.min(pts[0].x, pts[1].x, pts[2].x, pts[3].x),
            height: Math.max(pts[0].y, pts[1].y, pts[2].y, pts[3].y) - Math.min(pts[0].y, pts[1].y, pts[2].y, pts[3].y),
          }]} />
        </View>
        <View style={[styles.perspLine, { left: pts[0].x, top: pts[0].y, width: Math.sqrt(Math.pow(pts[1].x-pts[0].x,2)+Math.pow(pts[1].y-pts[0].y,2)), transform: [{ rotate: Math.atan2(pts[1].y-pts[0].y, pts[1].x-pts[0].x) + 'rad' }] }]} />
        <View style={[styles.perspLine, { left: pts[1].x, top: pts[1].y, width: Math.sqrt(Math.pow(pts[2].x-pts[1].x,2)+Math.pow(pts[2].y-pts[1].y,2)), transform: [{ rotate: Math.atan2(pts[2].y-pts[1].y, pts[2].x-pts[1].x) + 'rad' }] }]} />
        <View style={[styles.perspLine, { left: pts[2].x, top: pts[2].y, width: Math.sqrt(Math.pow(pts[3].x-pts[2].x,2)+Math.pow(pts[3].y-pts[2].y,2)), transform: [{ rotate: Math.atan2(pts[3].y-pts[2].y, pts[3].x-pts[2].x) + 'rad' }] }]} />
        <View style={[styles.perspLine, { left: pts[3].x, top: pts[3].y, width: Math.sqrt(Math.pow(pts[0].x-pts[3].x,2)+Math.pow(pts[0].y-pts[3].y,2)), transform: [{ rotate: Math.atan2(pts[0].y-pts[3].y, pts[0].x-pts[3].x) + 'rad' }] }]} />
        {pts.map((p, i) => (
          <View key={i} style={[styles.cornerHandle, { left: p.x - 14, top: p.y - 14 }]}
            {...panResponders[`c${i}`].panHandlers} />
        ))}
      </>
    );
  };

  return (
    <View style={styles.container}>
      {processorComponent}
      {detectorComponent}
      <View style={styles.modeBar}>
        <TouchableOpacity style={[styles.modeBtn, mode === 'crop' && styles.modeBtnActive]} onPress={() => setMode('crop')}>
          <Text style={[styles.modeBtnText, mode === 'crop' && styles.modeBtnTextActive]}>Découpage</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modeBtn, mode === 'perspective' && styles.modeBtnActive]} onPress={() => setMode('perspective')}>
          <Text style={[styles.modeBtnText, mode === 'perspective' && styles.modeBtnTextActive]}>Perspective</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.imageArea}>
        <Image source={{ uri: imageUri }} style={[styles.image, { width: IMAGE_WIDTH }]}
          resizeMode="contain" onLoad={handleImageLoad} />
        {imageSize && (mode === 'crop' ? renderCropOverlay() : renderPerspectiveOverlay())}
        {processing && <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>}
      </View>

      <View style={styles.tools}>
        <ToolBtn icon="↻" label="Rotation" onPress={handleRotate} />
        {mode === 'crop' ? (
          <ToolBtn icon="⊞" label="Recadrer" onPress={handleApplyCrop} />
        ) : (
          <>
            <ToolBtn icon="⬜" label="Corriger" onPress={handleCorrectPerspective} disabled={!perspReady} />
            <ToolBtn icon="◎" label="Auto" onPress={handleAutoDetect} disabled={!detectReady} />
          </>
        )}
        <ToolBtn icon="✦" label="Améliorer" onPress={handleEnhance} />
        <ToolBtn icon="⟲" label="Réinit." onPress={() => {
          if (mode === 'crop') setCrop({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
          else setCorners([{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }]);
        }} />
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

function ToolBtn({ icon, label, onPress, disabled }) {
  return (
    <TouchableOpacity style={[styles.toolBtn, disabled && styles.toolBtnDisabled]} onPress={onPress} disabled={disabled}>
      <Text style={[styles.toolIcon, disabled && styles.toolIconDisabled]}>{icon}</Text>
      <Text style={[styles.toolLabel, disabled && styles.toolLabelDisabled]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  modeBar: {
    flexDirection: 'row', backgroundColor: '#222', paddingVertical: 6,
    paddingHorizontal: 20, gap: 8,
  },
  modeBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
    backgroundColor: '#333',
  },
  modeBtnActive: { backgroundColor: '#1a73e8' },
  modeBtnText: { color: '#999', fontWeight: '600', fontSize: 13 },
  modeBtnTextActive: { color: '#fff' },
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
  perspMask: {
    position: 'absolute', backgroundColor: 'rgba(0,0,0,0.4)',
  },
  perspQuad: {
    position: 'absolute', backgroundColor: 'rgba(26,115,232,0.15)',
    borderWidth: 1, borderColor: '#1a73e8', borderStyle: 'dashed',
  },
  perspLine: {
    position: 'absolute', height: 2, backgroundColor: '#1a73e8',
    transformOrigin: 'left center', zIndex: 5,
  },
  cornerHandle: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#fff', borderWidth: 3, borderColor: '#1a73e8',
    zIndex: 20, elevation: 5,
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
  toolBtnDisabled: { opacity: 0.4 },
  toolIcon: { fontSize: 22, color: '#fff' },
  toolIconDisabled: { color: '#666' },
  toolLabel: { fontSize: 10, color: '#aaa', marginTop: 3 },
  toolLabelDisabled: { color: '#555' },
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
