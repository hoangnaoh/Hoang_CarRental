const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Tên xe là bắt buộc'],
        trim: true
    },
    licensePlate: {
        type: String,
        required: [true, 'Biển số là bắt buộc'],
        unique: true,
        uppercase: true,
        trim: true
    },
    brand: {
        type: String,
        required: [true, 'Hãng xe là bắt buộc'],
        enum: ['Toyota', 'Honda', 'Hyundai', 'VinFast', 'Ford', 'Mercedes-Benz', 'BMW', 'Kia', 'Mazda', 'Other']
    },
    type: {
        type: String,
        required: [true, 'Loại xe là bắt buộc'],
        enum: ['Sedan', 'SUV', 'Hatchback', 'MPV', 'Pickup', 'Van']
    },
    seats: {
        type: Number,
        required: [true, 'Số chỗ ngồi là bắt buộc'],
        enum: [4, 5, 7, 9, 16]
    },
    pricePerDay: {
        type: Number,
        required: [true, 'Giá thuê/ngày là bắt buộc']
    },
    status: {
        type: String,
        enum: ['available', 'rented', 'maintenance'],
        default: 'available'
    },
    images: [String],
    description: String
}, { timestamps: true });

module.exports = mongoose.model('Car', carSchema);