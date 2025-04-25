const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { generateJWT } = require('../middleware/auth');
const Hostel = require('../models/Hostel');

const otps = {}; // Temporary in-memory storage for OTPs

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// ------------------ ROUTES ------------------

// 1. User Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const token = generateJWT(user._id);

    // Fetch complaints associated with the user's regno
    const complaints = await Complaint.find({ registrationNo: user.regno });

    res.json({
      message: 'Login successful',
      role: user.role,
      regno: user.regno,
      complaints,  // ✅ Return complaints along with login response
      hostel: user?.hostel,
      token
    });


  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});


// 2. Send OTP
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Throttle OTP requests (every 30 seconds)
    if (otps[email] && otps[email].timestamp > Date.now() - 30000) {
      return res.status(400).json({ message: 'OTP already sent. Please wait before requesting a new one.' });
    }

    const otp = Math.floor(1000 + Math.random() * 9000); // Generate 4-digit OTP
    otps[email] = { otp, timestamp: Date.now() }; // Store OTP with timestamp

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is: ${otp}. It will expire in 30 seconds.`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`OTP sent to ${email}: ${otp}`);
    res.status(200).json({ message: 'OTP sent successfully.' });
  } catch (error) {
    console.error('Failed to send OTP:', error.message);
    res.status(500).json({ message: 'Failed to send OTP.' });
  }
});

// 3. Verify OTP
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required.' });
  }

  if (otps[email] && otps[email].otp === parseInt(otp, 10)) {
    delete otps[email]; // Remove OTP after successful verification
    return res.status(200).json({ message: 'OTP verified successfully.' });
  } else {
    return res.status(400).json({ message: 'Invalid or expired OTP.' });
  }
});

// 4. Update Password
router.put('/update-password', async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ message: 'Email and new password are required.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Error updating password:', err.message);
    res.status(500).json({ message: 'Failed to update password.' });
  }
});

// Fetch User Details
router.get('/user-details', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    // Fetch user details including the hostel field
    const user = await User.findOne({ email }, 'name regno hostel');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user details:', error.message);
    res.status(500).json({ message: 'Internal Server Error.' });
  }
});


// 6. Submit Complaint
router.post('/submit-complaint', async (req, res) => {
  const { title, registrationNo, roomNo, date, description, hostel } = req.body;

  if (!title || !registrationNo || !roomNo || !date || !description || !hostel) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const newComplaint = new Complaint({
      title,
      registrationNo,
      roomNo,
      date,
      description,
      hostel,
      status: 'RT', // Set status to "RT" after submission
      submittedBy: req.user?.email || 'Unknown',
    });

    await newComplaint.save();
    const newNotificationStudent = new Notification({
      registrationNo: registrationNo,
      complaintId: newComplaint._id,
      sendTo: "Student",
      title: title,
      hostel: hostel,
      message: "Your complaint about " + title + " has reached the RT.",
      status: "new",
    });
    const newNotificationRt = new Notification({
      registrationNo: registrationNo,
      complaintId: newComplaint._id,
      sendTo: "RT",
      title: title,
      hostel: hostel,
      message: "Your have received a complaint from "+registrationNo+" about " + title,
      status: "new",
    });
    await newNotificationStudent.save();
    await newNotificationRt.save();
    // PDF generation code remains unchanged
    const doc = new PDFDocument();
    const pdfPath = path.join(__dirname, `../uploads/complaint-${newComplaint._id}.pdf`);
    doc.pipe(fs.createWriteStream(pdfPath));
    doc.fontSize(16).text('Complaint Details', { underline: true });
    doc.text(`Title: ${title}`);
    doc.text(`Registration No: ${registrationNo}`);
    doc.text(`Room No: ${roomNo}`);
    doc.text(`Date: ${date}`);
    doc.text(`Description: ${description}`);
    doc.end();

    newComplaint.filePath = pdfPath;
    await newComplaint.save();

    res.status(201).json({
      message: 'Complaint submitted successfully.',
      complaint: newComplaint,
    });
  } catch (error) {
    console.error('Error saving complaint:', error.message);
    res.status(500).json({ message: 'Failed to submit complaint.' });
  }
});

router.put('/reject-complaint/:id', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body; // Reason for rejection
  try{
    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found.' });
    }

    // Update status and reason for rejection
    complaint.status = 'Rejected';
    complaint.reason = reason; // Store the rejection reason
    await complaint.save();
    const newNotification = new Notification({
      registrationNo: complaint.registrationNo,
      complaintId: complaint._id,
      sendTo: "Student",
      title: complaint.title,
      message: "Your complaint about " + complaint.title + " has been rejected",
      reason: reason,
      status: "new",
    });
    await newNotification.save();

    res.status(200).json({ message: 'Complaint rejected successfully.', complaint });
  }
  catch (error) {
    console.error('Error rejecting complaint:', error.message);
    res.status(500).json({ message: 'Failed to reject complaint.', error: error.message });
  }
});
// 7. Get all Complaints
router.get('/complaints', async (req, res) => {
  try {
    const complaints = await Complaint.find(); // Fetch all complaints
    res.status(200).json({ message: 'Complaints fetched successfully.', complaints });
  } catch (error) {
    console.error('Error fetching complaints:', error.message);
    res.status(500).json({ message: 'Failed to fetch complaints.', error: error.message });
  }
});


// 8. Get Complaint by ID (View Complaint)
router.get('/complaint/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found.' });
    }
    res.status(200).json({ message: 'Complaint fetched successfully.', complaint });
  } catch (error) {
    console.error('Error fetching complaint:', error.message);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

// Fetch complaint status
router.get('/complaint-status', async (req, res) => {
  const { regNo } = req.query;

  try {
    const complaint = await Complaint.findOne({ registrationNo: regNo }).sort({ createdAt: -1 });

    if (!complaint) {
      return res.status(404).json({ message: 'No complaint found for this registration number.' });
    }

    res.json({ status: complaint.status });
  } catch (error) {
    console.error('Error fetching complaint status:', error.message);
    res.status(500).json({ message: 'Failed to fetch complaint status.' });
  }
});


router.get('/student-complaints', async (req, res) => {
  const { regNo } = req.query;

  if (!regNo) {
    return res.status(400).json({ message: 'Registration number is required.' });
  }

  try {
    const complaints = await Complaint.find({
      registrationNo: regNo.trim()
    });

    res.status(200).json({ complaints });
  } catch (error) {
    console.error('Error fetching student complaints:', error.message);
    res.status(500).json({ message: 'Failed to fetch student complaints.' });
  }
});






// Update Complaint Status to RT
router.put('/update-status-to-rt/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found.' });
    }

    // Update status only if it is currently "Student"
    if (complaint.status === 'Student') {
      complaint.status = 'RT';
      await complaint.save();
      const newNotificationStudent = new Notification({
        registrationNo: registrationNo,
        complaintId: complaint._id,
        sendTo: "Student",
        message: "Your complaint about "+title+" has been forwarded to RT.",
        title: title,
        status: "new",
      });
      const newNotificationRt = new Notification({
        registrationNo: registrationNo,
        complaintId: complaint._id,
        sendTo: "RT",
        hostel: complaint.hostel,
        message: "Your have received a complaint from "+registrationNo+" about " + title,
        title: title,
        status: "new",
      });
      await Promise.all([newNotificationStudent.save(), newNotificationRt.save()]);
      return res.status(200).json({ message: 'Status updated to RT successfully.', complaint });
    }

    res.status(200).json({ message: 'Status already updated.', complaint });
  } catch (error) {
    console.error('Error updating status to RT:', error.message);
    res.status(500).json({ message: 'Failed to update status to RT.' });
  }
});

//---------------------------------------------

router.get("/complaints-munshi", async (req, res) => {
  try {
    // Fetch complaints where title is "Mess" and status is "Munshi"
    const messComplaints = await Complaint.find({ title: "Mess", status: "Munshi" });

    if (!messComplaints.length) {
      return res.status(404).json({ message: "No mess complaints found" });
    }

    res.json({ complaints: messComplaints });
  } catch (error) {
    console.error("Error fetching mess complaints:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
});


router.put("/update-status/:complaintId", async (req, res) => {
  const { complaintId } = req.params;
  const { status, priority } = req.body; // New status from frontend

  try {
    const complaint = await Complaint.findById(complaintId);

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    // Unified status flow for all complaints
    const statusFlow = ["Student", "RT", "Warden", "Munshi", "End User", "Done"];

    const currentIndex = statusFlow.indexOf(complaint.status);

    // Validate current status exists in flow and is not already at the final stage
    if (currentIndex === -1 || currentIndex === statusFlow.length - 1) {
      return res.status(400).json({ message: "Invalid status update" });
    }

    // Ensure status update follows the correct sequence

    complaint.status = status;
    if(priority){
      complaint.priority = priority;
    }
    complaint.new = true; // Mark as new for the next recipient
    await complaint.save();
    const msg = status === "Done" ? "been resolved." : `reached the ${status}.`;
    const newNotificationStudent = new Notification({
      registrationNo: complaint.registrationNo,
      complaintId: complaint._id,
      sendTo: "Student",
      title: complaint.title,
      message: `Your complaint about ${complaint.title} has ${msg}.`,
      status: "new",
    });
    await newNotificationStudent.save();
    if(status !== "Done"){
      const newNotificationStatus = new Notification({
        registrationNo: complaint.registrationNo,
        complaintId: complaint._id,
        sendTo: status,
        title: complaint.title,
        message: `Your have received a complaint from ${complaint.registrationNo} about ${complaint.title}`,
        status: "new",
      });
      await newNotificationStatus.save();
    }
    return res.status(200).json({ message: `Status updated to ${status} successfully.`, complaint });

  } catch (error) {
    console.error("Error updating complaint status:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/assign/:complaintId", async (req, res) => {
  const { complaintId } = req.params;
  const { assignedTo, status } = req.body; // New status from frontend

  try {
    const complaint = await Complaint.findById(complaintId);

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    // Update assignedTo and status
    complaint.assignedTo = assignedTo;
    complaint.status = status;
    await complaint.save();
    const newNotificationEnd = new Notification({
      registrationNo: complaint.registrationNo,
      complaintId: complaint._id,
      sendTo: assignedTo,
      title: complaint.title,
      message: `Your have received a complaint from ${complaint.registrationNo} about ${complaint.title}`,
      status: "new",
    });
    const newNotificationStudent = new Notification({
      registrationNo: complaint.registrationNo,
      complaintId: complaint._id,
      sendTo: "Student",
      title: complaint.title,
      message: `Your complaint about ${complaint.title} has been assigned to ${assignedTo}.`,
      status: "new",
    });
    await newNotificationStudent.save();
    await newNotificationEnd.save();
    res.status(200).json({ message: "Complaint assigned successfully", complaint });
  } catch (error) {
    console.error("Error assigning complaint:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/notifications/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userRoles = ["Student", "RT", "Warden", "Munshi", "End User"];
    const endUserRoles = ["Electrician", "Plumber", "Carpenter", "Other"];
    let notifications;
    if( userRoles.includes(id)) {
      notifications = await Notification.find({ sendTo: id }).sort({ date: -1 });
    }
    else if(id.split("-")[0] === "RT"){
      console.log("RT ID:", id);
      const hostel = id.split("-")[1];
      notifications = await Notification.find({ sendTo: "RT", hostel: hostel }).sort({ date: -1 });
      console.log("Notifications:", notifications);
    }
    else if (id.split("-")[0] === "EndUser") {
      const user = await User.findOne({ regno: id.split("-")[1] }).select("type");
      const type = user?.type;
      if (endUserRoles.includes(type)) {
        notifications = await Notification.find({ sendTo: type }).sort({ date: -1 });
      } else {
        return res.status(404).json({ message: "No notifications found" });
      }
    }
     else {
      notifications = await Notification.find({ registrationNo: id, sendTo: "Student" }).sort({ date: -1 });
    }
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Error fetching notifications" });
  }
});


router.get("/profile", async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ registrationNo: user.registrationNo });
  } catch (error) {
    res.status(500).json({ message: "Error fetching profile" });
  }
});


router.get('/get-rt/:email', async (req, res) => {
  try {
    const rtEmail = req.params.email;
    const rtUser = await User.findOne({ email: rtEmail });

    if (!rtUser) {
      return res.status(404).json({ message: 'RT not found' });
    }

    res.json({ hostel: rtUser.hostel });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Fetch all End Users
router.get('/end-users', async (req, res) => {
  try {
    const endUsers = await User.find({ role: "EndUser" }); // Fetch only End Users
    res.status(200).json({ message: 'End Users fetched successfully.', endUsers });
  } catch (error) {
    console.error('Error fetching End Users:', error.message);
    res.status(500).json({ message: 'Failed to fetch End Users.', error: error.message });
  }
});

// Add a New End User
router.post("/end-users", async (req, res) => {
  try {
    console.log("Received request body:", req.body);  // Debugging log

    const { name, role, email, password, regno, hostel } = req.body;

    if (!name || !role || !email || !password || !regno || !hostel) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newEndUser = new User({ name, role, email, password, regno, hostel });
    await newEndUser.save();

    res.status(201).json(newEndUser);
  } catch (error) {
    res.status(500).json({ message: "Error adding end user", error: error.message });
  }
});


// Edit an End User
router.put("/end-users/:id", async (req, res) => {
  try {
    const { name, role, email, regno, hostel } = req.body;

    if (!name || !role || !email || !regno || !hostel) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const userExists = await User.findById(req.params.id);
    if (!userExists) {
      return res.status(404).json({ message: "End User not found" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { name, role, email, regno, hostel },
      { new: true, runValidators: true }
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Error updating end user", error: error.message });
  }
});

// Delete an End User
router.delete("/end-users/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    console.log("Deleting user with ID:", userId);  // Debugging

    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully", user: deletedUser });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Error deleting user", error: error.message });
  }
});

//--------------------- RT ----------------------------

// 📌 Get All RTs
router.get("/rts", async (req, res) => {
  try {
    const rts = await User.find({ role: "RT" }, "name role hostel regno password email");
    res.json(rts);
  } catch (error) {
    res.status(500).json({ message: "Error fetching RTs", error: error.message });
  }
});

// 📌 Add New RT
router.post("/rts", async (req, res) => {
  try {
    const { name, role, email, password, regno, hostel } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already taken" });
    }


    const newRT = new User({ name, role, email, password: hashedPassword, regno, hostel });
    await newRT.save();


    res.status(201).json({ message: "RT added successfully", newRT });
  } catch (error) {
    res.status(500).json({ message: "Error adding RT", error: error.message });
  }
});

// 📌 Update RT
router.put("/rts/:id", async (req, res) => {
  try {
    const { name, hostel } = req.body;
    const updatedRT = await User.findByIdAndUpdate(req.params.id, { name, hostel }, { new: true });
    res.json({ message: "RT updated successfully", updatedRT });
  } catch (error) {
    res.status(500).json({ message: "Error updating RT", error: error.message });
  }
});

// 📌 Delete RT
router.delete("/rts/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "RT deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting RT", error: error.message });
  }
});

//---------------------------Student--------------------

// Get all students
router.get("/students", async (req, res) => {
  const students = await User.find({ role: "Student" });
  res.json(students);
});

// Add new student
router.post("/students", async (req, res) => {
  const existingUser = await User.findOne({ $or: [{ email: req.body.email }, { regno: req.body.regno }] });

if (existingUser) {
  return res.status(400).json({ message: "Email or Reg No already exists" });
}

  const student = new User(req.body);
  await student.save();
  res.json(student);
});

// Update student
router.put("/students/:id", async (req, res) => {
  const updatedStudent = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updatedStudent);
});

// Delete student
router.delete("/students/:id", async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: "Student deleted" });
});
//=======================================

// Get all CC users
router.get("/cc", async (req, res) => {
  const ccs = await User.find({ role: "CC" });
  res.json(ccs);
});

// Update CC
router.put("/cc/:id", async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, req.body);
  res.send("Updated Successfully");
});

// Delete CC
router.delete("/cc/:id", async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.send("Deleted Successfully");
});

// Add New CC
router.post("/cc", async (req, res) => {
  const existingUser = await User.findOne({ email: req.body.email });
  if (existingUser) return res.status(400).send("Email already exists");

  const newCC = new User(req.body);
  await newCC.save();
  res.json(newCC);
});
//================================================
router.get("/wardens", async (req, res) => {
  try {
    const wardens = await User.find({ role: "Warden" });
    res.json(wardens);
  } catch (error) {
    res.status(500).json({ message: "Error fetching wardens" });
  }
});

router.post("/wardens", async (req, res) => {
  try {
    console.log("Received Data:", req.body); // Debugging log

    const { name, email, campus, password, regno, hostel } = req.body;

    if (!name || !email || !password || !regno || !hostel) {
      return res.status(400).json({ error: "All fields are required!" });
    }

    // Check if email already exists
    const existingWarden = await User.findOne({ email });
    if (existingWarden) {
      return res.status(400).json({ error: "Email already exists." });
    }

    // Create a new warden user
    const newWarden = new User({ name, email, campus, password, regno, hostel, role: "Warden" });
    await newWarden.save();

    res.status(201).json(newWarden);
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/wardens/:id", async (req, res) => {
  try {
    const { name } = req.body;
    const updatedWarden = await User.findByIdAndUpdate(req.params.id, { name }, { new: true });
    res.json(updatedWarden);
  } catch (error) {
    res.status(500).json({ message: "Error updating warden" });
  }
});

router.delete("/wardens/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Warden removed" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting warden" });
  }
});

//===================================================
// Get all Munshis
router.get("/munshi", async (req, res) => {
  try {
    const munshis = await User.find({ role: "Munshi" });
    res.json(munshis);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// 📌 Add New RT
router.post("/munshi", async (req, res) => {
  try {
    const { name, role, email,campus, password, regno, hostel } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already taken" });
    }


    const newMunshi = new User({ name, role, email, campus, password: hashedPassword, regno, hostel });
    await newMunshi.save();


    res.status(201).json({ message: "Munshi added successfully", newMunshi });
  } catch (error) {
    res.status(500).json({ message: "Error adding Munshi", error: error.message });
  }
});

// 📌 Update Munshi
router.put("/munshi/:id", async (req, res) => {
  try {
    const { name, hostel } = req.body;
    const updatedMunshi = await User.findByIdAndUpdate(req.params.id, { name, hostel }, { new: true });
    res.json({ message: "Munshi updated successfully", updatedMunshi });
  } catch (error) {
    res.status(500).json({ message: "Error updating Munshi", error: error.message });
  }
});

// 📌 Delete Munshi
router.delete("/munshi/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "RT deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting RT", error: error.message });
  }
});

router.get("/complaints-enduser/:regno", async (req, res) => {
  try {
    const { regno } = req.params;
    if (!regno) {
      return res.status(400).json({ message: "Registration number is required" });
    }

    const user = await User.findOne({ regno: regno }).select("type");
    const type = user?.type;
    if (!type) {
      return res.status(404).json({ message: "User not found" });
    }
    // Fetch all complaints where status is 'EndUser'
    const complaints = await Complaint.find({ status: "End User", assignedTo: type }).sort({ date: -1 });

    if (!complaints.length) {
      return res.status(404).json({ message: "No complaints found for End User" });
    }

    res.json({ complaints });
  } catch (error) {
    console.error("Error fetching complaints for EndUser:", error.message);
    res.status(500).json({ message: "Server Error" });
  }
});
//=================================================
router.get("/complaint-stats", async (req, res) => {
  try {
    const { month, hostel } = req.query;
    if (!month || !hostel) {
      return res.status(400).json({ error: "Month and hostel are required" });
    }

    // Convert month name to a numeric value (January = 0, February = 1, etc.)
    const currentYear = new Date().getFullYear();
    const monthIndex = new Date(`${month} 1, ${currentYear}`).getMonth();
    const startDate = new Date(currentYear, monthIndex, 1); // Start of the month
    const endDate = new Date(currentYear, monthIndex + 1, 0, 23, 59, 59); // End of the month

    // Initialize weekly counters
    const weeklyStats = {
      resolved: [0, 0, 0, 0, 0],
      pending: [0, 0, 0, 0, 0],
      rejected: [0, 0, 0, 0, 0],
    };
    console.log(hostel); // Debugging log
    // Fetch complaints for the given month and hostel
    const complaints = await Complaint.find({
      hostel,
      date: { $gte: startDate, $lt: endDate },
    });
    console.log("Fetched complaints:", complaints); // Debugging log
    // Categorize complaints into weeks
    complaints.forEach((complaint) => {
      const complaintDate = new Date(complaint.date);
      const weekIndex = Math.min(Math.floor(complaintDate.getDate() / 7), 4); // Ensures it stays within 0-4

      if (complaint.status === "Done") {
        weeklyStats.resolved[weekIndex]++;
      } else if (complaint.status === "Rejected") {
        weeklyStats.rejected[weekIndex]++;
      } else {
        weeklyStats.pending[weekIndex]++;
      }
    });

    res.json(weeklyStats);
  } catch (error) {
    console.error("Error fetching complaint stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const students = await User.countDocuments({ role: 'Student' });
    const totalComplaints = await Complaint.countDocuments();
    const resolvedComplaints = await Complaint.countDocuments({ status: 'Done' });
    const pendingComplaints = await Complaint.countDocuments({ status: { $ne: 'Done' } });

    res.status(200).json({
      students,
      totalComplaints,
      resolvedComplaints,
      pendingComplaints,
    });
  } catch (error) {
    console.error('Error fetching stats:', error.message);
    res.status(500).json({ message: 'Failed to fetch stats.' });
  }
});

router.get("/hostels", async (req, res) => {
  try {
    const hostels = await Hostel.find({});
    if (!hostels || hostels.length === 0) {
      return res.status(404).json({ message: "No hostels found" });
    }
    res.status(200).json(hostels);
  } catch (error) {
    res.status(500).json({ message: "Error fetching hostels" });
  }
});

// POST add new hostel
router.post("/hostels", async (req, res) => {
  const { name, rooms } = req.body;

  try {
    const newHostel = new Hostel({ name, rooms });
    await newHostel.save();
    res.status(201).json(newHostel);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT update hostel by name
router.put("/hostels/:hostelName", async (req, res) => {
  const { hostelName } = req.params;
  const { rooms } = req.body;

  try {
    const updated = await Hostel.findOneAndUpdate(
      { name: hostelName },
      { rooms },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Hostel not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE hostel
router.delete("/hostels/:hostelName", async (req, res) => {
  try {
    await Hostel.findOneAndDelete({ name: req.params.hostelName });
    res.json({ message: "Hostel deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Get detailed stats for a hostel
router.get("/hostel-stats/:hostelName", async (req, res) => {
  const hostelName = req.params.hostelName;

  try {
    const usersCount = await User.countDocuments({ hostel: hostelName });
    const hostel = await Hostel.findOne({ name: hostelName });
    const complaintsCount = await Complaint.countDocuments({ hostel: hostelName });

    if (!hostel) {
      return res.status(404).json({ message: "Hostel not found" });
    }

    res.status(200).json({
      hostelName: hostel.name,
      rooms: hostel.rooms, // assuming your hostel schema has a 'rooms' field
      students: usersCount,
      complaints: complaintsCount,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch stats", error: error.message });
  }
});


// Get unique roles excluding SuperAdmin
router.get('/distinct-roles', async (req, res) => {
  try {
    const roles = await User.distinct("role", { role: { $ne: "SuperAdmin" } });
    res.json(roles);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

router.get('/user-by-email/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});




module.exports = router;
