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
    const { name, nic, ward, district, municipalCouncil } = req.body;

    if (!name || !nic || !ward || !district || !municipalCouncil) {
      res.status(400).json({
        success: false,
        error: "Missing required fields",
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
        error: "A supervisor with this NIC already exists",
      });
      return;
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
      password: initialPassword,
      displayName: name,
    });

    await mcRef.collection("allNICs").doc(nic).set({
      type: "supervisor",
      supervisorId,
      municipalCouncil,
      district,
      ward,
    });

    await wardRef.collection("supervisors").doc(supervisorId).set({
      name,
      nic,
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
        supervisorId,
        password: initialPassword,
        name,
        nic,
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
