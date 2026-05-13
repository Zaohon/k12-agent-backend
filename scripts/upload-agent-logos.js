const fs = require('fs');
const path = require('path');
const OSS = require('ali-oss');

function loadEnv(envPath) {
  const env = {};
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function main() {
  const backendRoot = path.resolve(__dirname, '..');
  const projectRoot = path.resolve(backendRoot, '..');
  const envPath = path.join(backendRoot, '.env');

  if (!fs.existsSync(envPath)) {
    throw new Error(`.env not found: ${envPath}`);
  }

  const env = loadEnv(envPath);
  const client = new OSS({
    region: env.OSS_REGION,
    bucket: env.OSS_BUCKET,
    accessKeyId: env.OSS_ACCESS_KEY_ID,
    accessKeySecret: env.OSS_ACCESS_KEY_SECRET,
    endpoint: env.OSS_ENDPOINT || undefined,
  });

  const publicDomain = String(env.OSS_PUBLIC_DOMAIN || '').replace(/\/$/, '');
  const makeUrl = (key) =>
    publicDomain
      ? `${publicDomain}/${key}`
      : `https://${env.OSS_BUCKET}.${env.OSS_REGION}.aliyuncs.com/${key}`;

  const files = [
    'book-icon.png',
    'computer-icon.png',
    'file-icon.png',
  ];

  const imageDir = path.join(projectRoot, 'k12-agent-frontend', 'src', 'images');
  const uploaded = [];

  for (const fileName of files) {
    const localPath = path.join(imageDir, fileName);
    if (!fs.existsSync(localPath)) {
      throw new Error(`Local image not found: ${localPath}`);
    }

    const key = `system/agent-logo/${fileName}`;
    const result = await client.put(key, localPath, {
      headers: { 'Content-Type': 'image/png' },
    });

    uploaded.push({
      key,
      url: makeUrl(key),
      etag: result.res?.headers?.etag,
    });
  }

  console.log(JSON.stringify({ success: true, uploaded }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
