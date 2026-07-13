const db = require('../db/knex');
const { ensureWhatsAppEventsTable } = require('../db/database');
const { normalizePhoneNumber, toJsonText } = require('../utils/helpers');
const { readSheetStore, writeSheetStore } = require('../models/store');
const { getMetaWhatsAppConfig, getMissingMetaWhatsAppConfig } = require('../config/whatsapp');
const {
  areWhatsAppAlertsEnabled,
  sendMetaWhatsAppTemplateMessage,
  sendMetaFreeText,
  sendMetaInteractiveButtons,
  sendMetaInteractiveList,
  summarizeMetaWebhook,
} = require('../utils/whatsapp');

async function sendAlert(req, res) {
  try {
    const donor = req.body?.donor || null;
    const templateName = req.body?.templateName || null;
    const templateLanguageCode = req.body?.templateLanguageCode || null;
    const requestId = req.body?.requestId ? Number(req.body.requestId) : null;
    const templateParams = Array.isArray(req.body?.templateParams)
      ? req.body.templateParams.map(value => String(value ?? ''))
      : [];

    if (!donor || typeof donor !== 'object') {
      return res.status(400).json({ message: 'donor payload is required.' });
    }

    const phone = normalizePhoneNumber(donor.mobile);
    if (!phone) {
      return res.status(400).json({ message: 'A valid donor mobile number is required.' });
    }

    const alertsEnabled = await areWhatsAppAlertsEnabled();
    if (!alertsEnabled) {
      return res.status(409).json({ message: 'WhatsApp alerts are disabled by manager settings.' });
    }

    const result = await sendMetaWhatsAppTemplateMessage({
      to: phone,
      templateName,
      templateLanguageCode,
      templateParams,
    });

    try {
      await ensureWhatsAppEventsTable();
      const messageId = result.payload?.messages?.[0]?.id || null;
      const status = result.ok ? 'sent' : 'failed';
      const sender = req.body?.sender || null;
      const event = {
        request_id: requestId,
        student_name: donor.name || null,
        student_phone: phone || null,
        status,
        message_id: messageId,
        attempt_count: 1,
        last_error: result.ok ? null : (result.error || null),
        meta: toJsonText({
          request: {
            templateName,
            templateLanguageCode,
            templateParams,
          },
          response: result.payload,
          sender,
        }),
      };

      const [insertedId] = await db('whatsapp_events').insert(event);

      if (!result.ok) {
        return res.status(result.status || 500).json({
          message: result.error || 'Failed to send WhatsApp alert via Meta API.',
          meta: result.payload || null,
          eventId: insertedId,
        });
      }

      try {
        const store = await readSheetStore();
        const nextDonors = Array.isArray(store.donors)
          ? store.donors.map(currentDonor => {
              if (Number(currentDonor.id) === Number(donor.id)) {
                return { ...currentDonor, notified: true };
              }

              const currentPhone = normalizePhoneNumber(currentDonor.mobile);
              if (!donor.id && currentPhone && currentPhone === phone) {
                return { ...currentDonor, notified: true };
              }

              return currentDonor;
            })
          : [];
        await writeSheetStore({ ...store, donors: nextDonors });
      } catch (err) {
        // ignore
      }

      return res.json({
        message: `WhatsApp alert sent to ${donor.name || donor.mobile || 'donor'}.`,
        messageId: messageId,
        meta: result.payload,
        eventId: insertedId,
      });
    } catch (err) {
      return res.status(500).json({ message: 'Failed to persist WhatsApp event.' });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send WhatsApp alert.' });
  }
}

async function getWhatsappStatus(_req, res) {
  const config = getMetaWhatsAppConfig();
  const missing = getMissingMetaWhatsAppConfig(config).filter(k => k !== 'META_WHATSAPP_VERIFY_TOKEN');
  const hasConfig = missing.length === 0;

  try {
    await ensureWhatsAppEventsTable();
    const lastSent = await db('whatsapp_events').where('status', 'sent').orderBy('created_at', 'desc').first();
    const failedCount = await db('whatsapp_events').where('status', 'failed').count('id as c').first();

    return res.json({
      ok: true,
      hasConfig,
      missing,
      templateName: config.templateName,
      templateLanguageCode: config.templateLanguageCode,
      lastSent: lastSent || null,
      failed: Number(failedCount?.c || 0),
    });
  } catch (err) {
    return res.json({ ok: false, error: err.message });
  }
}

async function getWhatsappEvents(_req, res) {
  try {
    await ensureWhatsAppEventsTable();
    const events = await db('whatsapp_events')
      .whereNot('status', 'received')
      .orderBy('created_at', 'desc')
      .limit(200);
    return res.json({ ok: true, events });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

async function retryWhatsappEvent(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'id is required' });

    await ensureWhatsAppEventsTable();
    const ev = await db('whatsapp_events').where('id', id).first();
    if (!ev) return res.status(404).json({ message: 'Event not found' });

    const phone = normalizePhoneNumber(ev.student_phone);
    if (!phone) return res.status(400).json({ message: 'Invalid phone on event' });

    let templateName = undefined;
    let templateLanguageCode = undefined;
    let templateParams = [];

    if (ev.meta) {
      try {
        const metaObj = typeof ev.meta === 'string' ? JSON.parse(ev.meta) : ev.meta;
        if (metaObj?.request) {
          templateName = metaObj.request.templateName;
          templateLanguageCode = metaObj.request.templateLanguageCode;
          templateParams = metaObj.request.templateParams;
        }
      } catch (err) {
        // ignore parsing error
      }
    }

    const result = await sendMetaWhatsAppTemplateMessage({
      to: phone,
      templateName,
      templateLanguageCode,
      templateParams,
    });

    const updates = {
      attempt_count: Number(ev.attempt_count || 0) + 1,
      updated_at: db.fn.now(),
    };

    const nextMeta = {
      request: {
        templateName,
        templateLanguageCode,
        templateParams,
      },
      response: result.payload,
    };

    if (result.ok) {
      updates.status = 'sent';
      updates.message_id = result.payload?.messages?.[0]?.id || ev.message_id;
      updates.last_error = null;
      updates.meta = toJsonText(nextMeta);
    } else {
      updates.status = 'failed';
      updates.last_error = result.error || null;
      updates.meta = toJsonText(nextMeta);
    }

    await db('whatsapp_events').where('id', id).update(updates);

    return res.json({ ok: result.ok, meta: result.payload || null });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

function verifyWebhook(req, res) {
  const mode = String(req.query['hub.mode'] || '').trim();
  const token = String(req.query['hub.verify_token'] || '').trim();
  const challenge = String(req.query['hub.challenge'] || '').trim();

  const config = getMetaWhatsAppConfig();
  if (!config.verifyToken) {
    return res.status(500).send('META_WHATSAPP_VERIFY_TOKEN is not configured.');
  }

  if (mode === 'subscribe' && token === config.verifyToken) {
    return res.status(200).send(challenge || 'OK');
  }

  return res.status(403).send('Invalid webhook verification token.');
}

function receiveWebhook(req, res) {
  const body = req.body || {};
  const summary = summarizeMetaWebhook(body);
  console.log('Meta WhatsApp webhook received:', JSON.stringify(summary));

  try {
    const entries = Array.isArray(body.entry) ? body.entry : [];
    (async () => {
      await ensureWhatsAppEventsTable();
      for (const entry of entries) {
        const changes = Array.isArray(entry.changes) ? entry.changes : [];
        for (const change of changes) {
          const value = change.value || {};
          if (Array.isArray(value.statuses)) {
            for (const st of value.statuses) {
              const messageId = st?.id || st?.message_id || null;
              const status = st?.status || null;
              if (messageId && status) {
                const map = { sent: 'sent', delivered: 'sent', read: 'sent', failed: 'failed' };
                const newStatus = map[status] || status;
                await db('whatsapp_events').where('message_id', messageId).update({ status: newStatus, updated_at: db.fn.now(), meta: toJsonText(st) });
              }
            }
          }

          if (Array.isArray(value.messages)) {
            for (const msg of value.messages) {
              const from = msg?.from || null;
              const msgId = msg?.id || null;
              if (msgId && from) {
                let userChoice = null;
                let replyId = null;

                if (msg.type === 'button') {
                  const btnText = String(msg.button?.text || '').trim().toUpperCase();
                  if (btnText === 'YES' || btnText.includes('YES')) {
                    userChoice = 'Yes';
                  } else if (btnText === 'NO' || btnText.includes('NO')) {
                    userChoice = 'No';
                  } else {
                    userChoice = msg.button?.text || null;
                  }
                } else if (msg.type === 'interactive') {
                  const interactive = msg.interactive || {};
                  if (interactive.type === 'button_reply') {
                    replyId = interactive.button_reply?.id;
                    userChoice = interactive.button_reply?.title;
                  } else if (interactive.type === 'list_reply') {
                    replyId = interactive.list_reply?.id;
                    userChoice = interactive.list_reply?.title;
                  }
                } else if (msg.type === 'text') {
                  const txt = String(msg.text?.body || '').trim().toUpperCase();
                  if (txt === 'YES' || txt.startsWith('YES') || txt.includes('YES')) {
                    userChoice = 'Yes';
                  } else if (txt === 'NO' || txt.startsWith('NO') || txt.includes('NO')) {
                    userChoice = 'No';
                  }
                }

                if (userChoice) {
                  const latestEvent = await db('whatsapp_events')
                    .where('student_phone', from)
                    .whereNot('status', 'received')
                    .orderBy('created_at', 'desc')
                    .first();
                  
                  if (latestEvent) {
                    const diffMs = Date.now() - new Date(latestEvent.created_at).getTime();
                    const hours24 = 24 * 60 * 60 * 1000;
                    
                     if (diffMs <= hours24) {
                      if (latestEvent.response !== null && latestEvent.response !== '') {
                        const isFinal = latestEvent.status === 'accepted' || 
                                        latestEvent.response === 'No - Other' || 
                                        latestEvent.response.startsWith('No - Donated Recently (');
                        
                        const isInitialButton = msg.type === 'button' || msg.type === 'text';
                        
                        if (isInitialButton || isFinal) {
                          console.log(`Bouncer: Ignoring duplicate response from ${from} for event ${latestEvent.id}. Current response: ${latestEvent.response}`);
                          continue;
                        }
                      }

                      let nextResponse = userChoice;
                      
                      if (replyId === 'no_donated_recently') {
                        nextResponse = 'No - Donated Recently';
                      } else if (replyId === 'no_other') {
                        nextResponse = 'No - Other';
                      } else if (replyId && replyId.startsWith('months_')) {
                        nextResponse = `No - Donated Recently (${userChoice})`;
                      }
                      
                      await db('whatsapp_events')
                        .where('id', latestEvent.id)
                        .update({ 
                          response: nextResponse,
                          status: (userChoice === 'Yes' || userChoice.includes('YES')) ? 'accepted' : 'declined',
                          updated_at: db.fn.now() 
                        });

                      if (userChoice === 'Yes') {
                        await sendMetaFreeText({
                          to: from,
                          text: 'Our volunteer will reach out to you soon if the case hasn\'t been resolved yet. Thank you for your support!'
                        });
                      } else if (userChoice === 'No') {
                        await sendMetaInteractiveButtons({
                          to: from,
                          text: 'We understand. Could you please let us know the reason?',
                          buttons: [
                            { id: 'no_donated_recently', title: 'Donated recently' },
                            { id: 'no_other', title: 'Other' }
                          ]
                        });
                      } else if (replyId === 'no_other') {
                        await sendMetaFreeText({
                          to: from,
                          text: 'Thank you for your cooperation.'
                        });
                      } else if (replyId === 'no_donated_recently') {
                        await sendMetaInteractiveList({
                          to: from,
                          text: 'Could you tell us how many months ago it was?',
                          buttonText: 'Select Months',
                          rows: [
                            { id: 'months_1', title: '1 month' },
                            { id: 'months_2', title: '2 months' },
                            { id: 'months_3', title: '3 months' },
                            { id: 'months_other', title: 'Others' }
                          ]
                        });
                      } else if (replyId && replyId.startsWith('months_')) {
                        await sendMetaFreeText({
                          to: from,
                          text: 'Thank you for your cooperation.'
                        });
                      }
                    } else {
                      console.log(`Received user choice ${userChoice} but it was outside the 24h window (diff: ${diffMs} ms)`);
                    }
                  }
                }

                await db('whatsapp_events')
                  .insert({ 
                    student_name: null, 
                    student_phone: from, 
                    status: 'received', 
                    message_id: msgId, 
                    attempt_count: 0, 
                    response: userChoice,
                    meta: toJsonText(msg) 
                  })
                  .catch(() => {});
              }
            }
          }
        }
      }
    })();
  } catch (err) {
    console.warn('Failed to update whatsapp_events from webhook:', err && err.message);
  }

  return res.status(200).send('EVENT_RECEIVED');
}

module.exports = {
  sendAlert,
  getWhatsappStatus,
  getWhatsappEvents,
  retryWhatsappEvent,
  verifyWebhook,
  receiveWebhook,
};
