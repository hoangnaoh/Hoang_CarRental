const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // BỎ QUA HOÀN TOÀN VIỆC GỬI EMAIL
    console.log('📧 Email sending is DISABLED (development mode)');
    console.log('Email content that would have been sent:', {
        to: options.email,
        subject: options.subject,
        html: options.html?.substring(0, 100) + '...' // Log phần đầu của HTML
    });
    
    // Giả lập thành công
    return {
        success: true,
        messageId: 'dev-mode-' + Date.now(),
        message: 'Email sending skipped (development mode)'
    };
};

// Hàm gửi email với retry - cũng bỏ qua
const sendEmailWithRetry = async (options, maxRetries = 3) => {
    console.log(`📧 Email sending with retry is DISABLED (development mode)`);
    console.log(`Would attempt ${maxRetries} times to send to:`, options.email);
    
    // Giả lập thành công ngay lần đầu
    return {
        success: true,
        messageId: 'dev-mode-retry-' + Date.now(),
        message: 'Email sending skipped (development mode)'
    };
};

// Kiểm tra credentials - luôn trả về true
const testEmailConnection = async () => {
    console.log('🔧 Email verification is BYPASSED (development mode)');
    console.log('✓ Email configuration is considered valid (bypassed)');
    return true;
};

module.exports = { 
    sendEmail, 
    sendEmailWithRetry,
    testEmailConnection 
};