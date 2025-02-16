import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb, adminAuth } from "../config/firebase-admin";
import * as admin from "firebase-admin";
import { cors } from "../middleware/cors";

async function createTruckHandler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
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
      res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
      return;
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
      res.status(404).json({
        success: false,
        error: `Supervisor not found: ${supervisorId} in path ${municipalCouncil}/${district}/${ward}`,
      });
      return;
    }

    const mcRef = adminDb.collection("municipalCouncils").doc(municipalCouncil);

    const nicSnapshot = await mcRef.collection("allNICs").doc(nic).get();
    if (nicSnapshot.exists) {
      res.status(400).json({
        success: false,
        error: "A driver with this NIC already exists",
      });
      return;
    }

    const plateSnapshot = await mcRef
      .collection("allPlates")
      .doc(numberPlate)
      .get();
    if (plateSnapshot.exists) {
      res.status(400).json({
        success: false,
        error: "A truck with this number plate already exists",
      });
      return;
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
      res.status(500).json({
        success: false,
        error: "Failed to create authentication account for truck driver",
      });
      return;
    }

    await mcRef.collection("allNICs").doc(nic).set({
      type: "truck",
      truckId,
      municipalCouncil,
      district,
      ward,
      supervisorId,
    });

    await mcRef.collection("allPlates").doc(numberPlate).set({
      truckId,
      municipalCouncil,
      district,
      ward,
      supervisorId,
    });

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

    res.status(200).json({
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
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create truck",
    });
  }
}

export default cors(createTruckHandler);
