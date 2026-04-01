// js/contact.js

document.addEventListener('DOMContentLoaded', () => {
  const brandSelect = document.getElementById('carBrand');
  const modelSelect = document.getElementById('carModel');
  const fileDropZone = document.getElementById('fileDropZone');
  const fileInput = document.getElementById('fileInput');
  const fileList = document.getElementById('fileList');
  
  let carData = {};

  // 1. Fetch JSON Data
  fetch('car_data.json')
    .then(response => {
      if(!response.ok) throw new Error('Network response was not ok');
      return response.json();
    })
    .then(data => {
      carData = data.brands; // the top level object has "brands"
      populateBrands();
    })
    .catch(error => {
      console.error('Error fetching car data:', error);
      brandSelect.innerHTML = '<option value="">Error cargando marcas</option>';
    });

  // 2. Populate Brands Dropdown
  function populateBrands() {
    const brands = Object.keys(carData).sort();
    let options = '<option value="" disabled selected>Selecciona Marca...</option>';
    brands.forEach(brand => {
      options += `<option value="${brand}">${brand}</option>`;
    });
    brandSelect.innerHTML = options;
  }

  // 3. Handle Brand Change -> Populate Models
  brandSelect.addEventListener('change', (e) => {
    const selectedBrand = e.target.value;
    modelSelect.innerHTML = '<option value="" disabled selected>Cargando modelos...</option>';
    
    if (selectedBrand && carData[selectedBrand]) {
      const models = carData[selectedBrand].sort();
      let options = '<option value="" disabled selected>Selecciona Modelo...</option>';
      models.forEach(model => {
        options += `<option value="${model}">${model}</option>`;
      });
      modelSelect.innerHTML = options;
      modelSelect.disabled = false;
    } else {
      modelSelect.innerHTML = '<option value="" disabled selected>Primero selecciona una marca</option>';
      modelSelect.disabled = true;
    }
  });

  // 4. File Drag and Drop Logic
  let uploadedFiles = [];

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    fileDropZone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    fileDropZone.addEventListener(eventName, () => {
      fileDropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    fileDropZone.addEventListener(eventName, () => {
      fileDropZone.classList.remove('dragover');
    }, false);
  });

  fileDropZone.addEventListener('drop', handleDrop, false);
  
  // click directly on input inside dropzone
  fileInput.addEventListener('change', function(e) {
    handleFiles(this.files);
  });

  function handleDrop(e) {
    let dt = e.dataTransfer;
    let files = dt.files;
    handleFiles(files);
  }

  function handleFiles(files) {
    ([...files]).forEach(file => {
      uploadedFiles.push(file);
    });
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

    // attach remove handlers
    document.querySelectorAll('.file-remove').forEach(btn => {
      btn.addEventListener('click', function() {
        const i = parseInt(this.getAttribute('data-index'));
        uploadedFiles.splice(i, 1);
        renderFileList(); // re-render
      });
    });
  }

  // 5. Form Submission (Demo)
  const contactForm = document.getElementById('contactForm');
  if(contactForm) {
      contactForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const submitBtn = contactForm.querySelector('button[type="submit"]');
          const originalText = submitBtn.innerHTML;
          submitBtn.innerHTML = 'Enviando...';
          submitBtn.disabled = true;

          // Simulando envío
          setTimeout(() => {
              contactForm.innerHTML = `
                  <div style="text-align:center; padding: 2rem;">
                      <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(16,185,129,0.1); color: var(--accent-emerald); display:flex; align-items:center; justify-content:center; margin: 0 auto 1.5rem;">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="30" height="30"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      <h3 style="font-size:1.5rem; margin-bottom: 1rem;">¡Mensaje Enviado!</h3>
                      <p style="color:var(--text-muted)">Hemos recibido tu solicitud correctamente. Nos pondremos en contacto contigo lo antes posible para proceder con tu caso.</p>
                  </div>
              `;
          }, 1500);
      });
  }
});
