const express = require('express');
const router = express.Router();
const v = require('../controllers/viewController');

// ── Middleware lấy user từ session cho view ──────────────
const sessionUser = async (req, res, next) => {
    if (req.session?.userId) {
        const User = require('../models/User');
        try {
            req.user = await User.findById(req.session.userId);
        } catch (e) { req.user = null; }
    }
    next();
};

const requireLogin = (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/login');
    next();
};

// Apply sessionUser cho toàn bộ view routes
router.use(sessionUser);

// ── Auth ────────────────────────────────────────────────
router.get('/login',                v.getLogin);
router.post('/login',               v.postLogin);
router.get('/register',             v.getRegister);
router.post('/register',            v.postRegister);
router.get('/forgot-password',      v.getForgotPassword);
router.post('/forgot-password',     v.postForgotPassword);
router.get('/logout',               v.logout);
router.get('/verify-email/:token',  v.verifyEmail);

// ── Cars ────────────────────────────────────────────────
router.get('/cars', v.getCarsList);
router.get('/cars/:id',  v.getCarDetail);
// ── Booking ─────────────────────────────────────────────
router.get('/booking',  requireLogin, v.getBookingConfirm);
router.get('/my-bookings', requireLogin, v.getMyBookings);

router.post('/booking', requireLogin, v.postBooking);
router.post('/my-bookings/:id/cancel', requireLogin, v.cancelBooking);

// ── Admin ───────────────────────────────────────────────
router.get('/admin',               requireAdmin, v.getAdminDashboard);
router.get('/admin/cars',          requireAdmin, v.getAdminCars);
router.get('/admin/cars/new',      requireAdmin, v.getAdminCarNew);
router.post('/admin/cars',         requireAdmin, v.postAdminCarNew);
router.get('/admin/cars/:id/edit', requireAdmin, v.getAdminCarEdit);
router.post('/admin/cars/:id',     requireAdmin, (req, res, next) => {
    if (req.body._method === 'PUT')    return v.putAdminCar(req, res, next);
    if (req.body._method === 'DELETE') return v.deleteAdminCar(req, res, next);
    next();
});
router.get('/admin/bookings',          requireAdmin, v.getAdminBookings);
router.post('/admin/bookings/:id',     requireAdmin, v.updateBookingStatus);

router.get('/admin/customers',                   requireAdmin, v.getAdminCustomers);
router.post('/admin/customers/:id/toggle',       requireAdmin, v.toggleCustomerStatus);
 
// Home redirect
router.get('/', (req, res) => res.redirect('/cars'));

module.exports = router;