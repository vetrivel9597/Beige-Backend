const path = require('path');
const dotenv = require('dotenv');

const backendEnvPath = path.resolve(__dirname, '../.env');
const envResult = dotenv.config({ path: backendEnvPath });
if (envResult.error) {
  throw new Error(`Could not load the backend .env at ${backendEnvPath}: ${envResult.error.message}`);
}
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';

const legacyNames = {
  MONGODB_URI: 'MongoCluster',
  FRONTEND_URL: 'Frontend_URL',
  ADMIN_URL: 'AdminPanel_URl',
  BACKEND_URL: 'Backend_Xml_Url',
  SMTP_HOST: 'Mail_Host',
  SMTP_USER: 'mailCredUserName',
  SMTP_PASSWORD: 'mailCredPassword',
  SMTP_FROM: 'mailFromAddress',
  CLOUDINARY_IMAGE_URL: 'Cloudinary_Image',
  CLOUDINARY_CLOUD_NAME: 'CLOUD_NAME',
  CLOUDINARY_API_KEY: 'CLOUDINARY_APIKEY',
  CLOUDINARY_API_SECRET: 'CLOUDINARY_SECRET',
  TWILIO_ACCOUNT_SID: 'TwillioSID',
  TWILIO_AUTH_TOKEN: 'TwillioAuthToken',
  TWILIO_PHONE_NUMBER: 'TwillioPhone',
  TWILIO_WHATSAPP_NUMBER: 'TwillioWhatsapp',
  LEGACY_PASSWORD_ENCRYPTION_KEY: 'encdcrKey',
  LEGACY_ADMIN_PASSWORD_ENCRYPTION_KEY: 'AdminencdcrKey',
};

for (const [currentName, legacyName] of Object.entries(legacyNames)) {
  if (!process.env[currentName] && process.env[legacyName]) {
    process.env[currentName] = process.env[legacyName];
  }
}

function validateRequiredEnvironment() {
  const required = [
    'PORT',
    'HOST',
    'MONGODB_URI',
    'SESSION_SECRET',
    'JWT_SECRET',
    'JWT_ADMIN_SECRET',
    'MAIL_CONFIRM_SECRET',
    'GROQ_API_KEY',
    'FRONTEND_URL',
    'ADMIN_URL',
    'BACKEND_URL',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'CLOUDINARY_IMAGE_URL',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'TWILIO_WHATSAPP_NUMBER',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_INVOICE_PORT',
    'SMTP_SECURE',
    'SMTP_INVOICE_SECURE',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM',
  ];
  const missing = required.filter((name) => !String(process.env[name] || '').trim());
  if (missing.length) {
    throw new Error(`Missing required backend environment variables: ${missing.join(', ')}`);
  }

  for (const name of ['PORT', 'SMTP_PORT', 'SMTP_INVOICE_PORT']) {
    const port = Number(process.env[name]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`${name} must be an integer between 1 and 65535.`);
    }
  }
  for (const name of ['SMTP_SECURE', 'SMTP_INVOICE_SECURE']) {
    if (!['true', 'false'].includes(String(process.env[name]).toLowerCase())) {
      throw new Error(`${name} must be set to true or false.`);
    }
  }
  for (const name of ['FRONTEND_URL', 'ADMIN_URL', 'BACKEND_URL']) {
    try {
      const parsed = new URL(process.env[name]);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      throw new Error(`${name} must be a valid http or https URL.`);
    }
  }
}

module.exports = { validateRequiredEnvironment };
