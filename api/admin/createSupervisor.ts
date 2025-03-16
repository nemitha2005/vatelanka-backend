import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminDb, adminAuth } from "../config/firebase-admin";
import * as admin from "firebase-admin";
import { cors } from "../middleware/cors";
import { sendSupervisorCredentials } from "../config/emailService";

async function createSupervisorHandler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { name, nic, ward, district, municipalCouncil, email, phoneNumber } =
      req.body;

    if (
      !name ||
      !nic ||
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

    const wardRef = adminDb
      .collection("municipalCouncils")
      .doc(municipalCouncil)
      .collection("Districts")
      .doc(district)
      .collection("Wards")
      .doc(ward);

    const wardDoc = await wardRef.get();
    if (!wardDoc.exists) {
      res.status(404).json({
        success: false,
        error: `Path not found: ${municipalCouncil}/${district}/${ward}`,
      });
      return;
    }

    const nameQuery = await wardRef
      .collection("supervisors")
      .where("name", "==", name)
      .get();

    if (!nameQuery.empty) {
      res.status(400).json({
        success: false,
        error: "A supervisor with this name already exists in this ward",
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

    const supervisorId = `SUP${Math.random()
      .toString(36)
      .substr(2, 6)
      .toUpperCase()}`;
    const initialPassword = `${nic.substr(-4)}${Math.random()
      .toString(36)
      .substr(2, 4)}`;

    const userRecord = await adminAuth.createUser({
      uid: supervisorId,
      email: email,
      password: initialPassword,
      displayName: name,
      phoneNumber: phoneNumber.startsWith("+")
        ? phoneNumber
        : `+94${cleanedPhoneNumber.substring(1)}`,
    });

    await mcRef.collection("allNICs").doc(nic).set({
      type: "supervisor",
      supervisorId,
      municipalCouncil,
      district,
      ward,
      email,
      phoneNumber: cleanedPhoneNumber,
    });

    await wardRef.collection("supervisors").doc(supervisorId).set({
      name,
      nic,
      email,
      phoneNumber: cleanedPhoneNumber,
      supervisorId,
      createdAt: admin.firestore.Timestamp.now(),
      status: "active",
      municipalCouncil,
      district,
      ward,
    });

    try {
      await sendSupervisorCredentials({
        name,
        email,
        supervisorId,
        password: initialPassword,
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
        supervisorId,
        password: initialPassword,
        name,
        nic,
        email,
        phoneNumber: cleanedPhoneNumber,
      },
    });
  } catch (error: any) {
    console.error("Error creating supervisor:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create supervisor",
    });
  }
}

export default cors(createSupervisorHandler);
