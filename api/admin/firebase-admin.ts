import * as admin from 'firebase-admin';
import serviceAccount from '../config/vatelanka-e6828-firebase-adminsdk-iq7d8-edd6da51b8.json';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
  });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();