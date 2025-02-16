import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb, adminAuth } from "../config/firebase-admin";
import * as admin from "firebase-admin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, nic, ward, district, municipalCouncil } = req.body;

    // Validate required fields
    if (!name || !nic || !ward || !district || !municipalCouncil) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    // Validate NIC format
    const nicRegex = /^[0-9]{12}$/;
    if (!nicRegex.test(nic)) {
      return res.status(400).json({
        success: false,
        error: "Invalid NIC format. NIC should be 12 digits",
      });
    }

    // Check for duplicate NIC across all supervisors in the municipal council
    const duplicateNicSnapshot = await adminDb
      .collectionGroup("supervisors")
      .where("nic", "==", nic)
      .get();

    if (!duplicateNicSnapshot.empty) {
      return res.status(400).json({
        success: false,
        error: "A supervisor with this NIC already exists",
      });
    }

    // Check for duplicate name in the same ward
    const wardRef = adminDb
      .collection("municipalCouncils")
      .doc(municipalCouncil)
      .collection("Districts")
      .doc(district)
      .collection("Wards")
      .doc(ward);

    const duplicateNameSnapshot = await wardRef
      .collection("supervisors")
      .where("name", "==", name)
      .get();

    if (!duplicateNameSnapshot.empty) {
      return res.status(400).json({
        success: false,
        error: "A supervisor with this name already exists in this ward",
      });
    }

    // Verify the ward exists
    const wardDoc = await wardRef.get();
    if (!wardDoc.exists) {
      return res.status(404).json({
        success: false,
        error: `Path not found: ${municipalCouncil}/${district}/${ward}`,
      });
    }

    // Generate supervisor ID
    const supervisorId = `SUP${Math.random()
      .toString(36)
      .substr(2, 6)
      .toUpperCase()}`;

    // Generate initial password
    const initialPassword = `${nic.substr(-4)}${Math.random()
      .toString(36)
      .substr(2, 4)}`;

    try {
      // Create auth user
      const userRecord = await adminAuth.createUser({
        uid: supervisorId,
        password: initialPassword,
        displayName: name,
      });
    } catch (authError: any) {
      console.error("Error creating auth user:", authError);
      return res.status(500).json({
        success: false,
        error: "Failed to create authentication account for supervisor",
      });
    }

    // Create supervisor document
    await wardRef.collection("supervisors").doc(supervisorId).set({
      name,
      nic,
      supervisorId,
      createdAt: admin.firestore.Timestamp.now(),
      status: "active",
      ward,
      district,
      municipalCouncil,
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
