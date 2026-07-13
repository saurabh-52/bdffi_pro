const db = require('../db/knex');
const { getMetaWhatsAppConfig, getMissingMetaWhatsAppConfig } = require('../config/whatsapp');

function buildTemplateComponents(templateParams = []) {
  if (!Array.isArray(templateParams) || templateParams.length === 0) {
    return undefined;
  }

  return [{
    type: 'body',
    parameters: templateParams.map(value => ({
      type: 'text',
      text: String(value ?? ''),
    })),
  }];
}

async function areWhatsAppAlertsEnabled() {
  try {
    const enabledManager = await db('managers').where('whatsapp_alerts_enabled', true).first();
    return Boolean(enabledManager);
  } catch (error) {
    return true;
  }
}

async function sendMetaWhatsAppTemplateMessage({ to, templateName, templateLanguageCode, templateParams = [] }) {
  const config = getMetaWhatsAppConfig();
  const missing = getMissingMetaWhatsAppConfig(config).filter(name => name !== 'META_WHATSAPP_VERIFY_TOKEN');
  if (missing.length) {
    return {
      ok: false,
      status: 500,
      error: `Missing required Meta WhatsApp config: ${missing.join(', ')}`,
    };
  }

  if (typeof fetch !== 'function') {
    return {
      ok: false,
      status: 500,
      error: 'Global fetch is not available in this Node runtime.',
    };
  }

  const activeTemplateName = String(templateName || config.templateName || 'hello_world').trim();
  const activeLangCode = String(templateLanguageCode || config.templateLanguageCode || 'en_US').trim();

  const endpoint = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
  const buildTemplatePayload = (params) => {
    const template = {
      name: activeTemplateName,
      language: { code: activeLangCode },
    };

    const components = buildTemplateComponents(params);
    if (components) {
      template.components = components;
    }

    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template,
    };
  };

  const sendTemplateRequest = async (params) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify(buildTemplatePayload(params)),
    });

    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  };

  try {
    let { response, payload } = await sendTemplateRequest(templateParams);

    if (!response.ok && Array.isArray(templateParams) && templateParams.length > 0) {
      const detail = String(payload?.error?.error_data?.details || '').toLowerCase();
      const shouldRetryWithoutComponents = detail.includes('parameter') || detail.includes('component');
      if (shouldRetryWithoutComponents) {
        const retry = await sendTemplateRequest([]);
        response = retry.response;
        payload = retry.payload;
      }
    }

    if (!response.ok) {
      const metaCode = payload?.error?.code;
      const recipientNotAllowed = metaCode === 131030;
      const baseError = payload?.error?.message || 'Meta WhatsApp API request failed.';

      return {
        ok: false,
        status: response.status,
        error: recipientNotAllowed
          ? `${baseError} Add the recipient phone number to the allowed recipients list in Meta WhatsApp test settings, or switch the app/account to live messaging with an approved template.`
          : baseError,
        payload,
      };
    }

    return {
      ok: true,
      status: response.status,
      payload,
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: `Meta WhatsApp request failed: ${error.message}`,
    };
  }
}

async function sendMetaFreeText({ to, text }) {
  const config = getMetaWhatsAppConfig();
  const endpoint = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text }
      })
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to send free text:', err.message);
  }
}

async function sendMetaInteractiveButtons({ to, text, buttons }) {
  const config = getMetaWhatsAppConfig();
  const endpoint = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text },
          action: {
            buttons: buttons.map((btn) => ({
              type: 'reply',
              reply: {
                id: btn.id,
                title: btn.title
              }
            }))
          }
        }
      })
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to send interactive buttons:', err.message);
  }
}

async function sendMetaInteractiveList({ to, text, buttonText, rows }) {
  const config = getMetaWhatsAppConfig();
  const endpoint = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text },
          action: {
            button: buttonText,
            sections: [
              {
                title: 'Select Option',
                rows: rows.map(r => ({
                  id: r.id,
                  title: r.title.substring(0, 24)
                }))
              }
            ]
          }
        }
      })
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to send interactive list:', err.message);
  }
}

function summarizeMetaWebhook(payload) {
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  let messageCount = 0;
  let statusCount = 0;

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value || {};
      if (Array.isArray(value.messages)) messageCount += value.messages.length;
      if (Array.isArray(value.statuses)) statusCount += value.statuses.length;
    }
  }

  return {
    object: payload?.object || null,
    entries: entries.length,
    messages: messageCount,
    statuses: statusCount,
  };
}

module.exports = {
  areWhatsAppAlertsEnabled,
  sendMetaWhatsAppTemplateMessage,
  sendMetaFreeText,
  sendMetaInteractiveButtons,
  sendMetaInteractiveList,
  summarizeMetaWebhook,
};
