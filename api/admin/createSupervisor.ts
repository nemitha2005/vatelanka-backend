import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb, adminAuth } from './firebase-admin';
import * as admin from 'firebase-admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, nic, ward, district, municipalCouncil } = req.body;

    // Validate required fields
    if (!name || !nic || !ward || !district || !municipalCouncil) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Verify the path exists before creating the supervisor
    const wardRef = adminDb
      .collection('municipalCouncils')
      .doc(municipalCouncil)
      .collection('Districts')
      .doc(district)
      .collection('Wards')
      .doc(ward);

    const wardDoc = await wardRef.get();
    if (!wardDoc.exists) {
      return res.status(404).json({
        success: false,
        error: `Path not found: ${municipalCouncil}/${district}/${ward}`
      });
    }

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
    await wardRef.collection('supervisors').doc(supervisorId).set({
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

  } catch (error: any) {
    console.error('Error creating supervisor:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create supervisor'
    });
  }
}