const base = require('./app.json').expo;
if (process.env.EAS_BUILD || process.env.EAS_BUILD_ID) throw new Error('Laboratorio: builds EAS bloqueadas');
module.exports = { expo: { ...base, name: 'DJ Planner · Carteles LAB', slug: 'dj-planner-carteles-lab', scheme: 'djplanner-carteles-lab', ios: { ...base.ios, bundleIdentifier: 'local.djplanner.carteleslab' }, android: { ...base.android, package: 'local.djplanner.carteleslab' }, extra: { router: {} }, updates: { enabled: false } } };
