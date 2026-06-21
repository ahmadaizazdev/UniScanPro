/**
 * UniScan Pro - Student Barcode Generator
 * WITH TRANSPARENT BACKGROUND & CRISP IMAGES
 */

// ==================== DEFAULT SETTINGS ====================
let settings = {
  codeType: 'barcode',
  barcodeWidth: 1.5,
  barcodeHeight: 35,
  barcodeMargin: 5,
  barcodeFontSize: 8,
  qrSize: 100
};

// ==================== STATE ====================
let gallery = JSON.parse(localStorage.getItem('barcode_gallery') || '[]');
let bulkData = [];
let bulkItems = [];
let currentText = '';

// ==================== HELPER FUNCTIONS ====================
function showToast(msg) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

function getFileName(text) {
  let clean = String(text).substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
  if (!clean) clean = 'code';
  return `${clean}_${settings.codeType}.png`;
}

// FIXED: Crisp, clear SVG to PNG conversion with TRANSPARENT background
async function svgToPngBlob(svgElement) {
  return new Promise((resolve) => {
    try {
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svgElement);
      
      if (!svgString.includes('xmlns')) {
        svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      
      let width = parseInt(svgElement.getAttribute('width')) || 300;
      let height = parseInt(svgElement.getAttribute('height')) || 100;
      
      // 4x scale for crisp output
      const scale = 4;
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      const img = new Image();
      
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(resolve, 'image/png');
      };
      
      img.onerror = (err) => {
        console.error('SVG to PNG error:', err);
        resolve(null);
      };
      
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
    } catch (err) {
      console.error('svgToPngBlob error:', err);
      resolve(null);
    }
  });
}

// FIXED: Crisp, clear QR to PNG conversion with TRANSPARENT background
async function qrToPngBlob(qrContainer) {
  return new Promise((resolve) => {
    try {
      const svg = qrContainer.querySelector('svg');
      if (!svg) {
        resolve(null);
        return;
      }
      
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svg);
      
      if (!svgString.includes('xmlns')) {
        svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      
      let width = parseInt(svg.getAttribute('width')) || settings.qrSize;
      let height = parseInt(svg.getAttribute('height')) || settings.qrSize;
      
      // 4x scale for crisp output
      const scale = 4;
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      const img = new Image();
      
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(resolve, 'image/png');
      };
      
      img.onerror = () => resolve(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
    } catch (err) {
      console.error('qrToPngBlob error:', err);
      resolve(null);
    }
  });
}

function createShortContent(row) {
  const values = [];
  for (let key of Object.keys(row)) {
    const value = row[key];
    if (value && String(value).trim() !== '') {
      let cleanValue = String(value).trim().replace(/\s+/g, '');
      if (cleanValue.length > 15) cleanValue = cleanValue.substring(0, 12);
      values.push(cleanValue);
    }
  }
  let result = values.join('|');
  if (result.length > 60) result = result.substring(0, 57) + '...';
  return result;
}

async function renderCode(containerId, text) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  container.innerHTML = '';
  
  if (settings.codeType === 'barcode') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '250');
    svg.setAttribute('height', '80');
    JsBarcode(svg, text, { 
      format: 'CODE128',
      width: settings.barcodeWidth,
      height: settings.barcodeHeight,
      displayValue: true,
      fontSize: settings.barcodeFontSize,
      margin: settings.barcodeMargin,
      background: 'transparent',
      lineColor: '#000000'
    });
    container.appendChild(svg);
    return svg;
  } else {
    const qrContainer = document.createElement('div');
    qrContainer.style.display = 'flex';
    qrContainer.style.justifyContent = 'center';
    container.appendChild(qrContainer);
    return new Promise((resolve) => {
      new QRCode(qrContainer, {
        text: text,
        width: settings.qrSize,
        height: settings.qrSize,
        colorDark: '#000000',
        colorLight: 'transparent'
      });
      setTimeout(() => resolve(qrContainer), 100);
    });
  }
}

// ==================== TOGGLE CODE TYPE ====================
function toggleCodeType() {
  settings.codeType = settings.codeType === 'barcode' ? 'qrcode' : 'barcode';
  showToast(`Switched to ${settings.codeType === 'barcode' ? 'Barcode' : 'QR Code'} mode`);
}

// ==================== BULK DOWNLOAD FUNCTIONS ====================
async function downloadAllZip() {
  if (!bulkItems.length) { showToast('No codes to download'); return; }
  showToast(`Preparing ${bulkItems.length} items...`);
  const zip = new JSZip();
  
  for (let i = 0; i < bulkItems.length; i++) {
    const item = bulkItems[i];
    let blob;
    if (item.type === 'barcode') {
      blob = await svgToPngBlob(item.codeElement);
    } else {
      blob = await qrToPngBlob(item.codeElement);
    }
    if (blob) {
      zip.file(getFileName(item.name), blob);
    }
    await new Promise(r => setTimeout(r, 10));
  }
  
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, 'all_codes.zip');
  showToast(`Downloaded all ${bulkItems.length} codes`);
}

async function downloadSelected() {
  const selected = bulkItems.filter(i => i.selected);
  if (!selected.length) { showToast('No items selected'); return; }
  
  showToast(`Preparing ${selected.length} items...`);
  const zip = new JSZip();
  
  for (let i = 0; i < selected.length; i++) {
    const item = selected[i];
    let blob;
    if (item.type === 'barcode') {
      blob = await svgToPngBlob(item.codeElement);
    } else {
      blob = await qrToPngBlob(item.codeElement);
    }
    if (blob) {
      zip.file(getFileName(item.name), blob);
    }
    await new Promise(r => setTimeout(r, 10));
  }
  
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, 'selected_codes.zip');
  showToast(`Downloaded ${selected.length} codes`);
}

async function downloadSingleBulk(idx) {
  const item = bulkItems[idx];
  let blob;
  if (item.type === 'barcode') {
    blob = await svgToPngBlob(item.codeElement);
  } else {
    blob = await qrToPngBlob(item.codeElement);
  }
  if (blob) {
    saveAs(blob, getFileName(item.name));
    showToast('Downloaded!');
  } else {
    showToast('Download failed!');
  }
}

function selectAllBulk() {
  bulkItems.forEach(i => i.selected = true);
  renderBulkGrid();
  showToast(`Selected all ${bulkItems.length} items`);
}

function deselectAllBulk() {
  bulkItems.forEach(i => i.selected = false);
  renderBulkGrid();
  showToast('Deselected all');
}

function updateSelectedButton() {
  const count = bulkItems.filter(i => i.selected).length;
  const btn = document.getElementById('downloadSelectedBtn');
  if (btn) {
    if (count > 0) {
      btn.style.display = 'inline-flex';
      btn.innerHTML = `Download Selected (${count})`;
    } else {
      btn.style.display = 'none';
    }
  }
}

// ==================== RENDER BULK GRID ====================
function renderBulkGrid() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const filtered = bulkItems.filter(item => item.name.toLowerCase().includes(searchTerm));
  const grid = document.getElementById('barcodeGrid');
  grid.innerHTML = '';
  
  filtered.forEach((item, idx) => {
    const originalIdx = bulkItems.indexOf(item);
    const card = document.createElement('div');
    card.className = 'barcode-card' + (item.selected ? ' selected' : '');
    card.setAttribute('data-idx', originalIdx);
    card.innerHTML = `
      <div class="barcode-preview" id="bulk-preview-${originalIdx}" style="padding: 8px; display: flex; justify-content: center; min-height: 100px; align-items: center;"></div>
      <div class="student-name">${escapeHtml(item.name)}</div>
      <div class="student-meta">${item.id ? 'ID: ' + escapeHtml(String(item.id).substring(0, 12)) : ''}</div>
      <div class="student-meta" style="color: var(--primary);">${item.type === 'barcode' ? 'Barcode' : 'QR Code'}</div>
      <label class="checkbox-label">
        <input type="checkbox" class="bulk-check" data-idx="${originalIdx}" ${item.selected ? 'checked' : ''}>
        <span>Select</span>
      </label>
      <div class="card-actions">
        <button class="btn btn-secondary btn-sm single-download" data-idx="${originalIdx}">Download</button>
        <button class="btn btn-primary btn-sm single-save" data-idx="${originalIdx}">Save</button>
      </div>
    `;
    const previewDiv = card.querySelector(`#bulk-preview-${originalIdx}`);
    if (item.codeElement) {
      previewDiv.appendChild(item.codeElement.cloneNode(true));
    }
    grid.appendChild(card);
  });
  
  document.querySelectorAll('.bulk-check').forEach(cb => {
    cb.onchange = (e) => { 
      const idx = parseInt(e.target.dataset.idx);
      bulkItems[idx].selected = e.target.checked; 
      updateSelectedButton(); 
    };
  });
  
  document.querySelectorAll('.single-download').forEach(btn => {
    btn.onclick = async (e) => {
      const idx = parseInt(e.target.closest('button').dataset.idx);
      await downloadSingleBulk(idx);
    };
  });
  
  document.querySelectorAll('.single-save').forEach(btn => {
    btn.onclick = (e) => {
      const idx = parseInt(e.target.closest('button').dataset.idx);
      const item = bulkItems[idx];
      gallery.push({ text: item.content, name: item.name, date: new Date().toISOString(), type: item.type });
      localStorage.setItem('barcode_gallery', JSON.stringify(gallery));
      showToast('Saved to gallery!');
      renderGallery();
    };
  });
  
  updateSelectedButton();
}

// ==================== MANUAL SECTION ====================
document.getElementById('generateBtn').onclick = async function() {
  const text = document.getElementById('manualTextInput').value.trim();
  if (!text) { showToast('Please enter text'); return; }
  
  let shortText = text.replace(/\s+/g, ' ');
  if (shortText.length > 50) shortText = shortText.substring(0, 47) + '...';
  currentText = text;
  
  document.getElementById('previewEmpty').style.display = 'none';
  document.getElementById('previewContent').style.display = 'block';
  document.getElementById('previewContent').innerHTML = `
    <div class="barcode-render-card">
      <div id="manualCodeDisplay" style="display: flex; justify-content: center; min-height: 130px; align-items: center;"></div>
      <div style="margin: 12px 0; font-size: 9px; color: #666; word-break: break-all;">${escapeHtml(text)}</div>
      <div style="display: flex; gap: 8px; justify-content: center;">
        <button class="btn btn-secondary btn-sm" id="downloadManualBtn">Download</button>
        <button class="btn btn-secondary btn-sm" id="printManualBtn">Print</button>
        <button class="btn btn-primary btn-sm" id="saveManualBtn">Save</button>
      </div>
    </div>
  `;
  
  await renderCode('manualCodeDisplay', shortText);
  
  document.getElementById('downloadManualBtn').onclick = async () => {
    const container = document.getElementById('manualCodeDisplay');
    let blob;
    if (settings.codeType === 'barcode') {
      const svg = container.querySelector('svg');
      if (svg) blob = await svgToPngBlob(svg);
    } else {
      blob = await qrToPngBlob(container);
    }
    if (blob) {
      saveAs(blob, getFileName(currentText));
      showToast('Downloaded!');
    } else {
      showToast('Download failed!');
    }
  };
  
  document.getElementById('printManualBtn').onclick = () => {
    const win = window.open('', '_blank');
    if (settings.codeType === 'barcode') {
      win.document.write(`
        <html><head><title>Print</title><style>body{text-align:center;padding:20px;}</style></head>
        <body onload="window.print()"><div id="printArea"></div><script>
          var s = document.createElementNS('http://www.w3.org/2000/svg','svg');
          JsBarcode(s, '${shortText.replace(/'/g, "\\'")}', {width:${settings.barcodeWidth}, height:${settings.barcodeHeight}, background:'transparent'});
          document.getElementById('printArea').appendChild(s);
        <\/script></body></html>
      `);
    } else {
      win.document.write(`
        <html><head><title>Print QR</title><style>body{text-align:center;padding:20px;}</style>
        <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script></head>
        <body onload="new QRCode(document.getElementById('printArea'), {text: '${shortText.replace(/'/g, "\\'")}', width: ${settings.qrSize}, height: ${settings.qrSize}, colorLight: 'transparent'}); window.print();">
        <div id="printArea"></div></body></html>
      `);
    }
  };
  
  document.getElementById('saveManualBtn').onclick = () => {
    gallery.push({ text: shortText, name: text.substring(0, 25), date: new Date().toISOString(), type: settings.codeType });
    localStorage.setItem('barcode_gallery', JSON.stringify(gallery));
    showToast('Saved!');
    renderGallery();
  };
  
  showToast(`${settings.codeType === 'barcode' ? 'Barcode' : 'QR Code'} generated!`);
};

document.getElementById('clearManualBtn').onclick = function() {
  document.getElementById('manualTextInput').value = '';
  document.getElementById('previewEmpty').style.display = 'flex';
  document.getElementById('previewContent').style.display = 'none';
};

// ==================== EXCEL UPLOAD ====================
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

dropZone.onclick = () => fileInput.click();
dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; };
dropZone.ondragleave = () => dropZone.style.borderColor = '';
dropZone.ondrop = (e) => {
  e.preventDefault();
  dropZone.style.borderColor = '';
  if (e.dataTransfer.files[0]) processExcelFile(e.dataTransfer.files[0]);
};
fileInput.onchange = (e) => { if (e.target.files[0]) processExcelFile(e.target.files[0]); };

function processExcelFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);
    if (!json.length) { showToast('File is empty'); return; }
    
    bulkData = json;
    const headers = Object.keys(json[0]);
    let tableHtml = '<div style="overflow-x: auto;"><table style="width: 100%;">';
    tableHtml += '<thead><tr>' + headers.map(h => `<th style="padding: 8px; font-size: 11px;">${escapeHtml(h)}</th>`).join('') + '</thead><tbody>';
    json.slice(0, 6).forEach(row => {
      tableHtml += '<tr>' + headers.map(h => `<td style="padding: 6px; font-size: 10px;">${escapeHtml(String(row[h] || '').substring(0, 15))}</td>`).join('') + '</tr>';
    });
    tableHtml += `</tbody>${json.length > 6 ? `<p>+ ${json.length - 6} more</p>` : ''}</div>`;
    
    document.getElementById('previewTable').innerHTML = tableHtml;
    document.getElementById('previewCard').style.display = 'block';
    document.getElementById('resultsDiv').style.display = 'none';
    showToast(`Loaded ${json.length} records`);
  };
  reader.readAsArrayBuffer(file);
}

// ==================== BULK GENERATION ====================
document.getElementById('generateBulkBtn').onclick = async function() {
  if (!bulkData.length) { showToast('Upload Excel file first'); return; }
  
  const format = document.getElementById('bulkFormatSelect').value;
  const progressDiv = document.getElementById('progressDiv');
  const progressFill = document.getElementById('progressFill');
  const progressMsg = document.getElementById('progressMsg');
  
  progressDiv.style.display = 'block';
  bulkItems = [];
  
  for (let i = 0; i < bulkData.length; i++) {
    const row = bulkData[i];
    let shortContent = createShortContent(row);
    let codeElement = null;
    
    if (settings.codeType === 'barcode') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '200');
      svg.setAttribute('height', '60');
      JsBarcode(svg, shortContent, { 
        format: format,
        width: settings.barcodeWidth,
        height: settings.barcodeHeight,
        displayValue: true,
        fontSize: settings.barcodeFontSize,
        margin: settings.barcodeMargin,
        background: 'transparent',
        lineColor: '#000000'
      });
      codeElement = svg;
    } else {
      const qrContainer = document.createElement('div');
      new QRCode(qrContainer, {
        text: shortContent,
        width: settings.qrSize,
        height: settings.qrSize,
        colorDark: '#000000',
        colorLight: 'transparent'
      });
      await new Promise(r => setTimeout(r, 50));
      codeElement = qrContainer;
    }
    
    let name = '';
    for (let key of Object.keys(row)) {
      if (key.toLowerCase().includes('name')) { name = row[key]; break; }
    }
    if (!name) name = Object.values(row)[0] || 'Student';
    name = String(name).substring(0, 20);
    
    let idValue = '';
    for (let key of Object.keys(row)) {
      if (key.toLowerCase().includes('id') || key.toLowerCase().includes('roll')) { idValue = row[key]; break; }
    }
    
    bulkItems.push({ 
      codeElement: codeElement,
      selected: false, 
      name: name,
      id: idValue,
      content: shortContent,
      type: settings.codeType
    });
    
    const percent = ((i + 1) / bulkData.length) * 100;
    progressFill.style.width = percent + '%';
    progressMsg.innerText = `${i + 1}/${bulkData.length}: ${name}`;
    await new Promise(r => setTimeout(r, 5));
  }
  
  progressDiv.style.display = 'none';
  renderBulkGrid();
  document.getElementById('resultsDiv').style.display = 'block';
  showToast(`Generated ${bulkItems.length} codes!`);
};

// ==================== ATTACH BULK BUTTON EVENTS ====================
document.getElementById('selectAllBtn').onclick = () => selectAllBulk();
document.getElementById('deselectAllBtn').onclick = () => deselectAllBulk();
document.getElementById('downloadSelectedBtn').onclick = () => downloadSelected();
document.getElementById('downloadAllZipBtn').onclick = () => downloadAllZip();
document.getElementById('searchInput').oninput = () => renderBulkGrid();

// ==================== GALLERY ====================
function renderGallery() {
  const searchTerm = document.getElementById('gallerySearchInput').value.toLowerCase();
  const filtered = gallery.filter(g => g.name.toLowerCase().includes(searchTerm));
  const grid = document.getElementById('galleryGrid');
  const empty = document.getElementById('galleryEmpty');
  
  if (!filtered.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = '';
  
  filtered.forEach((item, idx) => {
    const originalIdx = gallery.indexOf(item);
    const previewDiv = document.createElement('div');
    previewDiv.className = 'barcode-preview';
    previewDiv.style.padding = '8px';
    previewDiv.style.display = 'flex';
    previewDiv.style.justifyContent = 'center';
    previewDiv.style.minHeight = '100px';
    previewDiv.style.alignItems = 'center';
    
    if (item.type === 'qrcode') {
      new QRCode(previewDiv, { text: item.text, width: 80, height: 80, colorLight: 'transparent' });
    } else {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '160');
      svg.setAttribute('height', '45');
      JsBarcode(svg, item.text, { format: 'CODE128', width: 1.3, height: 30, background: 'transparent' });
      previewDiv.appendChild(svg);
    }
    
    const card = document.createElement('div');
    card.className = 'barcode-card';
    card.appendChild(previewDiv);
    
    const nameDiv = document.createElement('div');
    nameDiv.className = 'student-name';
    nameDiv.style.fontSize = '12px';
    nameDiv.innerText = escapeHtml(item.name);
    card.appendChild(nameDiv);
    
    const typeDiv = document.createElement('div');
    typeDiv.className = 'student-meta';
    typeDiv.style.fontSize = '9px';
    typeDiv.style.color = 'var(--primary)';
    typeDiv.innerText = item.type === 'qrcode' ? 'QR Code' : 'Barcode';
    card.appendChild(typeDiv);
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'card-actions';
    actionsDiv.innerHTML = `
      <button class="btn btn-secondary btn-sm gallery-download" data-idx="${originalIdx}">Download</button>
      <button class="btn btn-danger btn-sm gallery-remove" data-idx="${originalIdx}">Remove</button>
    `;
    card.appendChild(actionsDiv);
    grid.appendChild(card);
  });
  
  document.querySelectorAll('.gallery-download').forEach(btn => {
    btn.onclick = async (e) => {
      const idx = parseInt(e.target.closest('button').dataset.idx);
      const item = gallery[idx];
      const container = document.createElement('div');
      if (item.type === 'qrcode') {
        new QRCode(container, { text: item.text, width: 150, height: 150, colorLight: 'transparent' });
        await new Promise(r => setTimeout(r, 100));
        const blob = await qrToPngBlob(container);
        if (blob) saveAs(blob, getFileName(item.name));
      } else {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '180');
        svg.setAttribute('height', '55');
        JsBarcode(svg, item.text, { format: 'CODE128', width: 1.5, height: 35, background: 'transparent' });
        const blob = await svgToPngBlob(svg);
        if (blob) saveAs(blob, getFileName(item.name));
      }
      showToast('Downloaded!');
    };
  });
  
  document.querySelectorAll('.gallery-remove').forEach(btn => {
    btn.onclick = (e) => {
      const idx = parseInt(e.target.closest('button').dataset.idx);
      gallery.splice(idx, 1);
      localStorage.setItem('barcode_gallery', JSON.stringify(gallery));
      renderGallery();
      showToast('Removed');
    };
  });
}

document.getElementById('clearGalleryBtn').onclick = () => {
  if (confirm('Clear all saved codes?')) {
    gallery = [];
    localStorage.setItem('barcode_gallery', JSON.stringify(gallery));
    renderGallery();
    showToast('Gallery cleared');
  }
};
document.getElementById('gallerySearchInput').oninput = renderGallery;

// ==================== ADD QR TOGGLE TO MANUAL SECTION ====================
const manualActions = document.querySelector('#manual-tab .form-actions');
const toggleManualBtn = document.createElement('button');
toggleManualBtn.className = 'btn btn-secondary';
toggleManualBtn.innerHTML = settings.codeType === 'barcode' ? 'Switch to QR Code' : 'Switch to Barcode';
toggleManualBtn.onclick = () => {
  toggleCodeType();
  toggleManualBtn.innerHTML = settings.codeType === 'barcode' ? 'Switch to QR Code' : 'Switch to Barcode';
  if (document.getElementById('previewContent').style.display !== 'none') {
    document.getElementById('generateBtn').click();
  }
};
manualActions.insertBefore(toggleManualBtn, manualActions.children[1]);

// ==================== NAVIGATION ====================
document.querySelectorAll('.nav-item').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('manual-tab').style.display = 'none';
    document.getElementById('bulk-tab').style.display = 'none';
    document.getElementById('gallery-tab').style.display = 'none';
    document.getElementById(`${tab.dataset.tab}-tab`).style.display = 'block';
    if (tab.dataset.tab === 'gallery') renderGallery();
  };
});

document.getElementById('themeBtn').onclick = () => document.body.classList.toggle('light');
document.getElementById('closeModalBtn').onclick = () => document.getElementById('welcomeModal').style.display = 'none';
document.getElementById('startBtn').onclick = () => document.getElementById('welcomeModal').style.display = 'none';

renderGallery();