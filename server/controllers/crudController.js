export function createCrudController(Model) {
  return {
    async list(req, res, next) {
      try {
        const items = await Model.find(req.query || {}).sort({ createdAt: -1 });
        res.json(items);
      } catch (error) { next(error); }
    },
    async get(req, res, next) {
      try {
        const item = await Model.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Not found' });
        res.json(item);
      } catch (error) { next(error); }
    },
    async create(req, res, next) {
      try {
        const item = await Model.create(req.body);
        res.status(201).json(item);
      } catch (error) { next(error); }
    },
    async update(req, res, next) {
      try {
        const item = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!item) return res.status(404).json({ message: 'Not found' });
        res.json(item);
      } catch (error) { next(error); }
    },
    async remove(req, res, next) {
      try {
        const item = await Model.findByIdAndDelete(req.params.id);
        if (!item) return res.status(404).json({ message: 'Not found' });
        res.status(204).send();
      } catch (error) { next(error); }
    }
  };
}

export function createStatusActions(Model) {
  const patchStatus = (status, completedAt) => async (req, res, next) => {
    try {
      const item = await Model.findByIdAndUpdate(
        req.params.id,
        { status, completedAt },
        { new: true, runValidators: true }
      );
      if (!item) return res.status(404).json({ message: 'Not found' });
      res.json(item);
    } catch (error) { next(error); }
  };

  return {
    complete: patchStatus('complete', new Date()),
    reopen: patchStatus('open', null),
    archive: patchStatus('archived', null)
  };
}
