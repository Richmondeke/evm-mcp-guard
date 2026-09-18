import app from '../src/server.js';

export default function handler(req: any, res: any) {
  // Vercel serverless: forward full request to Express
  return app(req, res);
}
