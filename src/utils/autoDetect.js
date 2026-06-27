import { useState, useCallback, useRef, useEffect } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';

const DETECT_HTML = `
<!DOCTYPE html>
<html><body style="margin:0;background:#000">
<canvas id="c"></canvas>
<script>
function grayscale(data, w, h) {
  var out = new Float32Array(w * h);
  for (var i = 0; i < w * h; i++) {
    var idx = i * 4;
    out[i] = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
  }
  return out;
}

function sobel(gray, w, h) {
  var mag = new Float32Array(w * h);
  for (var y = 1; y < h - 1; y++) {
    for (var x = 1; x < w - 1; x++) {
      var i = y * w + x;
      var gx = -gray[i-w-1] + gray[i-w+1] - 2*gray[i-1] + 2*gray[i+1] - gray[i+w-1] + gray[i+w+1];
      var gy = -gray[i-w-1] - 2*gray[i-w] - gray[i-w+1] + gray[i+w-1] + 2*gray[i+w] + gray[i+w+1];
      mag[i] = Math.sqrt(gx*gx + gy*gy);
    }
  }
  return mag;
}

function findDocumentCorners(edgeMag, w, h) {
  var threshold = 120;
  var points = [];
  var step = Math.max(1, Math.floor(Math.min(w, h) / 100));
  for (var y = step; y < h - step; y += step) {
    for (var x = step; x < w - step; x += step) {
      if (edgeMag[y * w + x] > threshold) {
        points.push({x: x, y: y, val: edgeMag[y * w + x]});
      }
    }
  }
  if (points.length < 50) {
    threshold = 60;
    points = [];
    for (var y = step; y < h - step; y += step) {
      for (var x = step; x < w - step; x += step) {
        if (edgeMag[y * w + x] > threshold) {
          points.push({x: x, y: y, val: edgeMag[y * w + x]});
        }
      }
    }
  }
  if (points.length < 10) {
    return [{x:0.1,y:0.1},{x:0.9,y:0.1},{x:0.9,y:0.9},{x:0.1,y:0.9}];
  }
  var cx = 0, cy = 0, total = 0;
  for (var p of points) { cx += p.x * p.val; cy += p.y * p.val; total += p.val; }
  cx /= total; cy /= total;
  var tl = points[0], tr = points[0], br = points[0], bl = points[0];
  var bestTL = -Infinity, bestTR = -Infinity, bestBR = -Infinity, bestBL = -Infinity;
  for (var p of points) {
    var angle = Math.atan2(p.y - cy, p.x - cx);
    var score = p.val * (Math.abs(p.x-w/2) + Math.abs(p.y-h/2));
    if (angle <= -Math.PI/2 && -angle > bestTL) { bestTL = -angle; tl = p; }
    if (angle > -Math.PI/2 && angle <= 0 && angle > bestTR) { bestTR = angle; tr = p; }
    if (angle > 0 && angle <= Math.PI/2 && -angle > bestBR) { bestBR = -angle; br = p; }
    if (angle > Math.PI/2 && (-angle) > bestBL) { bestBL = -angle; bl = p; }
  }
  return [
    {x: Math.max(0,Math.min(1, tl.x/w)), y: Math.max(0,Math.min(1, tl.y/h))},
    {x: Math.max(0,Math.min(1, tr.x/w)), y: Math.max(0,Math.min(1, tr.y/h))},
    {x: Math.max(0,Math.min(1, br.x/w)), y: Math.max(0,Math.min(1, br.y/h))},
    {x: Math.max(0,Math.min(1, bl.x/w)), y: Math.max(0,Math.min(1, bl.y/h))},
  ];
}

window.addEventListener('message', async function(e) {
  try {
    var data = JSON.parse(e.data);
    if (data.type === 'detect') {
      var img = new Image();
      img.onload = function() {
        var c = document.getElementById('c');
        c.width = Math.min(img.width, 800);
        c.height = Math.min(img.height, 800 * img.height / img.width);
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, c.width, c.height);
        var imageData = ctx.getImageData(0, 0, c.width, c.height);
        var gray = grayscale(imageData.data, c.width, c.height);
        var edges = sobel(gray, c.width, c.height);
        var corners = findDocumentCorners(edges, c.width, c.height);
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'result', corners: corners}));
      };
      img.onerror = function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'error', msg:'Image load failed'}));
      };
      img.src = 'data:image/jpeg;base64,' + data.imageBase64;
    }
  } catch(err) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'error', msg: err.message}));
  }
});
window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}));
<\/script>
</body></html>
`;

let autoResolver = null;

export function useAutoDetect() {
  const [ready, setReady] = useState(false);
  const webViewRef = useRef(null);

  const onMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready') {
        setReady(true);
      } else if (msg.type === 'result' && autoResolver) {
        autoResolver(msg.corners);
        autoResolver = null;
      } else if (msg.type === 'error' && autoResolver) {
        autoResolver(null);
        autoResolver = null;
      }
    } catch (e) {}
  }, []);

  const detectCorners = useCallback(async (imageUri) => {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return new Promise((resolve) => {
      if (!webViewRef.current || !ready) {
        resolve(null);
        return;
      }

      const timer = setTimeout(() => { autoResolver = null; resolve(null); }, 15000);
      autoResolver = (corners) => { clearTimeout(timer); resolve(corners); };

      webViewRef.current.postMessage(JSON.stringify({
        type: 'detect',
        imageBase64: base64,
      }));
    });
  }, [ready]);

  const detectorComponent = (
    <View style={{ width: 0, height: 0, overflow: 'hidden', position: 'absolute', top: -999, left: -999 }}>
      <WebView
        ref={webViewRef}
        source={{ html: DETECT_HTML }}
        onMessage={onMessage}
        javaScriptEnabled={true}
        style={{ width: 1, height: 1 }}
        originWhitelist={['*']}
      />
    </View>
  );

  return { ready, detectCorners, detectorComponent };
}
