const DESTINATARIO = 'contacto@luckybase.es';
const REMITENTE_NOMBRE = 'Web Gijon Peritaciones';
const ZONA_HORARIA = 'Europe/Madrid';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_FILES_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 10;
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function doGet() {
  return jsonOutput_({ ok: true, message: 'Apps Script activo' });
}

function doPost(e) {
  try {
    const data = parseRequestData_(e);

    // Honeypot anti-spam silencioso.
    if (data.company || data.website) {
      return jsonOutput_({ ok: true, message: 'Correo enviado' });
    }

    validateRequiredFields_(data);

    const fecha = Utilities.formatDate(new Date(), ZONA_HORARIA, 'yyyy-MM-dd HH:mm:ss');
    const asunto = buildSubject_(data);
    let attachmentWarning = '';
    let attachments = [];

    try {
      attachments = buildAttachments_(data.files);
    } catch (attachmentError) {
      attachmentWarning = 'Adjuntos no incluidos por error tecnico: ' + String(attachmentError);
    }

    const body = buildTextBody_(data, fecha, attachmentWarning);
    const htmlBody = buildHtmlBody_(data, fecha, attachmentWarning);

    const adminTo = DESTINATARIO;
    if (!EMAIL_REGEX.test(adminTo)) {
      throw new Error('El correo de destino no es valido');
    }

    // Correo principal sin adjuntos ni replyTo para maximizar entregabilidad.
    sendEmail_({
      to: adminTo,
      subject: asunto,
      body: body,
      htmlBody: htmlBody
    });
    Logger.log('Notificacion admin principal enviada a: ' + adminTo);

    // Si hay adjuntos, se envian en un segundo correo independiente.
    if (attachments.length) {
      sendEmail_({
        to: adminTo,
        subject: asunto + ' [Adjuntos]',
        body: 'Se adjuntan archivos de la solicitud de ' + data.name + ' (' + data.email + ').',
        attachments: attachments
      });
      Logger.log('Notificacion admin de adjuntos enviada a: ' + adminTo);
    }

    try {
      sendContactAutoReply_(data);
    } catch (autoReplyError) {
      Logger.log('No se pudo enviar autorespuesta: ' + String(autoReplyError));
    }

    return jsonOutput_({ ok: true, message: 'Correo enviado' });
  } catch (error) {
    Logger.log('Error en doPost: ' + String(error));
    return jsonOutput_({
      ok: false,
      message: 'Error al enviar',
      error: String(error)
    });
  }
}

function parseRequestData_(e) {
  const dataFromPayloadParameter = parsePayloadParameter_(e && e.parameter ? e.parameter : null);

  if (e && e.postData && e.postData.contents) {
    const raw = String(e.postData.contents || '').trim();

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return normalizeData_(parsed);
      } catch (jsonError) {
        if (dataFromPayloadParameter) {
          return dataFromPayloadParameter;
        }
        throw new Error('El cuerpo recibido no es JSON valido');
      }
    }
  }

  if (dataFromPayloadParameter) {
    return dataFromPayloadParameter;
  }

  if (e && e.parameter) {
    return normalizeData_(e.parameter);
  }

  throw new Error('No se recibieron datos en la solicitud');
}

function parsePayloadParameter_(parameter) {
  if (!parameter || !parameter.payload) {
    return null;
  }

  try {
    const parsedPayload = JSON.parse(String(parameter.payload));
    return normalizeData_(parsedPayload);
  } catch (error) {
    throw new Error('El campo payload no es JSON valido');
  }
}

function normalizeData_(input) {
  return {
    source: toText_(input.source),
    originUrl: toText_(input.originUrl),
    timestamp: toText_(input.timestamp),
    name: toText_(input.name),
    phone: toText_(input.phone),
    email: toText_(input.email),
    company: toText_(input.company),
    website: toText_(input.website),
    carBrand: toText_(input.carBrand),
    carModel: toText_(input.carModel),
    matricula: toText_(input.matricula),
    year: toText_(input.year),
    serviceType: toText_(input.serviceType),
    serviceTypeLabel: toText_(input.serviceTypeLabel),
    message: toText_(input.message),
    privacyAccepted: toBoolean_(input.privacyAccepted),
    files: normalizeFiles_(input.files)
  };
}

function normalizeFiles_(files) {
  if (!files) return [];

  if (Array.isArray(files)) {
    return files.map(function(file) {
      const sizeBytes = toNumber_(file.sizeBytes);
      const sizeMB = toNumber_(file.sizeMB);
      const normalizedSizeBytes = sizeBytes > 0
        ? sizeBytes
        : sizeMB > 0
          ? Math.round(sizeMB * 1024 * 1024)
          : 0;

      return {
        name: toText_(file.name),
        sizeBytes: normalizedSizeBytes,
        sizeMB: normalizedSizeBytes > 0 ? Number((normalizedSizeBytes / (1024 * 1024)).toFixed(2)) : 0,
        type: toText_(file.type),
        contentBase64: toText_(file.contentBase64)
      };
    });
  }

  return [];
}

function validateRequiredFields_(data) {
  const required = ['name', 'phone', 'email', 'carBrand', 'carModel', 'serviceType'];

  required.forEach(function(field) {
    if (!data[field]) {
      throw new Error('Falta el campo obligatorio: ' + field);
    }
  });

  if (!EMAIL_REGEX.test(data.email)) {
    throw new Error('El email no es valido');
  }

  if (!data.privacyAccepted) {
    throw new Error('Debes aceptar la politica de privacidad');
  }

  validateFiles_(data.files);
}

function validateFiles_(files) {
  if (!files || !files.length) return;

  if (files.length > MAX_FILES) {
    throw new Error('Se supera el maximo de adjuntos permitidos');
  }

  let totalBytes = 0;
  files.forEach(function(file) {
    if (!file.name) throw new Error('Hay un adjunto sin nombre');

    const bytes = file.sizeBytes || estimateBytesFromBase64_(file.contentBase64);
    if (bytes > MAX_FILE_SIZE_BYTES) {
      throw new Error('Un adjunto supera el tamano maximo permitido (10 MB)');
    }

    totalBytes += bytes;
  });

  if (totalBytes > MAX_TOTAL_FILES_BYTES) {
    throw new Error('Los adjuntos superan el tamano total permitido (15 MB)');
  }
}

function buildAttachments_(files) {
  if (!files || !files.length) return [];

  let totalBytes = 0;
  const attachments = [];

  files.forEach(function(file) {
    if (!file.contentBase64) return;

    const bytes = Utilities.base64Decode(file.contentBase64);
    const byteCount = bytes.length;
    if (!byteCount) return;

    if (byteCount > MAX_FILE_SIZE_BYTES) {
      throw new Error('Un adjunto supera el tamano maximo permitido (10 MB)');
    }

    totalBytes += byteCount;
    if (totalBytes > MAX_TOTAL_FILES_BYTES) {
      throw new Error('Los adjuntos superan el tamano total permitido (15 MB)');
    }

    const blob = Utilities.newBlob(
      bytes,
      file.type || 'application/octet-stream',
      file.name || 'adjunto'
    );
    attachments.push(blob);
  });

  return attachments;
}

function estimateBytesFromBase64_(base64) {
  if (!base64) return 0;
  const validLength = base64.replace(/=+$/, '').length;
  return Math.floor((validLength * 3) / 4);
}

function buildSubject_(data) {
  const servicio = data.serviceTypeLabel || data.serviceType || 'Sin servicio';
  return 'Nueva solicitud web - ' + servicio + ' - ' + data.name;
}

function buildTextBody_(data, fecha, attachmentWarning) {
  const filesText = data.files.length
    ? data.files.map(function(file) {
        return '- ' + file.name + ' (' + file.sizeMB + ' MB, ' + file.type + ')';
      }).join('\n')
    : 'Sin archivos';

  const warningBlock = attachmentWarning
    ? ['',
       'AVISO TECNICO',
       attachmentWarning]
    : [];

  return [
    'Nueva solicitud desde la web de Gijon Peritaciones',
    '',
    'Fecha: ' + fecha,
    'Origen: ' + (data.source || 'web-contacto'),
    '',
    'DATOS DE CONTACTO',
    'Nombre: ' + data.name,
    'Telefono: ' + data.phone,
    'Email: ' + data.email,
    '',
    'DATOS DEL VEHICULO',
    'Marca: ' + data.carBrand,
    'Modelo: ' + data.carModel,
    'Matricula: ' + (data.matricula || 'No indicada'),
    'Año: ' + (data.year || 'No indicado'),
    '',
    'SERVICIO SOLICITADO',
    'Tipo: ' + (data.serviceTypeLabel || data.serviceType),
    '',
    'MENSAJE',
    data.message || 'Sin mensaje adicional',
    '',
    'ARCHIVOS ADJUNTADOS EN FORMULARIO',
    filesText
  ].concat(warningBlock).join('\n');
}

function buildHtmlBody_(data, fecha, attachmentWarning) {
  const filesHtml = data.files.length
    ? '<ul>' + data.files.map(function(file) {
        return '<li>' + escapeHtml_(file.name) + ' (' + escapeHtml_(String(file.sizeMB)) + ' MB, ' + escapeHtml_(file.type) + ')</li>';
      }).join('') + '</ul>'
    : '<p>Sin archivos</p>';

  const warningHtml = attachmentWarning
    ? '<hr><h3>Aviso tecnico</h3><p>' + escapeHtml_(attachmentWarning) + '</p>'
    : '';

  return [
    '<h2>Nueva solicitud desde la web de Gijon Peritaciones</h2>',
    '<p><strong>Fecha:</strong> ' + escapeHtml_(fecha) + '</p>',
    '<p><strong>Origen:</strong> ' + escapeHtml_(data.source || 'web-contacto') + '</p>',
    '<hr>',
    '<h3>Datos de contacto</h3>',
    '<p><strong>Nombre:</strong> ' + escapeHtml_(data.name) + '</p>',
    '<p><strong>Telefono:</strong> ' + escapeHtml_(data.phone) + '</p>',
    '<p><strong>Email:</strong> ' + escapeHtml_(data.email) + '</p>',
    '<hr>',
    '<h3>Datos del vehiculo</h3>',
    '<p><strong>Marca:</strong> ' + escapeHtml_(data.carBrand) + '</p>',
    '<p><strong>Modelo:</strong> ' + escapeHtml_(data.carModel) + '</p>',
    '<p><strong>Matricula:</strong> ' + escapeHtml_(data.matricula || 'No indicada') + '</p>',
    '<p><strong>Ano:</strong> ' + escapeHtml_(data.year || 'No indicado') + '</p>',
    '<hr>',
    '<h3>Servicio solicitado</h3>',
    '<p><strong>Tipo:</strong> ' + escapeHtml_(data.serviceTypeLabel || data.serviceType) + '</p>',
    '<hr>',
    '<h3>Mensaje</h3>',
    '<p>' + escapeHtml_(data.message || 'Sin mensaje adicional') + '</p>',
    '<hr>',
    '<h3>Archivos adjuntados en formulario</h3>',
    filesHtml,
    warningHtml
  ].join('');
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAdminNotificationRecipients_() {
  const props = PropertiesService.getScriptProperties();
  const configured = toText_(props.getProperty('ADMIN_NOTIFICATION_EMAILS') || props.getProperty('ADMIN_NOTIFICATION_EMAIL'));
  const rawList = [];

  // Siempre incluir el destinatario principal del script.
  rawList.push(DESTINATARIO);

  if (configured) {
    configured.split(/[;,]/).forEach(function(item) {
      rawList.push(item);
    });
  }

  const dedup = {};
  const recipients = [];

  rawList.forEach(function(item) {
    const email = String(item || '').trim();
    const key = email.toLowerCase();
    if (!email || !EMAIL_REGEX.test(email) || dedup[key]) return;
    dedup[key] = true;
    recipients.push(email);
  });

  return recipients;
}

function getPreferredFromAlias_() {
  const desired = String(DESTINATARIO || '').trim().toLowerCase();
  if (!desired) return '';

  try {
    const aliases = GmailApp.getAliases() || [];
    for (var i = 0; i < aliases.length; i++) {
      const alias = String(aliases[i] || '').trim();
      if (alias.toLowerCase() === desired) {
        return alias;
      }
    }
  } catch (error) {
    Logger.log('No se pudieron leer aliases de Gmail: ' + String(error));
  }

  return '';
}

function sendEmail_(options) {
  const to = String(options.to || '').trim();
  const subject = String(options.subject || '').trim();
  const body = String(options.body || '').trim() || ' ';

  const mailOptions = {
    name: REMITENTE_NOMBRE
  };

  if (options.htmlBody) {
    mailOptions.htmlBody = options.htmlBody;
  }

  if (options.replyTo) {
    mailOptions.replyTo = options.replyTo;
  }

  if (options.attachments && options.attachments.length) {
    mailOptions.attachments = options.attachments;
  }

  const alias = getPreferredFromAlias_();
  if (alias) {
    try {
      const gmailOptions = {
        name: mailOptions.name,
        htmlBody: mailOptions.htmlBody || '',
        replyTo: mailOptions.replyTo || '',
        from: alias
      };
      if (mailOptions.attachments && mailOptions.attachments.length) {
        gmailOptions.attachments = mailOptions.attachments;
      }
      GmailApp.sendEmail(to, subject, body, gmailOptions);
      return;
    } catch (error) {
      Logger.log('Fallo enviando con alias ' + alias + ': ' + String(error));
    }
  }

  MailApp.sendEmail(to, subject, body, mailOptions);
}

function sendContactAutoReply_(data) {
  if (!data.email || !EMAIL_REGEX.test(data.email)) return;

  const nombre = data.name || 'cliente';
  const subject = 'Hemos recibido tu solicitud - Gijon Peritaciones';
  const text = [
    'Hola ' + nombre + ',',
    '',
    'Hemos recibido correctamente tu solicitud.',
    'Te responderemos lo antes posible.',
    '',
    'Gracias,',
    'Gijon Peritaciones'
  ].join('\n');

  const html = [
    '<p>Hola ' + escapeHtml_(nombre) + ',</p>',
    '<p>Hemos recibido correctamente tu solicitud.</p>',
    '<p>Te responderemos lo antes posible.</p>',
    '<p>Gracias,<br>Gijon Peritaciones</p>'
  ].join('');

  MailApp.sendEmail(data.email, subject, text, {
    name: REMITENTE_NOMBRE,
    htmlBody: html,
    replyTo: DESTINATARIO
  });
}

function toText_(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toBoolean_(value) {
  if (value === true || value === 'true' || value === 'on' || value === '1' || value === 1) {
    return true;
  }
  return false;
}

function toNumber_(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
