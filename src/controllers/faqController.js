const Faq = require('../models/Faq');

const FAQ_CATEGORIES = [
  'Fees & Pricing',
  'Payment Plans',
  'Course Prerequisites',
  'Course Access & Recordings',
  'Certificates',
  'Enrollment & Support'
];

const DEFAULT_SEED_FAQS = [
  {
    category: 'Fees & Pricing',
    question: 'What is the fee for each course?',
    answer: 'Course fees vary depending on the selected course and learning program. Visit the Courses page to view the current pricing and course details.',
    displayOrder: 1,
    status: 'active'
  },
  {
    category: 'Fees & Pricing',
    question: 'Are there any additional charges?',
    answer: 'All applicable fees and additional charges should be clearly displayed before enrollment.',
    displayOrder: 2,
    status: 'active'
  },
  {
    category: 'Payment Plans',
    question: 'Do you offer installment payment options?',
    answer: 'Payment plan availability depends on the course. Contact our team for information about available installment options.',
    displayOrder: 1,
    status: 'active'
  },
  {
    category: 'Payment Plans',
    question: 'Can I pay the course fee in installments?',
    answer: 'If installment options are available for your selected course, the payment schedule will be shared during enrollment.',
    displayOrder: 2,
    status: 'active'
  },
  {
    category: 'Course Prerequisites',
    question: 'Do I need prior technical knowledge to join?',
    answer: 'Prerequisites depend on the selected course. Beginner-friendly courses may not require prior technical experience.',
    displayOrder: 1,
    status: 'active'
  },
  {
    category: 'Course Prerequisites',
    question: 'Do I need a laptop?',
    answer: 'A laptop or desktop is recommended for practical technical training. Specific system requirements depend on the course.',
    displayOrder: 2,
    status: 'active'
  },
  {
    category: 'Course Access & Recordings',
    question: 'Will I get access to recorded sessions?',
    answer: 'Recording availability depends on the course and its learning format.',
    displayOrder: 1,
    status: 'active'
  },
  {
    category: 'Course Access & Recordings',
    question: 'How long can I access the recordings?',
    answer: 'The recording access period should be displayed in the relevant course details.',
    displayOrder: 2,
    status: 'active'
  },
  {
    category: 'Certificates',
    question: 'Will I receive a certificate after completing the course?',
    answer: 'Certificate eligibility depends on the course completion requirements.',
    displayOrder: 1,
    status: 'active'
  },
  {
    category: 'Certificates',
    question: 'Is the certificate provided digitally?',
    answer: 'Certificate format and delivery details should be specified in the course information.',
    displayOrder: 2,
    status: 'active'
  },
  {
    category: 'Enrollment & Support',
    question: 'How do I enroll in a course?',
    answer: 'Browse our course catalog, choose your desired course, and complete the enrollment steps online or reach out via our Contact page for guided registration.',
    displayOrder: 1,
    status: 'active'
  },
  {
    category: 'Enrollment & Support',
    question: 'How can I get technical or mentor support during my learning journey?',
    answer: 'Enrolled students can reach their instructor and teaching assistants directly through our student portal, community channels, and scheduled live mentoring sessions.',
    displayOrder: 2,
    status: 'active'
  }
];

// Helper to seed default FAQs if collection is empty
const seedDefaultsIfEmpty = async () => {
  const count = await Faq.countDocuments();
  if (count === 0) {
    await Faq.insertMany(DEFAULT_SEED_FAQS);
  }
};

/**
 * @desc    Get all active FAQs for public FAQ page
 * @route   GET /api/v1/faqs
 * @access  Public
 */
exports.getPublicFaqs = async (req, res, next) => {
  try {
    await seedDefaultsIfEmpty();

    const { category, search } = req.query;
    const query = { status: 'active' };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { question: { $regex: search, $options: 'i' } },
        { answer: { $regex: search, $options: 'i' } }
      ];
    }

    const faqs = await Faq.find(query)
      .select('category question answer displayOrder')
      .sort({ category: 1, displayOrder: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      count: faqs.length,
      categories: FAQ_CATEGORIES,
      faqs
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all FAQs for admin management
 * @route   GET /api/v1/faqs/admin
 * @access  Private/Admin
 */
exports.getAdminFaqs = async (req, res, next) => {
  try {
    await seedDefaultsIfEmpty();

    const { category, status, search, sort } = req.query;
    const query = {};

    if (category && category !== 'all') {
      query.category = category;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { question: { $regex: search, $options: 'i' } },
        { answer: { $regex: search, $options: 'i' } }
      ];
    }

    let sortOptions = { category: 1, displayOrder: 1, createdAt: -1 };
    if (sort === 'order-desc') {
      sortOptions = { displayOrder: -1, createdAt: -1 };
    } else if (sort === 'newest') {
      sortOptions = { createdAt: -1 };
    } else if (sort === 'category') {
      sortOptions = { category: 1, displayOrder: 1 };
    }

    const faqs = await Faq.find(query).sort(sortOptions);

    res.status(200).json({
      success: true,
      count: faqs.length,
      categories: FAQ_CATEGORIES,
      faqs
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single FAQ by ID
 * @route   GET /api/v1/faqs/admin/:id
 * @access  Private/Admin
 */
exports.getFaqById = async (req, res, next) => {
  try {
    const faq = await Faq.findById(req.params.id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    res.status(200).json({
      success: true,
      faq
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new FAQ
 * @route   POST /api/v1/faqs
 * @access  Private/Admin
 */
exports.createFaq = async (req, res, next) => {
  try {
    const { category, question, answer, displayOrder, status } = req.body;

    if (!category || !question || !answer) {
      return res.status(400).json({
        success: false,
        message: 'Please provide category, question, and answer'
      });
    }

    const faq = await Faq.create({
      category,
      question: question.trim(),
      answer: answer.trim(),
      displayOrder: displayOrder !== undefined ? Number(displayOrder) : 0,
      status: status || 'active'
    });

    res.status(201).json({
      success: true,
      message: 'FAQ created successfully',
      faq
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update FAQ
 * @route   PUT /api/v1/faqs/:id
 * @access  Private/Admin
 */
exports.updateFaq = async (req, res, next) => {
  try {
    let faq = await Faq.findById(req.params.id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    const { category, question, answer, displayOrder, status } = req.body;

    if (category) faq.category = category;
    if (question) faq.question = question.trim();
    if (answer) faq.answer = answer.trim();
    if (displayOrder !== undefined) faq.displayOrder = Number(displayOrder);
    if (status) faq.status = status;

    await faq.save();

    res.status(200).json({
      success: true,
      message: 'FAQ updated successfully',
      faq
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete FAQ
 * @route   DELETE /api/v1/faqs/:id
 * @access  Private/Admin
 */
exports.deleteFaq = async (req, res, next) => {
  try {
    const faq = await Faq.findById(req.params.id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    await faq.deleteOne();

    res.status(200).json({
      success: true,
      message: 'FAQ deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

