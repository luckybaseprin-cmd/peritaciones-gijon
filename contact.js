document.addEventListener('DOMContentLoaded', () => {
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzZVEv1Ooaez7uVNx1mNbgnkoCg_EObpCEqh4OsMP7vh4_iaH5K7dN-QlF8lwM1-bLd/exec';
  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
  const MAX_TOTAL_FILES_BYTES = 15 * 1024 * 1024;
  const ALLOWED_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'];

  const brandSelect = document.getElementById('carBrand');
  const modelSelect = document.getElementById('carModel');
  const fileDropZone = document.getElementById('fileDropZone');
  const fileInput = document.getElementById('fileInput');
  const fileList = document.getElementById('fileList');
  const contactForm = document.getElementById('contactForm');

  let carData = {};
  let uploadedFiles = [];

  fetch('car_data.json')
    .then((response) => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    })
    .then((data) => {
      carData = data.brands;
      populateBrands();
    })
    .catch((error) => {
      console.error('Error fetching car data:', error);
      brandSelect.innerHTML = '<option value="">Error cargando marcas</option>';
    });

  function populateBrands() {
    const brands = Object.keys(carData).sort();
    let options = '<option value="" disabled selected>Selecciona Marca...</option>';

    brands.forEach((brand) => {
      options += `<option value="${brand}">${brand}</option>`;
    });

    brandSelect.innerHTML = options;
  }

  brandSelect.addEventListener('change', (e) => {
    const selectedBrand = e.target.value;
    modelSelect.innerHTML = '<option value="" disabled selected>Cargando modelos...</option>';

    if (selectedBrand && carData[selectedBrand]) {
      const models = carData[selectedBrand].sort();
      let options = '<option value="" disabled selected>Selecciona Modelo...</option>';

      models.forEach((model) => {
        options += `<option value="${model}">${model}</option>`;
      });

      modelSelect.innerHTML = options;
      modelSelect.disabled = false;
    } else {
      modelSelect.innerHTML = '<option value="" disabled selected>Primero selecciona una marca</option>';
      modelSelect.disabled = true;
    }
  });

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
    fileDropZone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach((eventName) => {
    fileDropZone.addEventListener(eventName, () => {
      fileDropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    fileDropZone.addEventListener(eventName, () => {
      fileDropZone.classList.remove('dragover');
    }, false);
  });

  fileDropZone.addEventListener('drop', handleDrop, false);

  fileInput.addEventListener('change', function onFileChange() {
    handleFiles(this.files);
  });

  function handleDrop(e) {
    handleFiles(e.dataTransfer.files);
  }

  function handleFiles(files) {
    const rejectedFiles = [];
    let currentTotalBytes = getTotalFileSizeBytes();

    [...files].forEach((file) => {
      const ext = (file.name.split('.').pop() || '').toLowerCase();

      if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
        rejectedFiles.push(`${file.name}: formato no permitido`);
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        rejectedFiles.push(`${file.name}: supera 10 MB`);
        return;
      }

      if (currentTotalBytes + file.size > MAX_TOTAL_FILES_BYTES) {
        rejectedFiles.push(`${file.name}: supera el limite total de 15 MB`);
        return;
      }

      uploadedFiles.push(file);
      currentTotalBytes += file.size;
    });

    if (rejectedFiles.length) {
      showSubmitError(`Algunos archivos no se han anadido: ${rejectedFiles.join(' | ')}`);
    } else {
      clearSubmitError();
    }

    fileInput.value = '';
    renderFileList();
  }

  function renderFileList() {
    fileList.innerHTML = '';

    uploadedFiles.forEach((file, index) => {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const fileEl = document.createElement('div');
      fileEl.className = 'file-item reveal active';
      fileEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.5rem">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
            <polyline points="13 2 13 9 20 9"></polyline>
          </svg>
          <span>${file.name}</span>
          <span style="color:var(--text-muted); font-size:0.75rem;">(${sizeMB} MB)</span>
        </div>
        <button type="button" class="file-remove" data-index="${index}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;
      fileList.appendChild(fileEl);
    });

    document.querySelectorAll('.file-remove').forEach((btn) => {
      btn.addEventListener('click', function removeFile() {
        const index = Number(this.getAttribute('data-index'));
        uploadedFiles.splice(index, 1);
        renderFileList();
      });
    });
  }

  function getTotalFileSizeBytes() {
    return uploadedFiles.reduce((total, file) => total + file.size, 0);
  }

  function fileToAttachmentPayload(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const commaPos = dataUrl.indexOf(',');
        const contentBase64 = commaPos >= 0 ? dataUrl.slice(commaPos + 1) : '';

        resolve({
          name: file.name,
          type: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          sizeMB: Number((file.size / (1024 * 1024)).toFixed(2)),
          contentBase64
        });
      };

      reader.onerror = () => reject(new Error(`No se pudo leer el archivo: ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  async function buildPayload() {
    const serviceSelect = document.getElementById('serviceType');
    const selectedServiceText = serviceSelect.options[serviceSelect.selectedIndex]?.text || '';
    const files = await Promise.all(uploadedFiles.map((file) => fileToAttachmentPayload(file)));

    return {
      source: 'web-contacto',
      timestamp: new Date().toISOString(),
      name: document.getElementById('name').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      email: document.getElementById('email').value.trim(),
      carBrand: brandSelect.value,
      carModel: modelSelect.value,
      matricula: document.getElementById('matricula').value.trim(),
      year: document.getElementById('year').value.trim(),
      serviceType: serviceSelect.value,
      serviceTypeLabel: selectedServiceText,
      message: document.getElementById('message').value.trim(),
      privacyAccepted: document.getElementById('privacy').checked,
      files
    };
  }

  async function sendToAppsScript(payload) {
    if (APPS_SCRIPT_URL.includes('TU_DEPLOYMENT_ID')) {
      throw new Error('Configura tu URL de Google Apps Script en contact.js');
    }

    const body = JSON.stringify(payload);
    const isNetworkError = (error) => {
      const msg = String((error && error.message) || error || '').toLowerCase();
      return msg.includes('failed to fetch')
        || msg.includes('networkerror')
        || msg.includes('load failed');
    };

    const sendViaHiddenForm = (payloadForForm) => new Promise((resolve, reject) => {
      const iframeName = `gas_submit_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const iframe = document.createElement('iframe');
      const form = document.createElement('form');
      const payloadInput = document.createElement('input');
      let settled = false;
      let submitted = false;

      const cleanup = () => {
        form.remove();
        iframe.remove();
      };

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Timeout al enviar por formulario oculto'));
      }, 12000);

      iframe.name = iframeName;
      iframe.style.display = 'none';
      iframe.addEventListener('load', () => {
        if (!submitted || settled) return;
        settled = true;
        clearTimeout(timeout);
        cleanup();
        resolve();
      });
      iframe.addEventListener('error', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        cleanup();
        reject(new Error('Error de carga en iframe de envio'));
      });

      form.method = 'POST';
      form.action = APPS_SCRIPT_URL;
      form.target = iframeName;
      form.style.display = 'none';

      payloadInput.type = 'hidden';
      payloadInput.name = 'payload';
      payloadInput.value = JSON.stringify(payloadForForm);
      form.appendChild(payloadInput);

      document.body.appendChild(iframe);
      document.body.appendChild(form);
      submitted = true;
      form.submit();
    });

    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          // text/plain evita preflight CORS en la mayoria de navegadores.
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body
      });

      const responseText = await response.text();
      let result = null;

      try {
        result = responseText ? JSON.parse(responseText) : null;
      } catch (parseError) {
        result = null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText || 'respuesta no valida'}`);
      }

      if (!result || result.ok !== true) {
        const detail = result && result.error ? ` (${result.error})` : '';
        throw new Error(`Apps Script no confirmo el envio${detail}`);
      }
    } catch (error) {
      if (!isNetworkError(error)) {
        throw error;
      }

      try {
        // Fallback para entornos donde CORS bloquea la lectura de respuesta,
        // pero el POST puede entregarse correctamente al Apps Script.
        await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body
        });
      } catch (fallbackError) {
        try {
          await sendViaHiddenForm(payload);
        } catch (formError) {
          throw new Error(`Fallo de red al enviar (${formError.message || fallbackError.message || fallbackError})`);
        }
      }
    }
  }

  function renderSuccessState() {
    contactForm.innerHTML = `
      <div style="text-align:center; padding: 2rem;">
        <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(16,185,129,0.1); color: var(--accent-emerald); display:flex; align-items:center; justify-content:center; margin: 0 auto 1.5rem;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="30" height="30"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h3 style="font-size:1.5rem; margin-bottom: 1rem;">Solicitud enviada</h3>
        <p style="color:var(--text-muted)">Hemos recibido tu solicitud correctamente y te responderemos lo antes posible.</p>
      </div>
    `;
  }

  function showSubmitError(message) {
    let errorBox = document.getElementById('formErrorBox');
    if (!errorBox) {
      errorBox = document.createElement('div');
      errorBox.id = 'formErrorBox';
      errorBox.style.cssText = 'margin-top:1rem; padding:0.85rem 1rem; border-radius:10px; background:rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.35); color:#fecaca; font-size:.9rem;';
      contactForm.appendChild(errorBox);
    }
    errorBox.textContent = message;
  }

  function clearSubmitError() {
    const errorBox = document.getElementById('formErrorBox');
    if (errorBox) {
      errorBox.remove();
    }
  }

  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = 'Enviando...';
      submitBtn.disabled = true;

      try {
        clearSubmitError();
        const payload = await buildPayload();
        await sendToAppsScript(payload);
        renderSuccessState();
      } catch (error) {
        console.error('Error enviando formulario:', error);
        const detalle = error && error.message ? ` Detalle: ${error.message}` : '';
        showSubmitError(`No se pudo enviar en este momento.${detalle}`);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    });
  }
});
