const mongoose = require('mongoose');

const websitePopupSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: 'website-popup'
    },
    title: { type: String, trim: true, maxlength: 120, default: '' },
    subtitle: { type: String, trim: true, maxlength: 160, default: '' },
    heading: { type: String, trim: true, maxlength: 180, default: '' },
    description: { type: String, trim: true, maxlength: 1200, default: '' },
    badgeText: { type: String, trim: true, maxlength: 80, default: '' },
    image: {
      data: { type: Buffer, default: null },
      contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], default: null },
      fileName: { type: String, maxlength: 255, default: null }
    },
    primaryButton: {
      text: { type: String, trim: true, maxlength: 60, default: '' },
      url: { type: String, trim: true, maxlength: 2048, default: '' }
    },
    secondaryButton: {
      text: { type: String, trim: true, maxlength: 60, default: '' },
      url: { type: String, trim: true, maxlength: 2048, default: '' }
    },
    layout: {
      type: String,
      enum: ['image-left', 'image-top', 'full-banner', 'centered'],
      default: 'image-left'
    },
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    accentColor: { type: String, match: /^#[0-9a-fA-F]{6}$/, default: '' },
    isActive: { type: Boolean, default: false },
    delaySeconds: { type: Number, min: 0, max: 60, default: 0 },
    displayFrequency: {
      type: String,
      enum: ['session', 'daily', 'every-visit'],
      default: 'session'
    },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    closeOnOverlay: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('WebsitePopup', websitePopupSchema);
