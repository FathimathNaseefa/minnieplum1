function roundToFixedNumber(value, fixedNumber = 10) {
    return Math.round(value / fixedNumber) * fixedNumber;
}

module.exports = { roundToFixedNumber };
