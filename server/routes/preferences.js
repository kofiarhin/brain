import { Router } from 'express';
import { Preference } from '../models/Preference.js';

async function findActivePreference() {
  return Preference.findOne({ active: true }).sort({ updatedAt: -1 });
}

function mergePreferencePayload(existing, payload) {
  const current = existing?.toObject ? existing.toObject() : existing || {};
  const merged = {
    ...current,
    ...payload,
    scheduling: { ...(current.scheduling || {}), ...(payload.scheduling || {}) },
    planning: { ...(current.planning || {}), ...(payload.planning || {}) },
    personalConstraints: { ...(current.personalConstraints || {}), ...(payload.personalConstraints || {}) },
    output: { ...(current.output || {}), ...(payload.output || {}) },
    agentBehaviour: { ...(current.agentBehaviour || {}), ...(payload.agentBehaviour || {}) },
    active: true,
  };
  delete merged._id;
  delete merged.__v;
  delete merged.createdAt;
  delete merged.updatedAt;
  return merged;
}

async function active(_req, res, next) {
  try {
    const preference = await findActivePreference() || await Preference.create({});
    res.json(preference);
  } catch (error) { next(error); }
}

async function updateActive(req, res, next) {
  try {
    const existing = await findActivePreference();
    const payload = mergePreferencePayload(existing, req.body || {});
    const preference = existing
      ? await Preference.findByIdAndUpdate(existing._id, payload, { new: true, runValidators: true })
      : await Preference.create(payload);

    res.json(preference);
  } catch (error) { next(error); }
}

async function list(_req, res, next) {
  try {
    const preferences = await Preference.find().sort({ updatedAt: -1 });
    res.json(preferences);
  } catch (error) { next(error); }
}

const router = Router();

router.get('/', list);
router.get('/active', active);
router.patch('/active', updateActive);

export default router;
