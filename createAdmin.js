require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function createAdmin() {
    await mongoose.connect(process.env.MONGODB_URI);

    const existing = await User.findOne({ email: 'admin@gmail.com' });
    if (existing) {
        console.log('Admin đã tồn tại!');
        process.exit(0);
    }

    await User.create({
        fullName: 'Admin',
        email: 'admin@gmail.com',
        password: '123456',
        role: 'admin',
        isEmailVerified: true,
        isActive: true,
        authMethods: ['local']
    });

    console.log('Tạo admin thành công!');
    console.log('Email: admin@gmail.com');
    console.log('Password: admin123456');
    process.exit(0);
}

createAdmin().catch(err => {
    console.error(err);
    process.exit(1);
});