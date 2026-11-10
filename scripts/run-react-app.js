const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

const [application, command, ...args] = process.argv.slice(2);
const appDirectories = {
  storefront: 'Beauty-care-frontend',
  admin: 'Skincare-AdminPanel',
};
const allowedCommands = new Set(['start', 'build', 'test']);

if (!appDirectories[application] || !allowedCommands.has(command)) {
  console.error('Usage: node run-react-app.js <storefront|admin> <start|build|test> [args...]');
  process.exit(2);
}

const rootDirectory = path.resolve(__dirname, '../../');
const envPath = path.join(rootDirectory, '.env');
if (!fs.existsSync(envPath)) {
  console.error(`Shared project environment file is missing: ${envPath}`);
  process.exit(1);
}

const config = dotenv.parse(fs.readFileSync(envPath));
const backendUrl = (config.BACKEND_URL || '').replace(/\/+$/, '');
if (!backendUrl) {
  console.error('BACKEND_URL must be set in the project root .env file.');
  process.exit(1);
}

const portKey = application === 'admin' ? 'ADMIN_PORT' : 'FRONTEND_PORT';
if (!config[portKey]) {
  console.error(`${portKey} must be set in the project root .env file.`);
  process.exit(1);
}

const projectDirectory = path.join(rootDirectory, appDirectories[application]);
const reactScripts = require.resolve(`react-scripts/scripts/${command}.js`, { paths: [projectDirectory] });
const publicFrontendConfig = {
  PORT: config[portKey],
  REACT_APP_API_BASE_URL: application === 'admin' ? `${backendUrl}/admin` : backendUrl,
  ...(command === 'build' ? { GENERATE_SOURCEMAP: 'false' } : {}),
};
if (config.RAZORPAY_CHECKOUT_URL) {
  publicFrontendConfig.REACT_APP_RAZORPAY_CHECKOUT_URL = config.RAZORPAY_CHECKOUT_URL;
}
if (application === 'admin' && config.CLOUDINARY_IMAGE_URL) {
  publicFrontendConfig.REACT_APP_BRAND_LOGO_URL = config.CLOUDINARY_IMAGE_URL;
}

// CRA reads .env only from its app directory. Keep this generated file public-only
// and refresh it from the root source of truth whenever an app command runs.
if (application === 'storefront') {
  const frontendEnvPath = path.join(projectDirectory, '.env');
  const generatedEnv = Object.entries(publicFrontendConfig)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join('\n') + '\n';
  fs.writeFileSync(frontendEnvPath, generatedEnv, { mode: 0o600 });
}

const childEnvironment = {
  PATH: process.env.PATH || '',
  HOME: process.env.HOME || '',
  TMPDIR: process.env.TMPDIR || '/tmp',
  TEMP: process.env.TEMP || '/tmp',
  CI: process.env.CI || '',
  BROWSER: process.env.BROWSER || '',
  ...publicFrontendConfig,
};

const result = spawnSync(process.execPath, [reactScripts, ...args], {
  cwd: projectDirectory,
  env: childEnvironment,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Could not run the ${application} ${command} command: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
