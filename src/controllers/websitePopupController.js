const WebsitePopup = require('../models/WebsitePopup');

const getPopupFields = (popup) => {
  const result = popup.toObject();
  delete result.image?.data;
  result.hasImage = Boolean(popup.image?.data?.length);
  result.imageUrl = result.hasImage ? '/api/v1/website-popup/image' : null;
  return result;
};

const parseBoolean = (value, fallback) => {
  if (value === undefined) return fallback;
  return value === true || value === 'true';
};

const parseDate = (value, fieldName) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldName} must be a valid date`);
    error.statusCode = 400;
    throw error;
  }
  if (fieldName === 'End date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
};

const validateButtonUrl = (url, label) => {
  if (!url) return;
  if (!url.startsWith('/') && !/^https?:\/\//i.test(url)) {
    const error = new Error(`${label} URL must be a relative path or an http(s) URL`);
    error.statusCode = 400;
    throw error;
  }
};

const savePopup = async (req, res, next) => {
  try {
    const body = req.body || {};
    const primaryButton = {
      text: (body.primaryButtonText || '').trim(),
      url: (body.primaryButtonUrl || '').trim()
    };
    const secondaryButton = {
      text: (body.secondaryButtonText || '').trim(),
      url: (body.secondaryButtonUrl || '').trim()
    };
    validateButtonUrl(primaryButton.url, 'Primary button');
    validateButtonUrl(secondaryButton.url, 'Secondary button');

    const startDate = parseDate(body.startDate, 'Start date');
    const endDate = parseDate(body.endDate, 'End date');
    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({ success: false, message: 'End date must be after the start date' });
    }

    const update = {
      title: body.title || '',
      subtitle: body.subtitle || '',
      heading: body.heading || '',
      description: body.description || '',
      badgeText: body.badgeText || '',
      primaryButton,
      secondaryButton,
      layout: body.layout || 'image-left',
      theme: body.theme || 'light',
      accentColor: body.accentColor || '',
      isActive: parseBoolean(body.isActive, false),
      delaySeconds: body.delaySeconds === '' || body.delaySeconds === undefined ? 0 : Number(body.delaySeconds),
      displayFrequency: body.displayFrequency || 'session',
      startDate,
      endDate,
      closeOnOverlay: parseBoolean(body.closeOnOverlay, true)
    };

    if (!Number.isInteger(update.delaySeconds) || update.delaySeconds < 0 || update.delaySeconds > 60) {
      return res.status(400).json({ success: false, message: 'Popup delay must be between 0 and 60 seconds' });
    }

    if (req.file) {
      const contentType = req.file.mimetype;
      const data = req.file.buffer;
      const validSignature = (
        (contentType === 'image/jpeg' && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff)
        || (contentType === 'image/png' && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        || (contentType === 'image/webp' && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP')
      );
      if (!validSignature) {
        return res.status(400).json({ success: false, message: 'The uploaded file is not a valid JPEG, PNG, or WebP image' });
      }
      update.image = {
        data,
        contentType,
        fileName: req.file.originalname.slice(0, 255)
      };
    } else if (parseBoolean(body.removeImage, false)) {
      update.image = { data: null, contentType: null, fileName: null };
    }

    const popup = await WebsitePopup.findByIdAndUpdate(
      'website-popup',
      { $set: update },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({ success: true, popup: getPopupFields(popup) });
  } catch (error) {
    next(error);
  }
};

exports.getAdminPopup = async (req, res, next) => {
  try {
    const popup = await WebsitePopup.findById('website-popup');
    res.json({ success: true, popup: popup ? getPopupFields(popup) : null });
  } catch (error) {
    next(error);
  }
};

exports.saveAdminPopup = savePopup;

exports.toggleAdminPopup = async (req, res, next) => {
  try {
    const popup = await WebsitePopup.findById('website-popup');
    if (!popup) {
      return res.status(404).json({ success: false, message: 'Create a popup configuration before enabling it' });
    }
    popup.isActive = req.body.isActive === true || req.body.isActive === 'true';
    await popup.save();
    res.json({ success: true, popup: getPopupFields(popup) });
  } catch (error) {
    next(error);
  }
};

exports.deleteAdminPopup = async (req, res, next) => {
  try {
    await WebsitePopup.findByIdAndDelete('website-popup');
    res.json({ success: true, message: 'Website popup configuration reset' });
  } catch (error) {
    next(error);
  }
};

exports.getActivePopup = async (req, res, next) => {
  try {
    const now = new Date();
    const popup = await WebsitePopup.findOne({
      _id: 'website-popup',
      isActive: true,
      $and: [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gte: now } }] }
      ]
    });
    res.json({ success: true, popup: popup ? getPopupFields(popup) : null });
  } catch (error) {
    next(error);
  }
};

exports.getPopupImage = async (req, res, next) => {
  try {
    const popup = await WebsitePopup.findById('website-popup').select('image.data image.contentType');
    if (!popup?.image?.data?.length) {
      return res.status(404).json({ success: false, message: 'Popup image not found' });
    }
    res.set('Content-Type', popup.image.contentType);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('X-Content-Type-Options', 'nosniff');
    return res.send(popup.image.data);
  } catch (error) {
    next(error);
  }
};
