import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createHash, createHmac } from 'crypto';
import { Pool } from 'pg';
import { attachDatabasePool } from '@neon/functions';

const BUCKET = 'lesson-media';
const MAX_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'video/mp4',
  'application/pdf',
]);

const jwks = createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL!));
const issuer = new URL(process.env.NEON_AUTH_BASE_URL!).origin;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
attachDatabasePool(pool);

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

// Presigned S3 PUT URL via SigV4 query-string auth, sin depender del SDK de AWS
// (el SDK completo agrega ~1.5MB al bundle, demasiado para desplegar por MCP).
function presignPutUrl(bucket: string, key: string, contentType: string, expiresInSeconds: number): string {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY!;
  const region = process.env.AWS_REGION!;
  const endpoint = new URL(process.env.AWS_ENDPOINT_URL_S3!);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const host = endpoint.host;
  const canonicalUri = `/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;

  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresInSeconds),
    'X-Amz-SignedHeaders': 'content-type;host',
  };
  const canonicalQuerystring = Object.keys(queryParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&');

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign).toString('hex');

  return `${endpoint.origin}${canonicalUri}?${canonicalQuerystring}&X-Amz-Signature=${signature}`;
}

function cors(request: Request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('origin') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

interface UploadRequestBody {
  filename: string;
  contentType: string;
  size: number;
}

async function handleRequest(request: Request): Promise<Response> {
  const corsHeaders = cors(request);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { payload } = await jwtVerify(authHeader.slice(7), jwks, { issuer });
    const userId = payload.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { rows } = await pool.query(
      'SELECT role, is_admin FROM public.profiles WHERE id = $1',
      [userId]
    );
    const profile = rows[0];
    const canUpload = profile && (profile.is_admin || profile.role === 'admin' || profile.role === 'professor');
    if (!canUpload) {
      return new Response(JSON.stringify({ error: 'Forbidden: solo admin/professor pueden subir archivos' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: UploadRequestBody = await request.json();
    const { filename, contentType, size } = body;

    if (!ALLOWED_MIME_TYPES.has(contentType)) {
      return new Response(JSON.stringify({ error: `Tipo de archivo no permitido: ${contentType}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!size || size > MAX_SIZE_BYTES) {
      return new Response(JSON.stringify({ error: 'Archivo excede el límite de 50MB' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ext = filename.split('.').pop() ?? 'bin';
    const key = `${userId}/${Date.now()}.${ext}`;

    const uploadUrl = presignPutUrl(BUCKET, key, contentType, 300);
    const publicUrl = `${process.env.AWS_ENDPOINT_URL_S3}/${BUCKET}/${key}`;

    return new Response(JSON.stringify({ uploadUrl, publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export default {
  fetch: handleRequest,
};
