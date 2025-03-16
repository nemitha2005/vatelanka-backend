import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb, adminAuth } from "../config/firebase-admin";
import * as admin from "firebase-admin";
import { cors } from "../middleware/cors";
import { sendDriverCredentials } from "../config/emailService";

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
      phoneNumber,
    } = req.body;

    if (
      !driverName ||
      !nic ||
      !numberPlate ||
      !supervisorId ||
      !ward ||
      !district ||
      !municipalCouncil ||
      !email ||
      !phoneNumber
    ) {
      res.status(400).json({
        success: false,
        error: "Missing required fields",
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

    const phoneRegex = /^\d{10}$/;
    const cleanedPhoneNumber = phoneNumber.replace(/\D/g, "");
    if (!phoneRegex.test(cleanedPhoneNumber)) {
      res.status(400).json({
        success: false,
        error: "Phone number must be exactly 10 digits",
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
        error: "This NIC is already in use. Please Check Again",
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

    try {
      const emailUser = await adminAuth.getUserByEmail(email);
      if (emailUser) {
        res.status(400).json({
          success: false,
          error: "Email is already in use",
        });
        return;
      }
    } catch (error: any) {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
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
        password: initialPassword,
        displayName: driverName,
        phoneNumber: phoneNumber.startsWith("+")
          ? phoneNumber
          : `+94${cleanedPhoneNumber.substring(1)}`,
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
      email,
      phoneNumber: cleanedPhoneNumber,
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
      email,
      phoneNumber: cleanedPhoneNumber,
      numberPlate,
      truckId,
      supervisorId,
      createdAt: admin.firestore.Timestamp.now(),
      status: "active",
      municipalCouncil,
      district,
      ward,
    });

    try {
      await sendDriverCredentials({
        driverName,
        email,
        truckId,
        password: initialPassword,
        numberPlate,
        ward,
        district,
        municipalCouncil,
        phoneNumber: cleanedPhoneNumber,
      });
    } catch (emailError) {
      console.error("Failed to send email but user was created:", emailError);
    }

    res.status(200).json({
      success: true,
      data: {
        truckId,
        password: initialPassword,
        driverName,
        nic,
        email,
        phoneNumber: cleanedPhoneNumber,
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
