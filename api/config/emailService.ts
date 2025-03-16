import nodemailer from "nodemailer";

interface SupervisorEmailData {
  name: string;
  email: string;
  supervisorId: string;
  password: string;
  ward: string;
  district: string;
  municipalCouncil: string;
  phoneNumber?: string;
}

interface DriverEmailData {
  driverName: string;
  email: string;
  truckId: string;
  password: string;
  numberPlate: string;
  ward: string;
  district: string;
  municipalCouncil: string;
  phoneNumber?: string;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const supervisorEmailTemplate = (data: SupervisorEmailData): string => {
  return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
                    <h2 style="color: #2c3e50; margin-top: 0;">Welcome to VateLanka Service Portal</h2>
                    
                    <p style="font-size: 16px;">Dear ${data.name},</p>
                    
                    <p>Your supervisor account has been created successfully.</p>
                    
                    <div style="background-color: #fff; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <p style="margin: 5px 0;"><strong>Area Details:</strong></p>
                        <ul style="list-style: none; padding-left: 0;">
                            <li>Municipal Council: ${data.municipalCouncil}</li>
                            <li>District: ${data.district}</li>
                            <li>Ward: ${data.ward}</li>
                            ${
                              data.phoneNumber
                                ? `<li>Phone Number: ${data.phoneNumber}</li>`
                                : ""
                            }
                        </ul>
                    </div>

                    <div style="background-color: #fff; padding: 15px; border-radius: 5px; margin: 15px 0; border: 2px solid #e74c3c;">
                        <p style="margin: 5px 0; color: #e74c3c;"><strong>Your Login Credentials:</strong></p>
                        <p style="margin: 5px 0;">User ID: <strong>${
                          data.supervisorId
                        }</strong></p>
                        <p style="margin: 5px 0;">Password: <strong>${
                          data.password
                        }</strong></p>
                    </div>

                    <div style="background-color: #fff4e6; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <p style="color: #fd7e14; margin: 0;"><strong>Important:</strong></p>
                        <ul>
                            <li>If you forgot your Password Please Contact Admin Help</li>
                            <li>Keep your credentials secure</li>
                            <li>Do not share your login information</li>
                        </ul>
                    </div>

                    <p style="margin-top: 20px;">If you have any questions, please contact the administrator.</p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    
                    <p style="color: #666;">Best regards,<br>VateLanka</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

const driverEmailTemplate = (data: DriverEmailData): string => {
  return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
                    <h2 style="color: #2c3e50; margin-top: 0;">Welcome to VateLanka Service Portal</h2>
                    
                    <p style="font-size: 16px;">Dear ${data.driverName},</p>
                    
                    <p>Your truck driver account has been created successfully.</p>
                    
                    <div style="background-color: #fff; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <p style="margin: 5px 0;"><strong>Assignment Details:</strong></p>
                        <ul style="list-style: none; padding-left: 0;">
                            <li>Municipal Council: ${data.municipalCouncil}</li>
                            <li>District: ${data.district}</li>
                            <li>Ward: ${data.ward}</li>
                            <li>Vehicle Number: ${data.numberPlate}</li>
                            ${
                              data.phoneNumber
                                ? `<li>Phone Number: ${data.phoneNumber}</li>`
                                : ""
                            }
                        </ul>
                    </div>

                    <div style="background-color: #fff; padding: 15px; border-radius: 5px; margin: 15px 0; border: 2px solid #e74c3c;">
                        <p style="margin: 5px 0; color: #e74c3c;"><strong>Your Login Credentials:</strong></p>
                        <p style="margin: 5px 0;">User ID: <strong>${
                          data.truckId
                        }</strong></p>
                        <p style="margin: 5px 0;">Password: <strong>${
                          data.password
                        }</strong></p>
                    </div>

                    <div style="background-color: #fff4e6; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <p style="color: #fd7e14; margin: 0;"><strong>Important:</strong></p>
                        <ul>
                            <li>If you forgot your Password Please Contact Admin Help</li>
                            <li>Keep your credentials secure</li>
                            <li>Do not share your login information</li>
                        </ul>
                    </div>

                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    
                    <p style="color: #666;">Best regards,<br>VateLanka </p>
                </div>
            </div>
        </body>
        </html>
    `;
};

export async function sendSupervisorCredentials(
  data: SupervisorEmailData
): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"VateLanka - Waste Management System" <${process.env.SMTP_USER}>`,
      to: data.email,
      subject: "Your Supervisor Account Credentials",
      html: supervisorEmailTemplate(data),
    });
    console.log(`Credentials sent successfully to supervisor: ${data.email}`);
  } catch (error) {
    console.error("Error sending supervisor credentials email:", error);
    throw new Error("Failed to send supervisor credentials email");
  }
}

export async function sendDriverCredentials(
  data: DriverEmailData
): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"VateLanka - Waste Management System" <${process.env.SMTP_USER}>`,
      to: data.email,
      subject: "Your Driver Account Credentials",
      html: driverEmailTemplate(data),
    });
    console.log(`Credentials sent successfully to driver: ${data.email}`);
  } catch (error) {
    console.error("Error sending driver credentials email:", error);
    throw new Error("Failed to send driver credentials email");
  }
}
