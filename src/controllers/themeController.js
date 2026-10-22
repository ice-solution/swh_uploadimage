const Theme = require('../models/Theme');

/** 正規化為當日 00:00:00.000 UTC（用 YYYY-MM-DD 字串時） */
function parseDateOnly(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return { error: `${fieldName} is required` };
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { date: startOfUtcDay(value) };
  }

  const str = String(value).trim();
  // 接受 YYYY-MM-DD 或 ISO datetime
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return { error: `${fieldName} must be a valid date (YYYY-MM-DD)` };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { error: `${fieldName} is not a valid calendar date` };
  }

  return { date };
}

function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endOfUtcDay(d) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)
  );
}

function serializeTheme(doc) {
  return {
    id: doc._id,
    phase: doc.phase,
    start_date: doc.start_date.toISOString().slice(0, 10),
    end_date: doc.end_date.toISOString().slice(0, 10),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * 區間重疊：A.start <= B.end && A.end >= B.start
 */
async function findOverlap({ start_date, end_date, excludeId }) {
  const query = {
    start_date: { $lte: end_date },
    end_date: { $gte: start_date },
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return Theme.findOne(query);
}

async function listThemes(_req, res, next) {
  try {
    const themes = await Theme.find().sort({ start_date: 1 });
    return res.json({
      success: true,
      data: themes.map(serializeTheme),
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 依日期查出當前 phase（預設今天）
 * GET /api/theme/current?date=YYYY-MM-DD
 */
async function getCurrentTheme(req, res, next) {
  try {
    let day;
    if (req.query.date) {
      const parsed = parseDateOnly(req.query.date, 'date');
      if (parsed.error) {
        return res.status(400).json({ success: false, message: parsed.error });
      }
      day = parsed.date;
    } else {
      day = startOfUtcDay(new Date());
    }

    const theme = await Theme.findOne({
      start_date: { $lte: day },
      end_date: { $gte: day },
    });

    if (!theme) {
      return res.status(404).json({
        success: false,
        message: 'No theme/phase found for this date',
        date: day.toISOString().slice(0, 10),
      });
    }

    return res.json({
      success: true,
      data: {
        ...serializeTheme(theme),
        queried_date: day.toISOString().slice(0, 10),
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function getThemeById(req, res, next) {
  try {
    const theme = await Theme.findById(req.params.id);
    if (!theme) {
      return res.status(404).json({ success: false, message: 'Theme not found' });
    }
    return res.json({ success: true, data: serializeTheme(theme) });
  } catch (err) {
    return next(err);
  }
}

async function createTheme(req, res, next) {
  try {
    const { phase, start_date, end_date } = req.body;

    if (![1, 2, 3].includes(Number(phase))) {
      return res.status(400).json({
        success: false,
        message: 'phase must be 1, 2, or 3',
      });
    }

    const startParsed = parseDateOnly(start_date, 'start_date');
    if (startParsed.error) {
      return res.status(400).json({ success: false, message: startParsed.error });
    }
    const endParsed = parseDateOnly(end_date, 'end_date');
    if (endParsed.error) {
      return res.status(400).json({ success: false, message: endParsed.error });
    }

    const start = startParsed.date;
    const end = endOfUtcDay(endParsed.date);

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'end_date must be on or after start_date',
      });
    }

    const overlap = await findOverlap({ start_date: start, end_date: end });
    if (overlap) {
      return res.status(409).json({
        success: false,
        message: 'Date range overlaps with an existing theme',
        conflict: serializeTheme(overlap),
      });
    }

    const theme = await Theme.create({
      phase: Number(phase),
      start_date: start,
      end_date: end,
    });

    return res.status(201).json({
      success: true,
      data: serializeTheme(theme),
    });
  } catch (err) {
    return next(err);
  }
}

async function updateTheme(req, res, next) {
  try {
    const theme = await Theme.findById(req.params.id);
    if (!theme) {
      return res.status(404).json({ success: false, message: 'Theme not found' });
    }

    const { phase, start_date, end_date } = req.body;

    if (phase !== undefined) {
      if (![1, 2, 3].includes(Number(phase))) {
        return res.status(400).json({
          success: false,
          message: 'phase must be 1, 2, or 3',
        });
      }
      theme.phase = Number(phase);
    }

    let start = theme.start_date;
    let end = theme.end_date;

    if (start_date !== undefined) {
      const startParsed = parseDateOnly(start_date, 'start_date');
      if (startParsed.error) {
        return res.status(400).json({ success: false, message: startParsed.error });
      }
      start = startParsed.date;
    }

    if (end_date !== undefined) {
      const endParsed = parseDateOnly(end_date, 'end_date');
      if (endParsed.error) {
        return res.status(400).json({ success: false, message: endParsed.error });
      }
      end = endOfUtcDay(endParsed.date);
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'end_date must be on or after start_date',
      });
    }

    const overlap = await findOverlap({
      start_date: start,
      end_date: end,
      excludeId: theme._id,
    });
    if (overlap) {
      return res.status(409).json({
        success: false,
        message: 'Date range overlaps with an existing theme',
        conflict: serializeTheme(overlap),
      });
    }

    theme.start_date = start;
    theme.end_date = end;
    await theme.save();

    return res.json({
      success: true,
      data: serializeTheme(theme),
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteTheme(req, res, next) {
  try {
    const theme = await Theme.findByIdAndDelete(req.params.id);
    if (!theme) {
      return res.status(404).json({ success: false, message: 'Theme not found' });
    }
    return res.json({
      success: true,
      message: 'Theme deleted',
      data: serializeTheme(theme),
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listThemes,
  getCurrentTheme,
  getThemeById,
  createTheme,
  updateTheme,
  deleteTheme,
};
