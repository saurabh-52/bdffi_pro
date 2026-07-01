async function readResponseData(response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function readPersistedSheet() {
  const response = await fetch('/api/donors');
  if (!response.ok) {
    throw new Error('Failed to load donor sheet from backend.');
  }

  return response.json();
}

export async function savePersistedSheet(donors, sheetMeta) {
  const response = await fetch('/api/donors/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ donors, sheetMeta }),
  });

  if (!response.ok) {
    throw new Error('Failed to save donor sheet to backend.');
  }

  return response.json();
}

export async function deletePersistedSheet() {
  const response = await fetch('/api/donors', { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Failed to delete donor sheet from backend.');
  }

  return response.json();
}

export async function readManagerAccounts() {
  const response = await fetch('/api/managers');
  if (!response.ok) {
    throw new Error('Failed to load manager accounts from backend.');
  }

  return response.json();
}

export async function createManagerAccount(payload) {
  const response = await fetch('/api/managers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await readResponseData(response);

  if (!response.ok) {
    throw new Error(data.message || 'Failed to create manager account.');
  }

  return data;
}

export async function deactivateManagerAccount(managerId) {
  const response = await fetch(`/api/managers/${managerId}/deactivate`, { method: 'POST' });
  const data = await readResponseData(response);

  if (!response.ok) {
    throw new Error(data.message || 'Failed to deactivate manager account.');
  }

  return data;
}

export async function activateManagerAccount(managerId) {
  const response = await fetch(`/api/managers/${managerId}/activate`, { method: 'POST' });
  const data = await readResponseData(response);

  if (!response.ok) {
    throw new Error(data.message || 'Failed to activate manager account.');
  }

  return data;
}

export async function demoteManagerAccount(managerId) {
  const response = await fetch(`/api/managers/${managerId}`, { method: 'DELETE' });
  const data = await readResponseData(response);

  if (!response.ok) {
    throw new Error(data.message || 'Failed to demote manager account.');
  }

  return data;
}

export async function updateGlobalWhatsAppAlerts(managerId, enabled) {
  const response = await fetch(`/api/managers/${managerId}/alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  const data = await readResponseData(response);

  if (!response.ok) {
    throw new Error(data.message || 'Failed to update WhatsApp alerts setting.');
  }

  return data;
}

export async function sendDonorWhatsAppAlert(donor, message, customTemplateName, customTemplateLang, customTemplateParams, requestId, sender) {
  const templateParams = customTemplateParams || [
    donor?.name || 'Donor',
    donor?.blood || 'Unknown',
    donor?.programme || 'Student',
  ];

  const payload = {
    donor,
    message,
    templateParams,
    requestId: requestId || null,
    sender: sender || null,
  };
  if (customTemplateName) payload.templateName = customTemplateName;
  if (customTemplateLang) payload.templateLanguageCode = customTemplateLang;

  const response = await fetch('/api/whatsapp/alerts/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await readResponseData(response);
  if (!response.ok) {
    throw new Error(data.message || 'Failed to send WhatsApp alert.');
  }

  return data;
}

export async function sendBrowserNotification(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
  }

  if (Notification.permission !== 'granted') return false;

  new Notification(title, { body });
  return true;
}

export async function createVolunteerAccount(payload) {
  const response = await fetch('/api/volunteers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await readResponseData(response);

  if (!response.ok) {
    throw new Error(data.message || 'Failed to create volunteer account.');
  }

  return data;
}

export async function readVolunteerAccounts() {
  const response = await fetch('/api/volunteers');
  if (!response.ok) {
    throw new Error('Failed to load volunteer accounts.');
  }
  return response.json();
}

export async function deleteVolunteerAccount(id, actorName, actorEmail) {
  const response = await fetch(`/api/volunteers/${id}?actorName=${encodeURIComponent(actorName)}&actorEmail=${encodeURIComponent(actorEmail)}`, {
    method: 'DELETE',
  });

  const data = await readResponseData(response);

  if (!response.ok) {
    throw new Error(data.message || 'Failed to remove volunteer account.');
  }

  return data;
}
