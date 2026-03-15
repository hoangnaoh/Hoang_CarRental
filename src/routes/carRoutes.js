const express = require('express');
const router = express.Router();
const { getCars, getCar, createCar, updateCar, updateStatus } = require('../controllers/carController');
const { protect, restrictTo } = require('../middleware/auth');

// Public - ai cũng xem được
router.get('/', getCars);       // danh sách xe + lọc theo ngày/hãng/loại
router.get('/:id', getCar);     // chi tiết xe + tình trạng hiện tại

// Admin only
router.post('/', protect, restrictTo('admin'), createCar);
router.put('/:id', protect, restrictTo('admin'), updateCar);
router.patch('/:id/status', protect, restrictTo('admin'), updateStatus);

module.exports = router;