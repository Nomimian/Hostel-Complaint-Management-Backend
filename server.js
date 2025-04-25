const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const userRoutes = require('./routes/userRoutes');
const searchRoutes = require('./routes/searchRoutes');
const complaintRoutes = require('./routes/complaintRoutes');

const connectDB = require('./db');

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
app.options('*', cors({
    origin: 'https://hostel-complaint-management-frontend.vercel.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }));
  
  app.use(cors({
    origin: 'https://hostel-complaint-management-frontend.vercel.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }));
app.use(express.json());
app.use('/api/users', userRoutes);
app.use('/api', searchRoutes);
app.use('/api/complaints', complaintRoutes);  // For complaint handling


app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});
app._router.stack.forEach(function(r) {
    if (r.route && r.route.path) {
        console.log(r.route.path);
    }
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

process.on('SIGINT', () => {
    server.close(() => {
        console.log('Server shutting down gracefully');
        mongoose.connection.close(() => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });
});


