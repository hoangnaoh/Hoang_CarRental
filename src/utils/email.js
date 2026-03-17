const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (options) => {
    if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY must be defined in environment variables');
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'Hoang_CarRental <onboarding@resend.dev>', // Dùng domain mặc định của Resend
            to: options.email,
            subject: options.subject,
            html: options.html,
        });

        if (error) {
            throw new Error(error.message);
        }

        console.log("Email sent successfully:", data.id);
        return data;
    } catch (error) {
        console.error("Email error:", error.message);
        throw error;
    }
};

const sendEmailWithRetry = async (options, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempt ${attempt} to send email...`);
            return await sendEmail(options);
        } catch (error) {
            console.log(`Attempt ${attempt} failed:`, error.message);
            if (attempt === maxRetries) {
                throw new Error(`Failed to send email after ${maxRetries} attempts: ${error.message}`);
            }
            const waitTime = attempt * 2000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
};

module.exports = { sendEmail, sendEmailWithRetry };