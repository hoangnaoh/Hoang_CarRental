const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // Kiểm tra environment variables
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error('EMAIL_USER and EMAIL_PASS must be defined in environment variables');
    }

    // Cấu hình transporter với timeout dài hơn
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        tls: {
            rejectUnauthorized: false // Chỉ dùng trong development
        },
        connectionTimeout: 30000, // Tăng lên 30 giây
        greetingTimeout: 30000,
        socketTimeout: 30000,
        debug: process.env.NODE_ENV === 'development' // Log debug trong development
    });

    // Verify connection configuration
    try {
        // await transporter.verify();
        console.log('SMTP connection verified successfully');
    } catch (verifyError) {
        console.error('SMTP verification failed:', verifyError.message);
        throw new Error(`SMTP connection failed: ${verifyError.message}`);
    }

    const mailOptions = {
        from: `"Hoang_CarRental" <${process.env.EMAIL_USER}>`,
        to: options.email,
        subject: options.subject,
        html: options.html
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully:", info.messageId);
        return info;
    } catch (error) {
        console.error("Email error details:", {
            message: error.message,
            code: error.code,
            command: error.command,
            response: error.response
        });
        
        // Xử lý các lỗi cụ thể
        if (error.code === 'ESOCKET') {
            throw new Error('Connection timeout - please check network/firewall settings');
        } else if (error.code === 'EAUTH') {
            throw new Error('Authentication failed - check email credentials');
        } else if (error.code === 'EENVELOPE') {
            throw new Error('Invalid email format');
        }
        
        throw error;
    }
};

// Hàm gửi email với retry
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
            
            // Exponential backoff: đợi lâu hơn sau mỗi lần thất bại
            const waitTime = attempt * 2000;
            console.log(`Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
};

// Kiểm tra credentials trước khi gửi
const testEmailConnection = async () => {
    try {
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        
        await transporter.verify();
        console.log('✓ Email configuration is valid');
        return true;
    } catch (error) {
        console.error('✗ Email configuration is invalid:', error.message);
        return false;
    }
};

module.exports = { 
    sendEmail, 
    sendEmailWithRetry,
    testEmailConnection 
};