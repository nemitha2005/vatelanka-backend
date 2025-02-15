import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb, adminAuth } from './firebase-admin';
import * as admin from 'firebase-admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, nic, ward, district, municipalCouncil } = req.body;

    // Generate supervisor ID
    const supervisorId = `SUP${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // Generate initial password
    const initialPassword = `${nic.substr(-4)}${Math.random().toString(36).substr(2, 4)}`;

    // Create auth user
    const userRecord = await adminAuth.createUser({
      uid: supervisorId,
      password: initialPassword,
      displayName: name,
    });

    // Create supervisor document
    await adminDb
      .collection('municipalCouncils')
      .doc(municipalCouncil)
      .collection('Districts')
      .doc(district)
      .collection('Wards')
      .doc(ward)
      .collection('supervisors')
      .doc(supervisorId)
      .set({
        name,
        nic,
        supervisorId,
        createdAt: admin.firestore.Timestamp.now(),
        status: 'active'
      });

    return res.status(200).json({
      success: true,
      data: {
        supervisorId,
        password: initialPassword,
        name,
        nic
      }
    });

  } catch (error) {
    console.error('Error creating supervisor:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create supervisor'
    });
  }
}