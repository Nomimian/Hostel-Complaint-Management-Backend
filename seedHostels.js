// seedHostels.js
const mongoose = require("mongoose");
const Hostel = require("./models/Hostel"); // adjust path if needed

mongoose.connect("mongodb://localhost:27017/hostel_complaint_management", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log("Connected to MongoDB");

  // Define hostel data with room counts
  const hostels = [
    { name: "Hostel A", rooms: 100 },
    { name: "Hostel B", rooms: 80 },
    { name: "Hostel C", rooms: 120 },
    { name: "Hostel D", rooms: 60 },
  ];

  await Hostel.insertMany(hostels);
  console.log("Hostels added successfully!");

  mongoose.disconnect();
})
.catch((err) => {
  console.error("Error connecting to MongoDB:", err.message);
});
