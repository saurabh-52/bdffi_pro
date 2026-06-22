require('dotenv').config();

const token = process.env.META_WHATSAPP_ACCESS_TOKEN || '';
const version = process.env.META_WHATSAPP_API_VERSION || 'v22.0';

async function main() {
  if (!token) {
    console.error('No token found in env.');
    return;
  }
  
  // Try querying /app or /me to inspect token validity
  const url = `https://graph.facebook.com/${version}/me?access_token=${token}`;
  console.log('Fetching:', `https://graph.facebook.com/${version}/me?access_token=...`);
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log('Response Status:', res.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

main();
