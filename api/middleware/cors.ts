import type { VercelRequest, VercelResponse } from "@vercel/node";

const allowedOrigins = [
  'http://localhost:3000',
  'https://vatelanka.lk',
  'https://vate-lanka-lk.vercel.app'
];

type VercelHandler = (
  req: VercelRequest,
  res: VercelResponse
) => Promise<void> | void;

export function cors(handler: VercelHandler): VercelHandler {
  return async (req: VercelRequest, res: VercelResponse) => {
    const origin = req.headers.origin;
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    return handler(req, res);
  };
}