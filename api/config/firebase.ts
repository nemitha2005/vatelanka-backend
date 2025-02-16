import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const firebaseConfig = {
    apiKey: "AIzaSyDeBAqbYbQSoDYruvYZ_cVdJ8dbfOTGRRE",
    authDomain: "vatelanka-e6828.firebaseapp.com",
    projectId: "vatelanka-e6828",
    storageBucket: "vatelanka-e6828.firebasestorage.app",
    messagingSenderId: "444350594980",
    appId: "1:444350594980:web:38660abe178b78750b4b31",
    measurementId: "G-0C4KQG6Q61",
  };

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  return res.json(firebaseConfig);
}
