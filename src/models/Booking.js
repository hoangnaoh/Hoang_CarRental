const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    car: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Car',
        required: true
    },
    startDate: {
        type: Date,
        required: [true, 'Ngày bắt đầu là bắt buộc']
    },
    endDate: {
        type: Date,
        required: [true, 'Ngày kết thúc là bắt buộc']
    },
    totalDays: Number,
    totalAmount: Number,
    customerNote: String,
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'active', 'completed', 'cancelled'],
        default: 'pending'
    },
    cancelReason: String
}, { timestamps: true });

// Tự tính số ngày và tổng tiền
bookingSchema.pre('save', async function (next) {
    if (this.startDate && this.endDate) {
        const days = Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
        this.totalDays = days;
        if (!this.totalAmount) {
            const car = await mongoose.model('Car').findById(this.car);
            if (car) this.totalAmount = car.pricePerDay * days;
        }
    }
    next();
});

module.exports = mongoose.model('Booking', bookingSchema);