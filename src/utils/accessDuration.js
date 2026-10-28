/**
 * Calendar month date calculations
 * Rules:
 * - Adding N calendar months preserves day-of-month where possible.
 * - If target month has fewer days (e.g. Jan 31 + 1 month -> Feb 28/29), clamp to last day of that month.
 * - This ensures Jan 31 + 3 months = Apr 30 (not May 3).
 */
function addCalendarMonths(startDate, monthsToAdd = 3) {
  const d = new Date(startDate);
  const targetYear = d.getFullYear();
  const targetMonth = d.getMonth() + monthsToAdd;
  const originalDay = d.getDate();

  // Create date at 1st of target month
  const result = new Date(targetYear, targetMonth, 1, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  // Find maximum days in target month
  const lastDayOfTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result;
}

/**
 * Check whether an enrollment has active 3-month access
 */
function isEnrollmentActive(enrollment) {
  if (!enrollment) return false;
  if (!['approved', 'completed'].includes(enrollment.status)) return false;
  if (!enrollment.accessStartDate || !enrollment.accessExpiryDate) return false;

  const now = new Date();
  return now >= new Date(enrollment.accessStartDate) && now < new Date(enrollment.accessExpiryDate);
}

module.exports = {
  addCalendarMonths,
  isEnrollmentActive
};

