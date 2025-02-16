import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb, adminAuth } from "../config/firebase-admin";
import * as admin from "firebase-admin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      driverName,
      nic,
      licensePlate,
      supervisorId,
      ward,
      district,
      municipalCouncil,
    } = req.body;

    // Validate required fields
    if (
      !driverName ||
      !nic ||
      !licensePlate ||
      !supervisorId ||
      !ward ||
      !district ||
      !municipalCouncil
    ) {
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

    // Validate license plate format (WP XX-YYYY)
    const licensePlateRegex = /^WP [A-Z]{2}-\d{4}$/;
    if (!licensePlateRegex.test(licensePlate)) {
      return res.status(400).json({
        success: false,
        error:
          'Invalid license plate format. Format should be "WP XX-YYYY" (e.g., WP AB-1234)',
      });
    }

    // Convert municipalCouncil to lowercase for consistency
    const normalizedMunicipalCouncil = municipalCouncil.toLowerCase();

    // Check for duplicate NIC across all trucks
    const duplicateNicSnapshot = await adminDb
      .collectionGroup("trucks")
      .where("nic", "==", nic)
      .get();

    if (!duplicateNicSnapshot.empty) {
      return res.status(400).json({
        success: false,
        error: "A truck driver with this NIC already exists",
      });
    }

    // Check for duplicate license plate
    const duplicateLicenseSnapshot = await adminDb
      .collectionGroup("trucks")
      .where("licensePlate", "==", licensePlate)
      .get();

    if (!duplicateLicenseSnapshot.empty) {
      return res.status(400).json({
        success: false,
        error: "A truck with this license plate already exists",
      });
    }

    // Verify the supervisor exists with correct path handling
    const supervisorRef = adminDb
      .collection("municipalCouncils")
      .doc(normalizedMunicipalCouncil)
      .collection("Districts")
      .doc(district)
      .collection("Wards")
      .doc(ward)
      .collection("supervisors")
      .doc(supervisorId);

    const supervisorDoc = await supervisorRef.get();
    if (!supervisorDoc.exists) {
      return res.status(404).json({
        success: false,
        error: `Supervisor not found: ${supervisorId} in path ${normalizedMunicipalCouncil}/${district}/${ward}`,
      });
    }

    // Check for duplicate driver name under the same supervisor
    const duplicateNameSnapshot = await supervisorRef
      .collection("trucks")
      .where("driverName", "==", driverName)
      .get();

    if (!duplicateNameSnapshot.empty) {
      return res.status(400).json({
        success: false,
        error: "A driver with this name already exists under this supervisor",
      });
    }

    // Generate truck ID
    const truckId = `TRUCK${Math.random()
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
        uid: truckId,
        password: initialPassword,
        displayName: driverName,
      });
    } catch (authError: any) {
      console.error("Error creating auth user:", authError);
      return res.status(500).json({
        success: false,
        error: "Failed to create authentication account for truck driver",
      });
    }

    // Create truck document with normalized municipalCouncil
    await supervisorRef.collection("trucks").doc(truckId).set({
      driverName,
      nic,
      licensePlate,
      truckId,
      supervisorId,
      createdAt: admin.firestore.Timestamp.now(),
      status: "active",
      ward,
      district,
      municipalCouncil: normalizedMunicipalCouncil,
    });

    return res.status(200).json({
      success: true,
      data: {
        truckId,
        password: initialPassword,
        driverName,
        nic,
        licensePlate,
        supervisorId,
      },
    });
  } catch (error: any) {
    console.error("Error creating truck:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to create truck",
    });
  }
}
