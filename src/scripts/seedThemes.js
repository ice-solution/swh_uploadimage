require('dotenv').config();

const connectDB = require('../config/db');
const Theme = require('../models/Theme');

/**
 * 預設三個不重疊 phase（可依需要改日期）
 * 用法：npm run seed:themes
 */
const DEFAULTS = [
  { phase: 1, start_date: '2026-01-01', end_date: '2026-04-30' },
  { phase: 2, start_date: '2026-05-01', end_date: '2026-08-31' },
  { phase: 3, start_date: '2026-09-01', end_date: '2026-12-31' },
];

function toStart(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toEnd(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
}

async function seed() {
  await connectDB();

  const force = process.argv.includes('--force');
  const count = await Theme.countDocuments();

  if (count > 0 && !force) {
    console.log(`Themes already exist (${count}). Use --force to replace.`);
    const existing = await Theme.find().sort({ start_date: 1 });
    for (const t of existing) {
      console.log({
        id: t._id.toString(),
        phase: t.phase,
        start_date: t.start_date.toISOString().slice(0, 10),
        end_date: t.end_date.toISOString().slice(0, 10),
      });
    }
    process.exit(0);
  }

  if (force) {
    await Theme.deleteMany({});
    console.log('Cleared existing themes');
  }

  for (const item of DEFAULTS) {
    const theme = await Theme.create({
      phase: item.phase,
      start_date: toStart(item.start_date),
      end_date: toEnd(item.end_date),
    });
    console.log('Created', {
      id: theme._id.toString(),
      phase: theme.phase,
      start_date: item.start_date,
      end_date: item.end_date,
    });
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
