import { CloudflareR2Config } from './StorageConfig';

async function hmacSha256(key: ArrayBuffer | string, message: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const keyData = typeof key === 'string' ? enc.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
}

async function sha256Hex(data: ArrayBuffer | string): Promise<string> {
  const enc = new TextEncoder();
  const bytes = typeof data === 'string' ? enc.encode(data) : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function uploadToCloudflareR2(
  localUri: string,
  config: CloudflareR2Config,
  userId: string = 'public'
): Promise<string> {
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
  const objectPath = `flashcards/${userId}/${fileName}`;

  // Read local image as ArrayBuffer
  const response = await fetch(localUri);
  const fileArrayBuffer = await response.arrayBuffer();

  const region = 'auto';
  const service = 's3';
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const url = `https://${host}/${config.bucketName}/${objectPath}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.substring(0, 8);

  const payloadHash = await sha256Hex(fileArrayBuffer);
  const canonicalUri = `/${config.bucketName}/${objectPath}`;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = `PUT\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

  // Deriving signing key
  const kDate = await hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');

  const signature = bufferToHex(await hmacSha256(kSigning, stringToSign));

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      'Authorization': authorizationHeader,
      'Content-Type': 'image/jpeg',
    },
    body: fileArrayBuffer,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('R2 upload failed:', res.status, errText);
    throw new Error(`Cloudflare R2 Upload Failed (${res.status}): ${errText || res.statusText}`);
  }

  const cleanPublicUrl = config.publicUrl.replace(/\/+$/, '');
  return `${cleanPublicUrl}/${objectPath}`;
}
