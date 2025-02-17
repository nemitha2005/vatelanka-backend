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

    const emailQuery = await supervisorRef
      .collection("trucks")
      .where("email", "==", email)
      .get();

    if (!emailQuery.empty) {
      res.status(400).json({
        success: false,
        error: "A truck driver with this email already exists",
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

      await mcRef.collection("allNICs").doc(nic).set({
        type: "truck",
        truckId,
        municipalCouncil,
        district,
        ward,
        supervisorId,
        email,
        createdAt: admin.firestore.Timestamp.now(),
      });

      await mcRef.collection("allPlates").doc(numberPlate).set({
        truckId,
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
