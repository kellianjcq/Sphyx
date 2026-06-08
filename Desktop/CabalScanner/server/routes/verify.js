const express = require('express');
const { getTokenAnalysis } = require('../services/analysis');

const router = express.Router();

router.get('/:mint', async (req, res) => {
  try {
    const analysis = await getTokenAnalysis(req.params.mint);
    if (!analysis) {
      res.status(404).json({ error: 'Token not found in analysis cache' });
      return;
    }
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
