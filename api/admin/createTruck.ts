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
      numberPlate,
      supervisorId,
      ward,
      district,
      municipalCouncil,
    } = req.body;

    if (
      !driverName ||
      !nic ||
      !numberPlate ||
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

    const nameQuery = await adminDb
      .collectionGroup("trucks")
      .where("driverName", "==", driverName)
      .get();

    if (!nameQuery.empty) {
      return res.status(400).json({
        success: false,
        error: "A truck driver with this name already exists",
      });
    }

    const nicQuery = await adminDb
      .collectionGroup("trucks")
      .where("nic", "==", nic)
      .get();

    if (!nicQuery.empty) {
      return res.status(400).json({
        success: false,
        error: "A truck driver with this NIC already exists",
      });
    }

    const numberPlateQuery = await adminDb
      .collectionGroup("trucks")
      .where("numberPlate", "==", numberPlate)
      .get();

    if (!numberPlateQuery.empty) {
      return res.status(400).json({
        success: false,
        error: "A truck with this number plate already exists",
      });
    }

    const truckId = `TRUCK${Math.random()
      .toString(36)
      .substr(2, 6)
      .toUpperCase()}`;
    const initialPassword = `${nic.substr(-4)}${Math.random()
      .toString(36)
      .substr(2, 4)}`;

    try {
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

    await supervisorRef.collection("trucks").doc(truckId).set({
      driverName,
      nic,
      numberPlate,
      truckId,
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
        truckId,
        password: initialPassword,
        driverName,
        nic,
        numberPlate,
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
