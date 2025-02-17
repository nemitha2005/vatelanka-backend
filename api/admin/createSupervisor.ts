import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb, adminAuth } from "../config/firebase-admin";
import * as admin from "firebase-admin";
import { cors } from "../middleware/cors";

async function createSupervisorHandler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { name, nic, ward, district, municipalCouncil, email } = req.body;

    if (!name || !nic || !ward || !district || !municipalCouncil || !email) {
      res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
      return;
    }

    // Input validation
    const nicRegex = /^(?:\d{12}|\d{9}[vVxX])$/;
    if (!nicRegex.test(nic)) {
      res.status(400).json({
        success: false,
        error: "Invalid NIC format. Must be either 12 digits or 9 digits followed by V/X",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        error: "Invalid email format",
      });
      return;
    }

    // Path validation
    const correctDistrict = "District 1";  // Hardcoding the correct district name
    if (district !== correctDistrict) {
      res.status(400).json({
        success: false,
        error: `Invalid district. Only '${correctDistrict}' is currently supported.`,
      });
      return;
    }

    const wardRef = adminDb
      .collection("municipalCouncils")
      .doc(municipalCouncil)
      .collection("Districts")
      .doc(correctDistrict)
      .collection("Wards")
      .doc(ward);

    const wardDoc = await wardRef.get();
    if (!wardDoc.exists) {
      res.status(404).json({
        success: false,
        error: `Ward not found at path: /municipalCouncils/${municipalCouncil}/Districts/${correctDistrict}/Wards/${ward}`,
      });
      return;
    }

    // Global name uniqueness check
    const globalNameQuery = await adminDb.collectionGroup("supervisors")
      .where("name", "==", name)
      .get();

    if (!globalNameQuery.empty) {
      const existingSupervisor = globalNameQuery.docs[0].data();
      res.status(400).json({
        success: false,
        error: `A supervisor with this name already exists in ${existingSupervisor.municipalCouncil}/${existingSupervisor.district}/${existingSupervisor.ward}`,
      });
      return;
    }

    // Global email uniqueness check
    const globalEmailQuery = await adminDb.collectionGroup("supervisors")
      .where("email", "==", email)
      .get();

    if (!globalEmailQuery.empty) {
      res.status(400).json({
        success: false,
        error: "This email is already registered in the system",
      });
      return;
    }

    // Check NIC in both collections
    const supervisorNicRef = adminDb.collection("supervisorNICs").doc(nic);
    const nicSnapshot = await supervisorNicRef.get();

    if (nicSnapshot.exists) {
      res.status(400).json({
        success: false,
        error: "This NIC is already registered as a supervisor",
      });
      return;
    }

    const driverNicRef = adminDb.collection("driverNICs").doc(nic);
    const driverNicSnapshot = await driverNicRef.get();

    if (driverNicSnapshot.exists) {
      res.status(400).json({
        success: false,
        error: "This NIC is already registered as a driver",
      });
      return;
    }

    // Generate IDs
    const supervisorId = `SUP${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const initialPassword = `${nic.substr(-4)}${Math.random().toString(36).substr(2, 4)}`;

    try {
      // Create auth user
      const userRecord = await adminAuth.createUser({
        uid: supervisorId,
        email: email,
        emailVerified: true,
        password: initialPassword,
        displayName: name,
        disabled: false,
      });

      // Store in NIC collection
      await supervisorNicRef.set({
        supervisorId,
        name,
        municipalCouncil,
        district: correctDistrict,
        ward,
        email,
        createdAt: admin.firestore.Timestamp.now(),
      });

      // Store main supervisor data
      await wardRef.collection("supervisors").doc(supervisorId).set({
        name,
        nic,
        email,
        supervisorId,
        createdAt: admin.firestore.Timestamp.now(),
        status: "active",
        municipalCouncil,
        district: correctDistrict,
        ward,
        passwordChangeRequired: true,
        lastPasswordChange: admin.firestore.Timestamp.now(),
      });

      res.status(200).json({
        success: true,
        data: {
          supervisorId,
          password: initialPassword,
          name,
          nic,
          email,
        },
      });
    } catch (authError: any) {
      console.error("Error in authentication creation:", authError);
      res.status(500).json({
        success: false,
        error: "Failed to create authentication account",
      });
      return;
    }
  } catch (error: any) {
    console.error("Error creating supervisor:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create supervisor",
    });
  }
}

export default cors(createSupervisorHandler);