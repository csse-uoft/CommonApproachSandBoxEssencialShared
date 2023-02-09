const express = require('express');
const {createIndicatorReportHandler, fetchIndicatorReportHandler, updateIndicatorReportHandler} = require("../services/indicatorReport/indicatorReport");


const router = express.Router();

router.get('/:id', fetchIndicatorReportHandler);
router.post('/', createIndicatorReportHandler);
router.put('/:id', updateIndicatorReportHandler)


module.exports = router;