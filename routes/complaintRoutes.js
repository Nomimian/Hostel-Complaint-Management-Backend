const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');

// GET complaints by regno (route: /api/complaints?regno=2021-CS-651)
router.get('/', async (req, res) => {
  try {
    const { regno } = req.query;
    if (!regno) {
      return res.status(400).json({ message: 'Registration number is required' });
    }

    const complaints = await Complaint.find({ regno });
    res.status(200).json(complaints);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching complaints', error });
  }
});

module.exports = router;
