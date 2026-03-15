const Car = require('../models/Car');
const Booking = require('../models/Booking');

// @desc    Danh sách xe, lọc theo ngày/hãng/loại
// @route   GET /api/cars
exports.getCars = async (req, res) => {
    try {
        const { brand, type, seats, status, startDate, endDate } = req.query;

        const filter = {};
        if (brand) filter.brand = brand;
        if (type) filter.type = type;
        if (seats) filter.seats = Number(seats);

        // Mặc định chỉ hiện xe available, trừ khi admin truyền status khác
        filter.status = status || 'available';

        // Nếu có ngày thì loại trừ xe đang bị đặt trùng
        if (startDate && endDate) {
            const busyCars = await Booking.find({
                status: { $in: ['pending', 'confirmed', 'active'] },
                startDate: { $lt: new Date(endDate) },
                endDate: { $gt: new Date(startDate) }
            }).distinct('car');

            filter._id = { $nin: busyCars };
            filter.status = 'available';
        }

        const cars = await Car.find(filter).sort({ pricePerDay: 1 });

        res.status(200).json({
            success: true,
            data: { total: cars.length, cars }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Có lỗi khi lấy danh sách xe.' });
    }
};

// @desc    Chi tiết xe + tình trạng hiện tại (đang rảnh hay đang được thuê bởi ai)
// @route   GET /api/cars/:id
exports.getCar = async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);
        if (!car) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy xe.' });
        }

        // Booking đang chạy của xe này (nếu có)
        const activeBooking = await Booking.findOne({
            car: car._id,
            status: { $in: ['confirmed', 'active'] }
        })
            .select('startDate endDate status customer')
            .populate('customer', 'fullName phone');

        res.status(200).json({
            success: true,
            data: {
                car,
                isAvailable: car.status === 'available' && !activeBooking,
                currentBooking: activeBooking || null
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra.' });
    }
};

// @desc    Thêm xe mới (admin)
// @route   POST /api/cars
exports.createCar = async (req, res) => {
    try {
        const car = await Car.create(req.body);
        res.status(201).json({ success: true, data: { car } });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Biển số xe đã tồn tại.' });
        }
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Sửa thông tin xe (admin)
// @route   PUT /api/cars/:id
exports.updateCar = async (req, res) => {
    try {
        const car = await Car.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!car) return res.status(404).json({ success: false, message: 'Không tìm thấy xe.' });
        res.status(200).json({ success: true, data: { car } });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Đổi trạng thái xe (admin): available / rented / maintenance
// @route   PATCH /api/cars/:id/status
exports.updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const allowed = ['available', 'rented', 'maintenance'];
        if (!allowed.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Trạng thái không hợp lệ. Chọn một trong: ${allowed.join(', ')}`
            });
        }

        const car = await Car.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!car) return res.status(404).json({ success: false, message: 'Không tìm thấy xe.' });

        res.status(200).json({
            success: true,
            message: `Đã cập nhật trạng thái xe thành "${status}".`,
            data: { car }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra.' });
    }
};