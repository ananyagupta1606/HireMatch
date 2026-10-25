// Allowed pipeline transitions, enforced on the server
exports.STAGES = ['applied', 'shortlisted', 'interview', 'offered'];
exports.TRANSITIONS = {
  applied: ['shortlisted', 'rejected'],
  shortlisted: ['interview', 'rejected'],
  interview: ['offered', 'rejected'],
  offered: [],
  rejected: [],
};
