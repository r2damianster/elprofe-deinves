import { createRemoteJWKSet, jwtVerify } from 'jose';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

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

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: 300 }
    );

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
