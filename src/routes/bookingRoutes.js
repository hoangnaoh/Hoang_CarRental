const express = require('express');
const router = express.Router();
const { createBooking, getMyBookings, cancelBooking, getAllBookings, updateBookingStatus } = require('../controllers/bookingController');
const { protect, restrictTo } = require('../middleware/auth');

router.post('/', protect, createBooking);
router.get('/my', protect, getMyBookings);
router.patch('/:id/cancel', protect, cancelBooking);

// Admin
router.get('/admin/all', protect, restrictTo('admin'), getAllBookings);
router.patch('/admin/:id/status', protect, restrictTo('admin'), updateBookingStatus);

module.exports = router;