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
      email,
    } = req.body;

    if (
      !driverName ||
      !nic ||
      !numberPlate ||
      !supervisorId ||
      !ward ||
      !district ||
      !municipalCouncil ||
      !email
    ) {
      res.status(400).json({
        success: false,
        error:
          "Missing required fields. All fields including email are required.",
      });
      return;
    }

    const nicRegex = /^(?:\d{12}|\d{9}[vVxX])$/;
    if (!nicRegex.test(nic)) {
      res.status(400).json({
        success: false,
        error:
          "Invalid NIC format. Must be either 12 digits or 9 digits followed by V/X",
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

    const plateRegex = /^[A-Z]{2,3}[-][0-9]{4}$/;
    if (!plateRegex.test(numberPlate)) {
      res.status(400).json({
        success: false,
        error:
          "Invalid number plate format. Should be like 'XX-1234' or 'XXX-1234'",
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

    const globalNameQuery = await adminDb
      .collectionGroup("trucks")
      .where("driverName", "==", driverName)
      .get();

    if (!globalNameQuery.empty) {
      const existingDriver = globalNameQuery.docs[0].data();
      res.status(400).json({
        success: false,
        error: `A driver with this name already exists in ${existingDriver.municipalCouncil}/${existingDriver.district}/${existingDriver.ward}`,
      });
      return;
    }

    const globalEmailQuery = await adminDb
      .collectionGroup("trucks")
      .where("email", "==", email)
      .get();

    if (!globalEmailQuery.empty) {
      res.status(400).json({
        success: false,
        error: "This email is already registered in the system",
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

    const supervisorNicRef = adminDb.collection("supervisorNICs").doc(nic);
    const supervisorNicSnapshot = await supervisorNicRef.get();

    if (supervisorNicSnapshot.exists) {
      res.status(400).json({
        success: false,
        error: "This NIC is already registered as a supervisor",
      });
      return;
    }

    const plateRef = adminDb.collection("vehiclePlates").doc(numberPlate);
    const plateSnapshot = await plateRef.get();

    if (plateSnapshot.exists) {
      res.status(400).json({
        success: false,
        error: "This number plate is already registered in the system",
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
        email: email,
        emailVerified: true,
        password: initialPassword,
        displayName: driverName,
        disabled: false,
      });

      await driverNicRef.set({
        truckId,
        driverName,
        municipalCouncil,
        district,
        ward,
        supervisorId,
        email,
        createdAt: admin.firestore.Timestamp.now(),
      });

      await plateRef.set({
        truckId,
        driverName,
        municipalCouncil,
        district,
        ward,
        supervisorId,
        createdAt: admin.firestore.Timestamp.now(),
      });

      await supervisorRef.collection("trucks").doc(truckId).set({
        driverName,
        nic,
        email,
        numberPlate,
        truckId,
        supervisorId,
        createdAt: admin.firestore.Timestamp.now(),
        status: "active",
        municipalCouncil,
        district,
        ward,
        passwordChangeRequired: true,
        lastPasswordChange: admin.firestore.Timestamp.now(),
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
          email,
        },
      });
    } catch (authError: any) {
      console.error("Error creating auth user:", authError);
      res.status(500).json({
        success: false,
        error: "Failed to create authentication account for truck driver",
      });
      return;
    }
  } catch (error: any) {
    console.error("Error creating truck:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create truck",
    });
  }
}

export default cors(createTruckHandler);
