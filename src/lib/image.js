// Compresión de imágenes en el cliente antes de subir (conectividad rural).
// Redimensiona el lado mayor a maxDim y recomprime a JPEG. Los PDFs pasan sin tocar.
export async function compressImage(file, { maxDim = 1600, quality = 0.7 } = {}) {
  if (!file.type.startsWith('image/')) return file; // PDF u otros: sin cambios
  if (file.type === 'image/heic' || file.type === 'image/heif') return file; // el navegador no decodifica HEIC

  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob || blob.size >= file.size) return file; // no ganamos nada: usa el original
  return new File([blob], renameJpeg(file.name), { type: 'image/jpeg' });
}

function readAsDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
function renameJpeg(name) {
  return (name || 'foto').replace(/\.[^.]+$/, '') + '.jpg';
}
