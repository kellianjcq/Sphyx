const express = require('express');
const { getTrackRecord, recordOutcome, autoResolveSurvived } = require('../services/track-record');

const router = express.Router();

router.get('/', (_req, res) => {
  autoResolveSurvived();
  res.json(getTrackRecord());
});

router.post('/outcome', (req, res) => {
  try {
    const { alertId, outcome } = req.body;
    if (!alertId) {
      res.status(400).json({ error: 'alertId required' });
      return;
    }
    const result = recordOutcome(Number(alertId), outcome);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
