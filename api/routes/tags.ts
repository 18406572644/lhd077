import { Router } from 'express';
import { TagRepo, TagRelationRepo } from '../data/repositories.js';
import type { TaggableType } from '../../shared/types.js';

const router = Router();

router.get('/', (_req, res) => {
  try {
    const tags = TagRepo.list();
    res.json(tags);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ code: 'LIST_TAGS_FAILED', message: msg });
  }
});

router.get('/tree', (_req, res) => {
  try {
    const tags = TagRepo.list();
    const rootTags = tags.filter((t) => t.parentId === null);
    
    function buildTree(parentId: string | null): unknown[] {
      return tags
        .filter((t) => t.parentId === parentId)
        .map((t) => ({
          ...t,
          children: buildTree(t.id),
        }));
    }
    
    const tree = buildTree(null);
    res.json(tree);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ code: 'GET_TAG_TREE_FAILED', message: msg });
  }
});

router.get('/:id', (req, res) => {
  try {
    const tag = TagRepo.getById(req.params.id);
    if (!tag) {
      res.status(404).json({ code: 'NOT_FOUND', message: '标签不存在' });
      return;
    }
    res.json(tag);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ code: 'GET_TAG_FAILED', message: msg });
  }
});

router.get('/:id/ancestors', (req, res) => {
  try {
    const ancestors = TagRepo.getAncestors(req.params.id);
    res.json(ancestors);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ code: 'GET_ANCESTORS_FAILED', message: msg });
  }
});

router.get('/:id/descendants', (req, res) => {
  try {
    const descendants = TagRepo.getAllDescendants(req.params.id);
    res.json(descendants);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ code: 'GET_DESCENDANTS_FAILED', message: msg });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, color, parentId, description } = req.body as {
      name: string;
      color: string;
      parentId?: string | null;
      description?: string;
    };
    
    if (!name || !color) {
      res.status(400).json({ code: 'MISSING_PARAMS', message: '标签名称和颜色不能为空' });
      return;
    }
    
    const tag = TagRepo.create({
      name,
      color,
      parentId: parentId ?? null,
      description: description ?? '',
    });
    res.json(tag);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(400).json({ code: 'CREATE_TAG_FAILED', message: msg });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { name, color, parentId, description } = req.body as {
      name?: string;
      color?: string;
      parentId?: string | null;
      description?: string;
    };
    
    const patch: { name?: string; color?: string; parentId?: string | null; description?: string } = {};
    if (name !== undefined) patch.name = name;
    if (color !== undefined) patch.color = color;
    if (parentId !== undefined) patch.parentId = parentId;
    if (description !== undefined) patch.description = description;
    
    const tag = TagRepo.update(req.params.id, patch);
    if (!tag) {
      res.status(404).json({ code: 'NOT_FOUND', message: '标签不存在' });
      return;
    }
    res.json(tag);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(400).json({ code: 'UPDATE_TAG_FAILED', message: msg });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const result = TagRepo.delete(req.params.id);
    if (!result.success) {
      res.status(404).json({ code: 'NOT_FOUND', message: '标签不存在' });
      return;
    }
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ code: 'DELETE_TAG_FAILED', message: msg });
  }
});

router.post('/:targetType/:targetId/tags', (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const { tagIds } = req.body as { tagIds: string[] };
    
    if (!['document', 'qa', 'evaluation'].includes(targetType)) {
      res.status(400).json({ code: 'INVALID_TYPE', message: '无效的目标类型' });
      return;
    }
    
    if (!Array.isArray(tagIds)) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'tagIds 必须是数组' });
      return;
    }
    
    TagRelationRepo.setTagsForTarget(tagIds, targetType as TaggableType, targetId);
    const relations = TagRelationRepo.listByTarget(targetType as TaggableType, targetId);
    const resultTagIds = relations.map((r) => r.tagId);
    
    res.json({ success: true, tagIds: resultTagIds });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ code: 'SET_TAGS_FAILED', message: msg });
  }
});

router.get('/:targetType/:targetId/tags', (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    
    if (!['document', 'qa', 'evaluation'].includes(targetType)) {
      res.status(400).json({ code: 'INVALID_TYPE', message: '无效的目标类型' });
      return;
    }
    
    const relations = TagRelationRepo.listByTarget(targetType as TaggableType, targetId);
    const tagIds = relations.map((r) => r.tagId);
    const tags = TagRepo.getByIds(tagIds);
    
    res.json(tags);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ code: 'GET_TAGS_FAILED', message: msg });
  }
});

router.put('/:targetType/:targetId/tags', (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const { tagIds } = req.body as { tagIds: string[] };
    
    if (!['document', 'qa', 'evaluation'].includes(targetType)) {
      res.status(400).json({ code: 'INVALID_TYPE', message: '无效的目标类型' });
      return;
    }
    
    if (!Array.isArray(tagIds)) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'tagIds 必须是数组' });
      return;
    }
    
    TagRelationRepo.setTagsForTarget(tagIds, targetType as TaggableType, targetId);
    const relations = TagRelationRepo.listByTarget(targetType as TaggableType, targetId);
    const resultTagIds = relations.map((r) => r.tagId);
    
    res.json({ success: true, tagIds: resultTagIds });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ code: 'UPDATE_TAGS_FAILED', message: msg });
  }
});

router.post('/filter/:targetType', (req, res) => {
  try {
    const { targetType } = req.params;
    const { tagIds, matchAll = false } = req.body as {
      tagIds: string[];
      matchAll?: boolean;
    };
    
    if (!['document', 'qa', 'evaluation'].includes(targetType)) {
      res.status(400).json({ code: 'INVALID_TYPE', message: '无效的目标类型' });
      return;
    }
    
    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      res.status(400).json({ code: 'INVALID_PARAMS', message: 'tagIds 必须是非空数组' });
      return;
    }
    
    const targetIds = TagRelationRepo.getTargetIdsByTags(
      tagIds,
      targetType as TaggableType,
      matchAll,
    );
    
    res.json({ targetIds });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ code: 'FILTER_FAILED', message: msg });
  }
});

export default router;
