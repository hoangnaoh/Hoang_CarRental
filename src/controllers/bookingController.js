const Booking = require('../models/Booking');
const Car = require('../models/Car');

// @desc    Tạo đặt xe
// @route   POST /api/bookings
exports.createBooking = async (req, res) => {
    try {
        const { carId, startDate, endDate, customerNote } = req.body;

        if (!carId || !startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp carId, startDate và endDate.' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start >= end) return res.status(400).json({ success: false, message: 'Ngày kết thúc phải sau ngày bắt đầu.' });
        if (start < new Date()) return res.status(400).json({ success: false, message: 'Ngày bắt đầu không được trong quá khứ.' });

        const car = await Car.findById(carId);
        if (!car) return res.status(404).json({ success: false, message: 'Không tìm thấy xe.' });
        if (car.status !== 'available') {
            return res.status(400).json({ success: false, message: `Xe đang ở trạng thái "${car.status}", không thể đặt.` });
        }

        // Kiểm tra trùng lịch
        const conflict = await Booking.findOne({
            car: carId,
            status: { $in: ['pending', 'confirmed', 'active'] },
            startDate: { $lt: end },
            endDate: { $gt: start }
        });
        if (conflict) {
            return res.status(400).json({
                success: false,
                message: 'Xe đã được đặt trong khoảng thời gian này.',
                conflict: { startDate: conflict.startDate, endDate: conflict.endDate }
            });
        }

        const booking = await Booking.create({
            customer: req.user._id,
            car: carId,
            startDate: start,
            endDate: end,
            customerNote
        });

        await booking.populate('car', 'name licensePlate brand pricePerDay');

        res.status(201).json({
            success: true,
            message: 'Đặt xe thành công! Vui lòng chờ xác nhận.',
            data: { booking }
        });
    } catch (error) {
        console.error('Create booking error:', error);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi đặt xe.' });
    }
};

// @desc    Xem đặt xe của tôi
// @route   GET /api/bookings/my
exports.getMyBookings = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = { customer: req.user._id };
        if (status) filter.status = status;

        const bookings = await Booking.find(filter)
            .populate('car', 'name licensePlate brand type pricePerDay images')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: { total: bookings.length, bookings } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra.' });
    }
};

// @desc    Hủy đặt xe
// @route   PATCH /api/bookings/:id/cancel
exports.cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findOne({ _id: req.params.id, customer: req.user._id });
        if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy đặt xe.' });

        if (!['pending', 'confirmed'].includes(booking.status)) {
            return res.status(400).json({ success: false, message: 'Chỉ có thể hủy khi đơn đang chờ hoặc đã xác nhận.' });
        }

        booking.status = 'cancelled';
        booking.cancelReason = req.body.reason || 'Khách hàng hủy';
        await booking.save();

        res.status(200).json({ success: true, message: 'Hủy đặt xe thành công.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra.' });
    }
};

// @desc    Admin xem tất cả đặt xe
// @route   GET /api/bookings/admin/all
exports.getAllBookings = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = {};
        if (status) filter.status = status;

        const bookings = await Booking.find(filter)
            .populate('customer', 'fullName email phone')
            .populate('car', 'name licensePlate brand')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: { total: bookings.length, bookings } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra.' });
    }
};

// @desc    Admin duyệt / đổi trạng thái đặt xe
// @route   PATCH /api/bookings/admin/:id/status
exports.updateBookingStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const allowed = ['pending', 'confirmed', 'active', 'completed', 'cancelled'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ.' });
        }

        const booking = await Booking.findById(req.params.id).populate('car');
        if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy đặt xe.' });

        const prev = booking.status;
        booking.status = status;
        await booking.save();

        // Tự động cập nhật trạng thái xe
        if (status === 'active') {
            await Car.findByIdAndUpdate(booking.car._id, { status: 'rented' });
        }
        if (['completed', 'cancelled'].includes(status)) {
            await Car.findByIdAndUpdate(booking.car._id, { status: 'available' });
        }

        res.status(200).json({
            success: true,
            message: `Cập nhật trạng thái: "${prev}" → "${status}" thành công.`,
            data: { booking }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra.' });
    }
};