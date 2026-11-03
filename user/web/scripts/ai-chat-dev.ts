import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadEnv, type Plugin } from 'vite';

/** Run the shared chat server locally; never send the private key to the browser. */
export function aiChatDev(): Plugin {
  const functionsDir = fileURLToPath(new URL('../../../functions/', import.meta.url));
  const require = createRequire(path.join(functionsDir, 'package.json'));
  return {
    name: 'nesam-local-ai-chat',
    apply: 'serve',
    configureServer(server) {
      // Explicitly configured HTTP APIs and emulators keep their own backend.
      const appEnv = loadEnv(server.config.mode, server.config.root, '');
      if (appEnv.VITE_API_URL || appEnv.EXPO_PUBLIC_API_URL || appEnv.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === 'true') return;
      const env = loadEnv(server.config.mode, functionsDir, 'GROQ_');
      for (const name of ['GROQ_API_KEY', 'GROQ_MODEL']) {
        if (!process.env[name] && env[name]) process.env[name] = env[name];
      }
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== '/__functions/chatWithBot') return next();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        const fail = (status: number, code: string, message: string) => {
          res.statusCode = status;
          res.end(JSON.stringify({ error: { status: code, message } }));
        };
        if (req.method !== 'POST') return fail(405, 'INVALID_ARGUMENT', 'Use POST.');
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) {
          return fail(403, 'PERMISSION_DENIED', 'Origin not allowed.');
        }
        try {
          let body = '';
          for await (const chunk of req) {
            body += chunk.toString();
            if (Buffer.byteLength(body) > 64 * 1024) return fail(413, 'INVALID_ARGUMENT', 'Message history is too large.');
          }
          let parsed;
          try { parsed = JSON.parse(body); } catch { return fail(400, 'INVALID_ARGUMENT', 'Invalid JSON.'); }
          const { chatWithBot } = require(path.join(functionsDir, 'lib/groqChat.js'));
          const result = await chatWithBot.run({ data: parsed.data, rawRequest: req });
          res.end(JSON.stringify({ result }));
        } catch (err) {
          const code = (err as { code?: string }).code;
          if (code === 'resource-exhausted') return fail(429, 'RESOURCE_EXHAUSTED', 'Please wait before sending another message.');
          if (code === 'invalid-argument') return fail(400, 'INVALID_ARGUMENT', 'Please send a message.');
          server.config.logger.error('Local AI chat failed. Run npm --prefix functions run build and restart the dev server.');
          fail(503, 'UNAVAILABLE', 'The assistant is temporarily unavailable.');
        }
      });
    },
  };
}
