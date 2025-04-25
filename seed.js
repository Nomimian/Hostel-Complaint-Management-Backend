const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err));

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const seedDatabase = async () => {
  try {
    await User.deleteMany();
    console.log('Previous users deleted.');

    const users = [
      // Hostel A Data
      { email: '2021cs601@student.uet.edu.pk', password: 'pass123', role: 'Student', name: 'Ali Raza', regno: '2021-CS-601', hostel: 'Hostel A', campus: 'UET KSK' },
      { email: '2021cs602@student.uet.edu.pk', password: 'admin456', role: 'Student', name: 'Fatima Noor', regno: '2021-CS-602', hostel: 'Hostel A', campus: 'UET KSK' },
      { email: '2021cs633@student.uet.edu.pk', password: 'user789', role: 'Student', name: 'Ahmed Khan', regno: '2021-CS-603', hostel: 'Hostel A', campus: 'UET KSK' },
      { email: '2021cs604@student.uet.edu.pk', password: 'admin123', role: 'Student', name: 'Sara Tariq', regno: '2021-CS-604', hostel: 'Hostel A', campus: 'UET KSK' },
      // Hostel B Data
      { email: '2021cs651@student.uet.edu.pk', password: 'pass123', role: 'Student', name: 'Ali Raza', regno: '2021-CS-651', hostel: 'Hostel B', campus: 'UET KSK' },
      { email: '2021cs652@student.uet.edu.pk', password: 'admin456', role: 'Student', name: 'Fatima Noor', regno: '2021-CS-652', hostel: 'Hostel B', campus: 'UET KSK' },
      { email: '2021cs653@student.uet.edu.pk', password: 'user789', role: 'Student', name: 'Ahmed Khan', regno: '2021-CS-653', hostel: 'Hostel B', campus: 'UET KSK' },
      { email: '2021cs654@student.uet.edu.pk', password: 'admin123', role: 'Student', name: 'Sara Tariq', regno: '2021-CS-654', hostel: 'Hostel B', campus: 'UET KSK' },
      // Other Roles
      { email: 'RT@rt.uet.edu.pk', password: 'userqaz', role: 'RT', name: 'Faisal Ahmed', regno: 'rt.uet', hostel: 'Hostel A', campus: 'UET KSK' },
      { email: 'RT1@rt.uet.edu.pk', password: 'userqaz', role: 'RT', name: 'Faisal Ahmed', regno: 'rt1.uet', hostel: 'Hostel B', campus: 'UET KSK' },
      { email: 'Warden@warden.uet.edu.pk', password: 'userqaz', role: 'Warden', name: 'Faisal Ahmed', regno: 'wardenuet', hostel: 'none', campus: 'UET KSK' },
      { email: 'EndUser@eu.uet.edu.pk', password: 'userqaz', role: 'EndUser', name: 'Faisal Ahmed', regno: 'Carpenter', hostel: 'none', campus: 'UET KSK', type: 'Carpenter' },
      { email: 'EndUser4@eu.uet.edu.pk', password: 'userqaz', role: 'EndUser', name: 'Faisal Ahmed', regno: 'Plumber', hostel: 'none', campus: 'UET KSK', type: 'Plumber' },
      { email: 'EndUser1@eu.uet.edu.pk', password: 'userqaz', role: 'EndUser', name: 'Muhammad Ahmed', regno: 'Electrician', hostel: 'none', campus: 'UET KSK' , type: 'Electrician'},
      { email: 'EndUser2@eu.uet.edu.pk', password: 'userqaz', role: 'EndUser', name: 'Muhammad Ahmed', regno: 'Other', hostel: 'none', campus: 'UET KSK', type: 'Others' },
      { email: 'CC@cc.uet.edu.pk', password: 'userqaz', role: 'CC', name: 'Muhammad Numan', regno: 'CC-UET-KSK', hostel: 'none', campus: 'UET KSK' },
      { email: 'Munshi@mun.uet.edu.pk', password: 'userqaz', role: 'Munshi', name: 'Ishtiaq A', regno: 'Munshi A', hostel: 'A', campus: 'UET KSK' },
      { email: 'Munshi1@mun.uet.edu.pk', password: 'userqaz', role: 'Munshi', name: 'Ishtiaq B', regno: 'Munshi1 B', hostel: 'B', campus: 'UET KSK' },
      { email: 'Superadmin@sa.uet.edu.pk', password: 'userqaz', role: 'SuperAdmin', name: 'Super-Admin', regno: 'SuperAdmin-UET-KSK', hostel: 'none', campus: 'UET KSK' },
      { email: 'Munshi2@m.uet.edu.pk', password: 'userqaz', role: 'Munshi', name: 'Shafeeq', regno: 'Munshi2', hostel: 'A', campus: 'UET KSK' },
    ];

    // Hash all passwords before inserting users
    for (const user of users) {
      user.password = await hashPassword(user.password);
    }

    await User.insertMany(users);
    console.log('Seeding completed successfully!');

    mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding database:', error);
    mongoose.connection.close();
  }
};

seedDatabase();
