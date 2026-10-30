const Testimonial = require('../models/Testimonial');

/**
 * @desc    Get all active testimonials for public homepage
 * @route   GET /api/v1/testimonials
 * @access  Public
 */
exports.getPublicTestimonials = async (req, res, next) => {
  try {
    const testimonials = await Testimonial.find({ status: 'active' })
      .select('studentName designation courseName batch completionDate review rating image displayOrder')
      .sort({ displayOrder: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: testimonials.length,
      testimonials
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all testimonials for admin with search, filter, and sorting
 * @route   GET /api/v1/testimonials/admin
 * @access  Private/Admin
 */
exports.getAdminTestimonials = async (req, res, next) => {
  try {
    const { status, search, sort } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { designation: { $regex: search, $options: 'i' } },
        { review: { $regex: search, $options: 'i' } }
      ];
    }

    let sortOptions = { displayOrder: 1, createdAt: -1 };
    if (sort === 'order-desc') {
      sortOptions = { displayOrder: -1, createdAt: -1 };
    } else if (sort === 'newest') {
      sortOptions = { createdAt: -1 };
    } else if (sort === 'rating') {
      sortOptions = { rating: -1, displayOrder: 1 };
    }

    const testimonials = await Testimonial.find(query).sort(sortOptions);

    res.status(200).json({
      success: true,
      count: testimonials.length,
      testimonials
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single testimonial for admin
 * @route   GET /api/v1/testimonials/admin/:id
 * @access  Private/Admin
 */
exports.getTestimonialById = async (req, res, next) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    res.status(200).json({
      success: true,
      testimonial
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new testimonial
 * @route   POST /api/v1/testimonials
 * @access  Private/Admin
 */
exports.createTestimonial = async (req, res, next) => {
  try {
    const { studentName, designation, courseName, batch, completionDate, review, rating, image, status, displayOrder } = req.body;

    if (!studentName || !review) {
      return res.status(400).json({
        success: false,
        message: 'Please provide student name and review'
      });
    }

    let parsedRating = Number(rating);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      parsedRating = 5;
    }

    let parsedOrder = Number(displayOrder);
    if (isNaN(parsedOrder)) {
      parsedOrder = 0;
    }

    let imageUrl = image || '';
    if (req.file) {
      imageUrl = `/uploads/thumbnails/${req.file.filename}`;
    }

    const testimonial = await Testimonial.create({
      studentName: studentName.trim(),
      designation: (designation || '').trim(),
      courseName: (courseName || '').trim(),
      batch: (batch || '').trim(),
      completionDate: (completionDate || '').trim(),
      review: review.trim(),
      rating: parsedRating,
      image: imageUrl,
      status: status === 'inactive' ? 'inactive' : 'active',
      displayOrder: parsedOrder
    });

    res.status(201).json({
      success: true,
      message: 'Testimonial created successfully',
      testimonial
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update testimonial
 * @route   PUT /api/v1/testimonials/:id
 * @access  Private/Admin
 */
exports.updateTestimonial = async (req, res, next) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    const { studentName, designation, courseName, batch, completionDate, review, rating, image, status, displayOrder } = req.body;

    if (studentName !== undefined) testimonial.studentName = studentName.trim();
    if (designation !== undefined) testimonial.designation = designation.trim();
    if (courseName !== undefined) testimonial.courseName = courseName.trim();
    if (batch !== undefined) testimonial.batch = batch.trim();
    if (completionDate !== undefined) testimonial.completionDate = completionDate.trim();
    if (review !== undefined) testimonial.review = review.trim();
    if (rating !== undefined) {
      const parsedRating = Number(rating);
      if (!isNaN(parsedRating) && parsedRating >= 1 && parsedRating <= 5) {
        testimonial.rating = parsedRating;
      }
    }
    if (status !== undefined && ['active', 'inactive'].includes(status)) {
      testimonial.status = status;
    }
    if (displayOrder !== undefined) {
      const parsedOrder = Number(displayOrder);
      if (!isNaN(parsedOrder)) {
        testimonial.displayOrder = parsedOrder;
      }
    }

    if (req.file) {
      testimonial.image = `/uploads/thumbnails/${req.file.filename}`;
    } else if (image !== undefined) {
      testimonial.image = image;
    }

    await testimonial.save();

    res.status(200).json({
      success: true,
      message: 'Testimonial updated successfully',
      testimonial
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete testimonial
 * @route   DELETE /api/v1/testimonials/:id
 * @access  Private/Admin
 */
exports.deleteTestimonial = async (req, res, next) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    await testimonial.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Testimonial deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

