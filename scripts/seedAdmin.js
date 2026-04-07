import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import UserModel from '../src/models/sql/User.js';
import UserSettingsModel from '../src/models/sql/UserSettings.js';

dotenv.config({ path: '.env' });

const SALT_ROUNDS = 12;

async function seedAdmin() {
  const adminData = {
    email: 'johnwarui@gmail.com',
    username: 'Admin304',
    password: 'John1234',
    role: 'admin'
  };

  try {
    console.log(`🚀 Seeding admin user: ${adminData.email}...`);

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(adminData.email);
    if (existingUser) {
      console.log(`⚠️ User ${adminData.email} already exists. Skipping creation.`);
      process.exit(0);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(adminData.password, SALT_ROUNDS);

    // Create user
    const user = await UserModel.create({
      email: adminData.email,
      username: adminData.username,
      passwordHash,
      role: adminData.role
    });

    // Create default settings
    await UserSettingsModel.create(user.id);

    console.log(`✅ Admin user created successfully!`);
    console.log(`📧 Email: ${adminData.email}`);
    console.log(`👤 Username: ${adminData.username}`);
    console.log(`🔑 Role: ${user.role}`);
    
    process.exit(0);
  } catch (error) {
    console.error(`❌ Failed to seed admin user:`, error.message);
    process.exit(1);
  }
}

seedAdmin();
