require('dotenv').config();

const connectDB = require('../config/db');
const User = require('../models/User');

async function seed() {
  await connectDB();

  const username = (process.argv[2] || 'admin').toLowerCase();
  const password = process.argv[3] || 'admin123';

  let user = await User.findOne({ username });
  if (user) {
    console.log(`User "${username}" already exists`);
  } else {
    user = await User.create({ username, password });
    console.log(`Created user "${username}"`);
  }

  console.log({ id: user._id.toString(), username: user.username, password });
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
