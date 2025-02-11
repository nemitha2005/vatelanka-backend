import type { VercelRequest, VercelResponse } from '@vercel/node'
import firebaseConfig from '../../config/firebase'

export default function handler(req: VercelRequest, res: VercelResponse) {
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  return res.json(firebaseConfig)
}