const Car     = require('../models/Car');
const Booking = require('../models/Booking');
const User    = require('../models/User');
const crypto  = require('crypto');
const { sendEmail } = require('../utils/email');

// ── Helper ────────────────────────────────────────────────
const statusBadge = (status) => {
    const map = {
        available:   '<span class="badge-available">Sẵn sàng</span>',
        rented:      '<span class="badge-rented">Đang thuê</span>',
        maintenance: '<span class="badge-maintenance">Bảo trì</span>',
        pending:     '<span class="badge-pending">Chờ duyệt</span>',
        confirmed:   '<span class="badge-confirmed">Đã xác nhận</span>',
        active:      '<span class="badge-rented">Đang thuê</span>',
        completed:   '<span class="badge-completed">Hoàn thành</span>',
        cancelled:   '<span class="badge-cancelled">Đã hủy</span>',
    };
    return map[status] || status;
};

// Ngay mai 00:00:00
const getTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
};

// ── AUTH ──────────────────────────────────────────────────

exports.getLogin = (req, res) => {
    if (req.session?.userId) return res.redirect('/cars');
    let success = null;
    if (req.query.registered) success = 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.';
    if (req.query.verified)   success = 'Xác thực email thành công! Bạn có thể đăng nhập.';
    res.render('auth/login', { error: null, success, formData: {} });
};

exports.postLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.comparePassword(password))) {
            return res.render('auth/login', { error: 'Email hoặc mật khẩu không đúng.', success: null, formData: { email } });
        }
        if (!user.isActive) {
            return res.render('auth/login', { error: 'Tài khoản đã bị khóa.', success: null, formData: { email } });
        }
        if (!user.isEmailVerified) {
            return res.render('auth/login', { error: 'Vui lòng xác thực email trước khi đăng nhập.', success: null, formData: { email } });
        }
        req.session.userId   = user._id;
        req.session.userRole = user.role;
        user.lastLogin = new Date();
        await user.save({ validateBeforeSave: false });
        if (user.role === 'admin') return res.redirect('/admin');
        res.redirect('/cars');
    } catch (err) {
        res.render('auth/login', { error: 'Có lỗi xảy ra. Vui lòng thử lại.', success: null, formData: { email } });
    }
};

exports.getRegister = (req, res) => {
    if (req.session?.userId) return res.redirect('/cars');
    res.render('auth/register', { error: null });
};

exports.postRegister = async (req, res) => {
    const { fullName, email, password, phone } = req.body;
    try {
        const existing = await User.findOne({ email });
        if (existing) return res.render('auth/register', { error: 'Email này đã được sử dụng.' });

        const verificationToken        = crypto.randomBytes(32).toString('hex');
        const emailVerificationToken   = crypto.createHash('sha256').update(verificationToken).digest('hex');
        const emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

        await User.create({ fullName, email, password, phone, role: 'student', emailVerificationToken, emailVerificationExpires });

        const verificationUrl = `${req.protocol}://${req.get('host')}/verify-email/${verificationToken}`;
        await sendEmail({
            email,
            subject: 'Xác thực email tài khoản Hoang_CarRental',
            html: `<h1>Chào mừng bạn đến với Hoang_CarRental!</h1>
                   <p>Vui lòng click vào link dưới đây để xác thực email của bạn:</p>
                   <a href="${verificationUrl}">Xác thực email</a>
                   <p>Link có hiệu lực trong 24 giờ.</p>`
        });
        res.redirect('/login?registered=1');
    } catch (err) {
        console.error(err);
        res.render('auth/register', { error: 'Có lỗi xảy ra. Vui lòng thử lại.' });
    }
};

exports.getForgotPassword = (req, res) => {
    res.render('auth/forgot-password', { error: null, success: null });
};

exports.postForgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.render('auth/forgot-password', { error: 'Không tìm thấy email này.', success: null });

        const resetToken = crypto.randomBytes(32).toString('hex');
        user.passwordResetToken   = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
        try {
            await sendEmail({
                email: user.email,
                subject: 'Đặt lại mật khẩu Hoang_CarRental',
                html: `<h1>Yêu cầu đặt lại mật khẩu</h1>
                       <a href="${resetUrl}">Đặt lại mật khẩu</a>
                       <p>Link có hiệu lực trong 10 phút.</p>`
            });
            res.render('auth/forgot-password', { error: null, success: 'Link đặt lại mật khẩu đã được gửi đến email của bạn.' });
        } catch (emailErr) {
            user.passwordResetToken   = undefined;
            user.passwordResetExpires = undefined;
            await user.save({ validateBeforeSave: false });
            res.render('auth/forgot-password', { error: 'Có lỗi khi gửi email. Vui lòng thử lại sau.', success: null });
        }
    } catch (err) {
        res.render('auth/forgot-password', { error: 'Có lỗi xảy ra.', success: null });
    }
};

exports.logout = (req, res) => {
    req.session.destroy();
    res.redirect('/login');
};

exports.verifyEmail = async (req, res) => {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({
            emailVerificationToken:   hashedToken,
            emailVerificationExpires: { $gt: Date.now() }
        });
        if (!user) {
            return res.render('auth/login', { error: 'Link xác thực không hợp lệ hoặc đã hết hạn.', success: null, formData: {} });
        }
        user.isEmailVerified          = true;
        user.emailVerificationToken   = undefined;
        user.emailVerificationExpires = undefined;
        await user.save({ validateBeforeSave: false });
        res.redirect('/login?verified=1');
    } catch (err) {
        res.render('auth/login', { error: 'Có lỗi xảy ra. Vui lòng thử lại.', success: null, formData: {} });
    }
};

// ── CARS ──────────────────────────────────────────────────

exports.getCarsList = async (req, res) => {
    try {
        const { brand, type, seats, startDate, endDate, sortBy = 'pricePerDay', page = 1 } = req.query;
        const limit = 8;
        const skip  = (page - 1) * limit;
 
        const filter = { status: { $ne: 'maintenance' } };
        // Hiện tất cả xe trừ xe bảo trì — xe rented vẫn hiện
 
        if (brand) filter.brand = { $in: Array.isArray(brand) ? brand : [brand] };
        if (type)  filter.type  = type;
        if (seats) filter.seats = { $in: Array.isArray(seats) ? seats.map(Number) : [Number(seats)] };
 
        // Tính xe bận trong khoảng ngày khách chọn
        let busyCarIds = [];
        if (startDate && endDate) {
            busyCarIds = await Booking.find({
                status:    { $in: ['pending', 'confirmed', 'active'] },
                startDate: { $lt: new Date(endDate) },
                endDate:   { $gt: new Date(startDate) }
            }).distinct('car');
            // KHÔNG loại xe rented khỏi danh sách — chỉ dùng busyCarIds để gắn flag
        }
 
        const total      = await Car.countDocuments(filter);
        const cars       = await Car.find(filter).sort(sortBy).skip(skip).limit(limit);
        const totalPages = Math.ceil(total / limit);
 
        // Gắn flag isAvailableForDates cho từng xe để view biết cách hiển thị nút
        const carsWithFlag = cars.map(car => {
            const obj = car.toObject();
            if (startDate && endDate) {
                obj.isAvailableForDates = !busyCarIds.some(id => id.toString() === car._id.toString());
            } else {
                obj.isAvailableForDates = car.status === 'available';
            }
            return obj;
        });
 
        res.render('cars/list', {
            cars: carsWithFlag,
            total,
            totalPages,
            currentPage: Number(page),
            query: req.query,
            user: req.user || null,
            statusBadge,
            page: 'cars'
        });
    } catch (err) {
        res.render('cars/list', {
            cars: [], total: 0, totalPages: 1, currentPage: 1,
            query: req.query, user: null, statusBadge, page: 'cars'
        });
    }
};
exports.getCarDetail = async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);
        if (!car) return res.redirect('/cars');

        const tomorrow = getTomorrow();

        // Lấy các khoảng ngày đã bị đặt của xe này
        const activeBookings = await Booking.find({
            car:    car._id,
            status: { $in: ['pending', 'confirmed', 'active'] },
            endDate: { $gte: tomorrow }
        }).select('startDate endDate');

        const busyRanges = activeBookings.map(b => ({
            start: b.startDate,
            end:   b.endDate
        }));

        res.render('cars/detail', {
            car,
            user: req.user || null,
            statusBadge,
            busyRanges: JSON.stringify(busyRanges),
            minDate: tomorrow.toISOString().split('T')[0]
        });
    } catch (err) {
        res.redirect('/cars');
    }
};

// ── BOOKING ───────────────────────────────────────────────

exports.getBookingConfirm = async (req, res) => {
    if (!req.user) return res.redirect('/login');
    const { carId, startDate, endDate } = req.query;
    try {
        const car = await Car.findById(carId);
        if (!car) return res.redirect('/cars');

        const tomorrow = getTomorrow();
        const start    = new Date(startDate);
        const end      = new Date(endDate);

        // startDate phải từ ngày mai trở đi
        if (start < tomorrow) return res.redirect('/cars/' + carId);
        if (end <= start)     return res.redirect('/cars/' + carId);

        // Kiểm tra conflict
        const conflict = await Booking.findOne({
            car:    carId,
            status: { $in: ['pending', 'confirmed', 'active'] },
            startDate: { $lt: end },
            endDate:   { $gt: start }
        });
        if (conflict) return res.redirect('/cars/' + carId + '?busy=1');

        const totalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
        res.render('booking/confirm', { car, startDate, endDate, totalDays, user: req.user, error: null });
    } catch (err) {
        res.redirect('/cars');
    }
};

exports.postBooking = async (req, res) => {
    if (!req.user) return res.redirect('/login');
    const { carId, startDate, endDate, customerNote } = req.body;
    try {
        const car = await Car.findById(carId);
        if (!car || car.status !== 'available') return res.redirect('/cars');

        const tomorrow = getTomorrow();
        const start    = new Date(startDate);
        const end      = new Date(endDate);

        if (start < tomorrow || end <= start) return res.redirect('/cars/' + carId);

        // Double-check conflict trước khi tạo
        const conflict = await Booking.findOne({
            car:    carId,
            status: { $in: ['pending', 'confirmed', 'active'] },
            startDate: { $lt: end },
            endDate:   { $gt: start }
        });
        if (conflict) return res.redirect('/cars/' + carId + '?busy=1');

        const totalDays   = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
        const totalAmount = car.pricePerDay * totalDays;

        await Booking.create({
            customer: req.user._id,
            car:      carId,
            startDate: start,
            endDate:   end,
            totalAmount,
            customerNote,
            status: 'pending'
        });

        res.redirect('/my-bookings?success=1');
    } catch (err) {
        const car = await Car.findById(carId).catch(() => null);
        const start     = new Date(startDate);
        const end       = new Date(endDate);
        const totalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
        res.render('booking/confirm', { car, startDate, endDate, totalDays, user: req.user, error: 'Đặt xe thất bại. Vui lòng thử lại.' });
    }
};

exports.getMyBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ customer: req.user._id })
            .populate('car')
            .sort('-createdAt');
        res.render('booking/my-bookings', { bookings, user: req.user, statusBadge, success: req.query.success });
    } catch (err) {
        res.render('booking/my-bookings', { bookings: [], user: req.user, statusBadge, success: null });
    }
};

exports.cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findOne({ _id: req.params.id, customer: req.user._id });
        if (!booking) return res.redirect('/my-bookings');
        if (!['pending', 'confirmed'].includes(booking.status)) return res.redirect('/my-bookings');
        booking.status = 'cancelled';
        await booking.save();
        res.redirect('/my-bookings');
    } catch (err) {
        res.redirect('/my-bookings');
    }
};

// ── ADMIN DASHBOARD ───────────────────────────────────────

exports.getAdminDashboard = async (req, res) => {
    try {
        const [totalCars, rentedCars, recentCars, newCustomers, totalRevenue] = await Promise.all([
            Car.countDocuments(),
            Car.countDocuments({ status: 'rented' }),
            Car.find().sort('-createdAt').limit(5),
            User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
            Booking.aggregate([
                { $match: { status: 'completed', createdAt: { $gte: new Date(new Date().setDate(1)) } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ])
        ]);

        const pendingCount = await Booking.countDocuments({ status: 'pending' });

        const recentBookings = await Booking.find()
            .sort('-createdAt')
            .limit(5)
            .populate('customer', 'fullName email phone')
            .populate('car', 'name licensePlate pricePerDay images');

        res.render('admin/dashboard', {
            user: req.user,
            adminPage: 'dashboard',
            statusBadge,
            stats: {
                totalCars,
                rentedCars,
                pendingCount,
                newCustomers,
                monthRevenue: totalRevenue[0]?.total || 0
            },
            recentCars,
            recentBookings
        });
    } catch (err) {
        res.render('admin/dashboard', {
            user: req.user, adminPage: 'dashboard', statusBadge,
            stats: {}, recentCars: [], recentBookings: []
        });
    }
};

// ── ADMIN CARS ────────────────────────────────────────────

exports.getAdminCars = async (req, res) => {
    try {
        const { search, status, page = 1 } = req.query;
        const limit = 10;
        const skip  = (page - 1) * limit;
        const filter = {};
        if (status) filter.status = status;
        // Bỏ dòng filter.status mặc định → xe rented vẫn hiện
        if (search) filter.$or = [{ name: new RegExp(search, 'i') }, { licensePlate: new RegExp(search, 'i') }];
        const total = await Car.countDocuments(filter);
        const cars  = await Car.find(filter).sort('-createdAt').skip(skip).limit(limit);

        // Lấy booking active của xe rented để hiện ngày trả xe
        const rentedIds = cars.filter(c => c.status === 'rented').map(c => c._id);
        let carBookings = {};
        if (rentedIds.length > 0) {
            const activeBookings = await Booking.find({
                car:    { $in: rentedIds },
                status: { $in: ['confirmed', 'active'] }
            }).select('car endDate');
            activeBookings.forEach(b => {
                carBookings[b.car.toString()] = b;
            });
        }

        res.render('admin/cars', {
            user: req.user, adminPage: 'cars', statusBadge,
            cars, carBookings, total, totalPages: Math.ceil(total / limit),
            currentPage: Number(page), limit, query: req.query
        });
    } catch (err) {
        res.render('admin/cars', {
            user: req.user, adminPage: 'cars', statusBadge,
            carBookings: {}, cars: [], total: 0, totalPages: 1,
            currentPage: 1, limit: 10, query: {}
        });
    }
};

exports.getAdminCarNew = (req, res) => {
    res.render('admin/car-form', { user: req.user, adminPage: 'cars', car: null, error: null });
};

exports.postAdminCarNew = async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.images && typeof data.images === 'string') {
            data.images = data.images.split('\n').map(s => s.trim()).filter(Boolean);
        }
        await Car.create(data);
        res.redirect('/admin/cars');
    } catch (err) {
        const msg = err.code === 11000 ? 'Biển số xe đã tồn tại.' : err.message;
        res.render('admin/car-form', { user: req.user, adminPage: 'cars', car: null, error: msg });
    }
};

exports.getAdminCarEdit = async (req, res) => {
    try {
        const car = await Car.findById(req.params.id);
        if (!car) return res.redirect('/admin/cars');
        res.render('admin/car-form', { user: req.user, adminPage: 'cars', car, error: null });
    } catch (err) {
        res.redirect('/admin/cars');
    }
};

exports.putAdminCar = async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.images && typeof data.images === 'string') {
            data.images = data.images.split('\n').map(s => s.trim()).filter(Boolean);
        }
        delete data._method;
        await Car.findByIdAndUpdate(req.params.id, data, { runValidators: true });
        res.redirect('/admin/cars');
    } catch (err) {
        const car = await Car.findById(req.params.id).catch(() => null);
        res.render('admin/car-form', { user: req.user, adminPage: 'cars', car, error: err.message });
    }
};

exports.deleteAdminCar = async (req, res) => {
    try {
        await Car.findByIdAndDelete(req.params.id);
        res.redirect('/admin/cars');
    } catch (err) {
        res.redirect('/admin/cars');
    }
};

// ── ADMIN BOOKINGS ────────────────────────────────────────

exports.getAdminBookings = async (req, res) => {
    try {
        const { status, page = 1 } = req.query;
        const limit = 10;
        const skip  = (page - 1) * limit;
        const filter = {};
        if (status) filter.status = status;
        const total    = await Booking.countDocuments(filter);
        const bookings = await Booking.find(filter)
            .populate('customer', 'fullName email phone')
            .populate('car', 'name licensePlate pricePerDay images')
            .sort('-createdAt').skip(skip).limit(limit);
        res.render('admin/bookings', {
            user: req.user, adminPage: 'bookings', statusBadge,
            bookings, total, totalPages: Math.ceil(total / limit),
            currentPage: Number(page), limit, query: req.query
        });
    } catch (err) {
        res.render('admin/bookings', {
            user: req.user, adminPage: 'bookings', statusBadge,
            bookings: [], total: 0, totalPages: 1, currentPage: 1, limit: 10, query: {}
        });
    }
};

exports.updateBookingStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const booking = await Booking.findById(req.params.id).populate('car');
        if (booking) {
            booking.status = status;
            // Bắt đầu thuê -> xe chuyển sang rented
            if (status === 'active' && booking.car) {
                await Car.findByIdAndUpdate(booking.car._id, { status: 'rented' });
            }
            // Hoàn thành hoặc hủy -> xe về available
            if ((status === 'completed' || status === 'cancelled') && booking.car) {
                await Car.findByIdAndUpdate(booking.car._id, { status: 'available' });
            }
            await booking.save();
        }
        // Redirect về trang gọi (dashboard hoặc bookings)
        const referer = req.headers.referer || '/admin/bookings';
        res.redirect(referer);
    } catch (err) {
        res.redirect('/admin/bookings');
    }
};

// ── ADMIN CUSTOMERS ───────────────────────────────────────

exports.getAdminCustomers = async (req, res) => {
    try {
        const { search, page = 1 } = req.query;
        const limit = 10;
        const skip  = (page - 1) * limit;
        const filter = { role: { $ne: 'admin' } };
        if (search) filter.$or = [{ fullName: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];

        const total     = await User.countDocuments(filter);
        const usersList = await User.find(filter).sort('-createdAt').skip(skip).limit(limit);

        const customers = await Promise.all(usersList.map(async (u) => {
            const bookingCount = await Booking.countDocuments({ customer: u._id });
            return { ...u.toObject(), bookingCount };
        }));

        res.render('admin/customers', {
            user: req.user, adminPage: 'customers',
            customers, total, totalPages: Math.ceil(total / limit),
            currentPage: Number(page), limit, query: req.query
        });
    } catch (err) {
        res.render('admin/customers', {
            user: req.user, adminPage: 'customers',
            customers: [], total: 0, totalPages: 1, currentPage: 1, limit: 10, query: {}
        });
    }
};

exports.toggleCustomerStatus = async (req, res) => {
    try {
        const customer = await User.findById(req.params.id);
        if (customer) {
            customer.isActive = req.body.isActive === 'true';
            await customer.save({ validateBeforeSave: false });
        }
        res.redirect('/admin/customers');
    } catch (err) {
        res.redirect('/admin/customers');
    }
};