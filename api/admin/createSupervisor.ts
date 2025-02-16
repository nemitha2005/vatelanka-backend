import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb, adminAuth } from "../config/firebase-admin";
import * as admin from "firebase-admin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, nic, ward, district, municipalCouncil } = req.body;

    if (!name || !nic || !ward || !district || !municipalCouncil) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const wardRef = adminDb
      .collection("municipalCouncils")
      .doc(municipalCouncil)
      .collection("Districts")
      .doc(district)
      .collection("Wards")
      .doc(ward);

    const wardDoc = await wardRef.get();
    if (!wardDoc.exists) {
      return res.status(404).json({
        success: false,
        error: `Path not found: ${municipalCouncil}/${district}/${ward}`,
      });
    }

    const nameQuery = await wardRef
      .collection("supervisors")
      .where("name", "==", name)
      .get();

    if (!nameQuery.empty) {
      return res.status(400).json({
        success: false,
        error: "A supervisor with this name already exists in this ward",
      });
    }

    const mcRef = adminDb.collection("municipalCouncils").doc(municipalCouncil);
    const nicSnapshot = await mcRef.collection("allNICs").doc(nic).get();

    if (nicSnapshot.exists) {
      return res.status(400).json({
        success: false,
        error: "A supervisor with this NIC already exists",
      });
    }

    const supervisorId = `SUP${Math.random()
      .toString(36)
      .substr(2, 6)
      .toUpperCase()}`;
    const initialPassword = `${nic.substr(-4)}${Math.random()
      .toString(36)
      .substr(2, 4)}`;

    const userRecord = await adminAuth.createUser({
      uid: supervisorId,
      password: initialPassword,
      displayName: name,
    });

    await mcRef.collection("allNICs").doc(nic).set({
      type: "supervisor",
      supervisorId,
      municipalCouncil,
      district,
      ward,
    });

    await wardRef.collection("supervisors").doc(supervisorId).set({
      name,
      nic,
      supervisorId,
      createdAt: admin.firestore.Timestamp.now(),
      status: "active",
      municipalCouncil,
      district,
      ward,
    });

    return res.status(200).json({
      success: true,
      data: {
        supervisorId,
        password: initialPassword,
        name,
        nic,
      },
    });
  } catch (error: any) {
    console.error("Error creating supervisor:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to create supervisor",
    });
  }
}
