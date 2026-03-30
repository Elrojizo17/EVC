const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

function getOtpExpiryMinutes() {
        const minutes = Number(process.env.OTP_EXPIRY_MINUTES || 5);
        return Number.isFinite(minutes) && minutes > 0 ? Math.floor(minutes) : 5;
}

function getMailTemplate({ companyName, recipientName, otpCode, recipientEmail, expiryMinutes }) {
        const safeName = String(recipientName || "usuario").trim();
        const safeEmail = String(recipientEmail || "").trim();
        const safeOtp = String(otpCode || "").trim();
        const safeCompany = String(companyName || "EVC").trim();

        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <title>Codigo de verificacion</title>
</head>
<body style="margin:0;padding:24px;background:#F0F2F5;font-family:'Segoe UI',Arial,sans-serif;color:#1E293B;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
            <td align="center">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 12px 30px rgba(13,112,180,0.12);">
                    <tr>
                        <td style="padding:20px 24px;background:#FFFFFF;border-bottom:1px solid #E2E8F0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td style="vertical-align:middle;">
                                        <div style="display:inline-block;width:34px;height:34px;border-radius:10px;background:#0D70B4;text-align:center;line-height:34px;color:#FFFFFF;font-weight:700;">E</div>
                                        <span style="margin-left:10px;font-size:20px;font-weight:700;color:#0D70B4;vertical-align:middle;">${safeCompany}</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="height:6px;background:linear-gradient(90deg,#0D70B4 0%,#095332 70%,#C51623 100%);"></td>
                    </tr>

                    <tr>
                        <td style="padding:28px 24px 12px;">
                            <div style="width:52px;height:52px;border-radius:14px;background:#E7F2FA;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
                                <span style="font-size:12px;color:#0D70B4;font-weight:700;letter-spacing:0.08em;">OTP</span>
                            </div>
                            <h1 style="margin:0 0 10px;text-align:center;color:#0D70B4;font-size:28px;line-height:1.2;">Tu codigo de verificacion</h1>
                            <p style="margin:0 0 8px;text-align:center;color:#334155;font-size:15px;">Hola, ${safeName}.</p>
                            <p style="margin:0 0 22px;text-align:center;color:#475569;font-size:14px;line-height:1.6;">
                                Recibimos una solicitud para validar una accion sensible en el sistema. Usa el siguiente codigo de un solo uso para continuar.
                            </p>

                            <div style="border:1px solid #DCE8F5;border-radius:14px;padding:16px 14px;background:#F8FBFF;">
                                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.04em;color:#0D70B4;font-weight:700;text-transform:uppercase;text-align:center;">Codigo de un solo uso</p>
                                <p style="margin:0;text-align:center;font-family:'Courier New',monospace;font-weight:700;font-size:34px;letter-spacing:0.2em;color:#0D70B4;">${safeOtp}</p>
                                <p style="margin:10px 0 0;text-align:center;color:#64748B;font-size:13px;">Expira en ${expiryMinutes} minutos</p>
                            </div>

                            <div style="margin-top:16px;background:#FFF7E6;border:1px solid #FCD9A5;border-radius:14px;padding:12px 14px;">
                                <p style="margin:0;color:#8A4B08;font-size:13px;line-height:1.55;font-weight:600;">
                                    No compartas este codigo. El equipo de ${safeCompany} nunca te pedira este valor por chat, llamada o correo.
                                </p>
                            </div>

                            <p style="margin:18px 0 0;color:#475569;font-size:13px;line-height:1.6;">
                                Si no solicitaste este codigo, ignora este mensaje. Tu cuenta seguira protegida.
                            </p>
                            <p style="margin:14px 0 0;color:#334155;font-size:13px;line-height:1.6;">
                                Saludos,<br />
                                El equipo de ${safeCompany}
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:18px 24px 22px;border-top:1px solid #E2E8F0;background:#F8FAFC;">
                            <p style="margin:0 0 6px;color:#64748B;font-size:12px;">Enviado a: ${safeEmail}</p>
                            <p style="margin:0 0 8px;color:#64748B;font-size:12px;">Direccion: Sistema de Gestion de Luminarias - EVC</p>
                            <p style="margin:0;color:#0D70B4;font-size:12px;">Politica de privacidad · Cancelar suscripcion</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

        const text = [
                `${safeCompany} - Codigo OTP`,
                "",
                `Hola, ${safeName}.`,
                "Recibimos una solicitud para validar una accion en el sistema.",
                `Codigo de un solo uso: ${safeOtp}`,
                `Expira en ${expiryMinutes} minutos.`,
                "",
                "No compartas este codigo.",
                "Si no solicitaste este codigo, ignora este mensaje.",
                "",
                `Enviado a: ${safeEmail}`
        ].join("\n");

        return { html, text };
}

async function sendOtpEmail(destinatario, codigo, options = {}) {
    const sender = process.env.GMAIL_USER;
    const appPassword = String(process.env.GMAIL_APP_PASSWORD || "").trim();
    const to = String(destinatario || "").trim() || sender; // CAMBIAR CORREO AQUI
    const isPlaceholder = /tu_contrasena_de_aplicacion|app_password|changeme/i.test(appPassword);
        const companyName = String(process.env.OTP_COMPANY_NAME || "EVC").trim();
        const recipientName = String(options?.nombre || "usuario").trim();
        const expiryMinutes = getOtpExpiryMinutes();

    if (!sender) {
        throw new Error("Falta configurar GMAIL_USER en .env");
    }

    if (!appPassword || isPlaceholder) {
        throw new Error("Falta configurar GMAIL_APP_PASSWORD en .env");
    }

    const { html, text } = getMailTemplate({
        companyName,
        recipientName,
        otpCode: codigo,
        recipientEmail: to,
        expiryMinutes
    });

    await transporter.sendMail({
        from: `${companyName} <${sender}>`,
        to,
        subject: `${companyName} | Codigo OTP de verificacion`,
        text,
        html
    });
}

module.exports = {
    sendOtpEmail
};
