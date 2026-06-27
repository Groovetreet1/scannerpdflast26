import { useState, useCallback, useRef, useEffect } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';

const WARP_HTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh">
<canvas id="c"></canvas>
<script>
function solvePerspective(src, dst) {
  var M = [];
  for (var i = 0; i < 4; i++) {
    var sx = src[i][0], sy = src[i][1];
    var dx = dst[i][0], dy = dst[i][1];
    M.push([sx, sy, 1, 0, 0, 0, -dx*sx, -dx*sy, dx]);
    M.push([0, 0, 0, sx, sy, 1, -dy*sx, -dy*sy, dy]);
  }
  for (var col = 0; col < 9; col++) {
    var best = col;
    for (var r = col + 1; r < 9; r++)
      if (Math.abs(M[r][col]) > Math.abs(M[best][col])) best = r;
    var t = M[col]; M[col] = M[best]; M[best] = t;
    var p = M[col][col];
    for (var j = col; j <= 9; j++) M[col][j] /= p;
    for (var r = 0; r < 9; r++) {
      if (r !== col) {
        var f = M[r][col];
        for (var j = col; j <= 9; j++) M[r][j] -= f * M[col][j];
      }
    }
  }
  return M.map(function(r) { return r[9]; });
}

function warpImage(img, pts, outW, outH) {
  var srcPts = pts.map(function(p) { return [p.x, p.y]; });
  var dstPts = [[0,0],[outW,0],[outW,outH],[0,outH]];
  var H = solvePerspective(dstPts, srcPts);
  var c = document.getElementById('c');
  c.width = outW; c.height = outH;
  var ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  var tCanvas = document.createElement('canvas');
  tCanvas.width = img.width; tCanvas.height = img.height;
  var tCtx = tCanvas.getContext('2d');
  tCtx.drawImage(img, 0, 0);
  var srcData = tCtx.getImageData(0, 0, img.width, img.height);
  var d = new Uint8ClampedArray(outW * outH * 4);
  for (var y = 0; y < outH; y++) {
    for (var x = 0; x < outW; x++) {
      var den = H[6]*x + H[7]*y + H[8];
      var sx = (H[0]*x + H[1]*y + H[2]) / den;
      var sy = (H[3]*x + H[4]*y + H[5]) / den;
      var ix = Math.floor(sx), iy = Math.floor(sy);
      if (ix >= 0 && ix < img.width-1 && iy >= 0 && iy < img.height-1) {
        var fx = sx - ix, fy = sy - iy;
        var off = (iy * img.width + ix) * 4;
        for (var c = 0; c < 4; c++) {
          var a = srcData.data[off + c];
          var b = srcData.data[off + 4 + c];
          var c0 = srcData.data[off + img.width*4 + c];
          var d0 = srcData.data[off + img.width*4 + 4 + c];
          var top = a + (b - a) * fx;
          var bot = c0 + (d0 - c0) * fx;
          d[(y * outW + x) * 4 + c] = top + (bot - top) * fy;
        }
      }
    }
  }
  var outImg = new ImageData(d, outW, outH);
  ctx.putImageData(outImg, 0, 0);
  return c.toDataURL('image/jpeg', 0.92);
}

window.addEventListener('message', async function(e) {
  try {
    var data = JSON.parse(e.data);
    if (data.type === 'warp') {
      var img = new Image();
      img.onload = function() {
        var result = warpImage(img, data.corners, data.outW || data.outH, data.outH);
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'result', data: result}));
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
</body>
</html>
`;

let processorPromise = null;
let processorResolve = null;
let processorReject = null;
let processorReady = false;

export function usePerspectiveProcessor() {
  const [ready, setReady] = useState(false);
  const webViewRef = useRef(null);
  const messageHandlerRef = useRef(null);

  useEffect(() => {
    processorReady = false;
    return () => {
      processorReady = false;
    };
  }, []);

  const onMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready') {
        processorReady = true;
        setReady(true);
      } else if (msg.type === 'result') {
        if (processorResolve) {
          processorResolve(msg.data);
          processorResolve = null;
        }
      } else if (msg.type === 'error') {
        if (processorReject) {
          processorReject(new Error(msg.msg));
          processorReject = null;
        }
      }
    } catch (e) {}
  }, []);

  const correctPerspective = useCallback(async (imageUri, corners, outputSize) => {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return new Promise((resolve, reject) => {
      if (!webViewRef.current || !processorReady) {
        reject(new Error('Processor not ready'));
        return;
      }

      const timer = setTimeout(() => reject(new Error('Timeout')), 30000);
      processorResolve = (data) => { clearTimeout(timer); resolve(data); };
      processorReject = (err) => { clearTimeout(timer); reject(err); };

      webViewRef.current.postMessage(JSON.stringify({
        type: 'warp',
        imageBase64: base64,
        corners: corners,
        outW: outputSize,
        outH: outputSize,
      }));
    });
  }, []);

  const processorComponent = (
    <View style={{ width: 0, height: 0, overflow: 'hidden', position: 'absolute', top: -999, left: -999 }}>
      <WebView
        ref={webViewRef}
        source={{ html: WARP_HTML }}
        onMessage={onMessage}
        javaScriptEnabled={true}
        style={{ width: 1, height: 1 }}
        originWhitelist={['*']}
      />
    </View>
  );

  return { ready, correctPerspective, processorComponent };
}
