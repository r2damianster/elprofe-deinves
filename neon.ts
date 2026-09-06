import { defineConfig } from '@neon/config/v1';

export default defineConfig({
  preview: {
    functions: {
      'ai-enhance': {
        name: 'AI Enhance (GROQ proxy)',
        source: './neon-functions/ai-enhance.ts',
      },
      'media-upload': {
        name: 'Media upload (lesson-media presigned URLs)',
        source: './neon-functions/media-upload.ts',
      },
    },
  },
});
