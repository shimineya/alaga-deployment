require('dotenv').config();
const nodemailer = require('nodemailer');

async function testSmtp() {
    const smtp = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    };

    console.log("SMTP Config:", { ...smtp, pass: smtp.pass ? '***' : 'missing' });

    const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass },
    });

    try {
        console.log("Verifying connection...");
        await transporter.verify();
        console.log("Connection OK.");
        
        console.log("Sending test email...");
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || smtp.user,
            to: smtp.user,
            subject: "ALAGA Test Email",
            text: "This is a test email."
        });
        console.log("Email sent:", info.response);
    } catch (err) {
        console.error("SMTP Error:");
        console.error(err);
    }
}

testSmtp();
