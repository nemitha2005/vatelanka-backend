import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb, adminAuth } from "../config/firebase-admin";
import * as admin from "firebase-admin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { driverName, nic, supervisorId, ward, district, municipalCouncil } =
      req.body;

    // Validate required fields
    if (
      !driverName ||
      !nic ||
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

    // Verify the supervisor exists before creating the truck
    const supervisorRef = adminDb
      .collection("municipalCouncils")
      .doc(municipalCouncil)
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
        error: `Supervisor not found: ${supervisorId} in path ${municipalCouncil}/${district}/${ward}`,
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

    // Create truck document
    await supervisorRef.collection("trucks").doc(truckId).set({
      driverName,
      nic,
      truckId,
      supervisorId,
      createdAt: admin.firestore.Timestamp.now(),
      status: "active",
    });

    return res.status(200).json({
      success: true,
      data: {
        truckId,
        password: initialPassword,
        driverName,
        nic,
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
