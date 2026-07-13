function getMetaWhatsAppConfig() {
  return {
    accessToken: String(process.env.META_WHATSAPP_ACCESS_TOKEN || '').trim(),
    phoneNumberId: String(process.env.META_WHATSAPP_PHONE_NUMBER_ID || '').trim(),
    apiVersion: String(process.env.META_WHATSAPP_API_VERSION || 'v22.0').trim(),
    verifyToken: String(process.env.META_WHATSAPP_VERIFY_TOKEN || '').trim(),
    templateName: String(process.env.META_WHATSAPP_TEMPLATE_NAME || 'hello_world').trim(),
    templateLanguageCode: String(process.env.META_WHATSAPP_TEMPLATE_LANGUAGE || 'en_US').trim(),
  };
}

function getMissingMetaWhatsAppConfig(config) {
  const missing = [];
  if (!config.accessToken) missing.push('META_WHATSAPP_ACCESS_TOKEN');
  if (!config.phoneNumberId) missing.push('META_WHATSAPP_PHONE_NUMBER_ID');
  if (!config.apiVersion) missing.push('META_WHATSAPP_API_VERSION');
  if (!config.verifyToken) missing.push('META_WHATSAPP_VERIFY_TOKEN');
  return missing;
}

module.exports = {
  getMetaWhatsAppConfig,
  getMissingMetaWhatsAppConfig,
};
