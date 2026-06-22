import { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  X,
  Tag as TagIcon,
  Palette,
  Save,
  AlertTriangle,
  FolderTree,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import PageHeader from "@/components/PageHeader";
import type { Tag } from "../../shared/types";

interface TagWithChildren extends Tag {
  children: TagWithChildren[];
}

const PRESET_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
  "#F97316",
  "#6366F1",
];

export default function TagManager() {
  const { showToast } = useAppStore();
  const [tags, setTags] = useState<TagWithChildren[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [parentTagId, setParentTagId] = useState<string | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState(PRESET_COLORS[0]);
  const [tagDescription, setTagDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Tag | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const [flatList, treeData] = await Promise.all([
        api.tags.list(),
        api.tags.getTree() as unknown as TagWithChildren[],
      ]);
      setAllTags(flatList);
      setTags(treeData);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "加载标签失败", "error");
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openCreateModal = (parentId: string | null = null) => {
    setParentTagId(parentId);
    setEditingTag(null);
    setTagName("");
    setTagColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    setTagDescription("");
    setShowCreateModal(true);
  };

  const openEditModal = (tag: Tag) => {
    setEditingTag(tag);
    setParentTagId(tag.parentId);
    setTagName(tag.name);
    setTagColor(tag.color);
    setTagDescription(tag.description || "");
    setShowCreateModal(true);
  };

  const handleSubmit = async () => {
    if (!tagName.trim()) {
      showToast("标签名称不能为空", "error");
      return;
    }

    setLoading(true);
    try {
      if (editingTag) {
        await api.tags.update(editingTag.id, {
          name: tagName.trim(),
          color: tagColor,
          description: tagDescription.trim() || undefined,
        });
        showToast("标签更新成功", "success");
      } else {
        await api.tags.create({
          name: tagName.trim(),
          color: tagColor,
          parentId: parentTagId,
          description: tagDescription.trim() || undefined,
        });
        showToast("标签创建成功", "success");
        if (parentTagId) {
          setExpandedIds((prev) => new Set([...prev, parentTagId]));
        }
      }
      setShowCreateModal(false);
      loadTags();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "保存失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tag: Tag) => {
    setDeletingId(tag.id);
    try {
      const result = await api.tags.remove(tag.id);
      showToast(
        `删除成功，共删除 ${result.deletedCount} 个标签`,
        "success"
      );
      setShowDeleteConfirm(null);
      loadTags();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "删除失败", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const countDescendants = (tag: TagWithChildren): number => {
    let count = tag.children.length;
    tag.children.forEach((child) => {
      count += countDescendants(child);
    });
    return count;
  };

  const renderTagTree = (tagList: TagWithChildren[], depth = 0) => {
    return tagList.map((tag) => {
      const hasChildren = tag.children && tag.children.length > 0;
      const isExpanded = expandedIds.has(tag.id);
      const descendantCount = countDescendants(tag);

      return (
        <div key={tag.id}>
          <div
            className={`flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors group ${
              depth === 0 ? "font-medium" : ""
            }`}
            style={{ paddingLeft: `${depth * 20 + 12}px` }}
          >
            {hasChildren ? (
              <button
                onClick={() => toggleExpanded(tag.id)}
                className="p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            <span className="flex-1 text-sm text-slate-700">{tag.name}</span>
            {descendantCount > 0 && (
              <span className="text-xs text-slate-400">
                {descendantCount} 个子标签
              </span>
            )}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => openCreateModal(tag.id)}
                className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                title="添加子标签"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => openEditModal(tag)}
                className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                title="编辑"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(tag)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                title="删除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {hasChildren && isExpanded && (
            <div className="border-l border-slate-100 ml-5">
              {renderTagTree(tag.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="标签管理"
        description="创建和管理多级标签，用于分类和筛选文档、问答记录和评测任务"
        actions={
          <button
            onClick={() => openCreateModal(null)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建标签
          </button>
        }
      />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 text-slate-600">
            <FolderTree className="w-4 h-4" />
            <span className="text-sm font-medium">标签树形结构</span>
            <span className="text-xs text-slate-400 ml-2">
              共 {allTags.length} 个标签
            </span>
          </div>
        </div>
        <div className="p-2">
          {tags.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {renderTagTree(tags)}
            </div>
          ) : (
            <div className="py-12 text-center">
              <TagIcon className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">暂无标签</p>
              <p className="text-sm text-slate-400 mt-1">
                点击上方按钮创建您的第一个标签
              </p>
              <button
                onClick={() => openCreateModal(null)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-md hover:bg-primary-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                创建标签
              </button>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingTag ? "编辑标签" : "新建标签"}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  标签名称
                </label>
                <input
                  type="text"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="请输入标签名称"
                  maxLength={50}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoFocus
                />
                <p className="text-xs text-slate-400 mt-1">
                  {tagName.length}/50
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Palette className="w-4 h-4 inline mr-1" />
                  标签颜色
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setTagColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        tagColor === color
                          ? "border-slate-800 scale-110"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-slate-500">自定义:</span>
                  <input
                    type="color"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-slate-200"
                  />
                  <span className="text-xs text-slate-400 font-mono">
                    {tagColor}
                  </span>
                </div>
              </div>

              {!editingTag && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    父级标签
                  </label>
                  <select
                    value={parentTagId || ""}
                    onChange={(e) =>
                      setParentTagId(e.target.value || null)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">无（顶级标签）</option>
                    {allTags
                      .filter(
                        (t) =>
                          !editingTag ||
                          (editingTag && t.id !== editingTag.id)
                      )
                      .map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    选择父标签以创建多级标签结构
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  描述（可选）
                </label>
                <textarea
                  value={tagDescription}
                  onChange={(e) => setTagDescription(e.target.value)}
                  placeholder="标签用途说明"
                  maxLength={200}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {tagDescription.length}/200
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !tagName.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {loading ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    确认删除标签
                  </h3>
                  <p className="text-sm text-slate-500">此操作不可撤销</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: showDeleteConfirm.color }}
                  />
                  <span className="font-medium text-slate-700">
                    {showDeleteConfirm.name}
                  </span>
                </div>
                {showDeleteConfirm.description && (
                  <p className="text-sm text-slate-500 mt-2 ml-5">
                    {showDeleteConfirm.description}
                  </p>
                )}
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  删除此标签将同时删除其所有子标签，并且移除所有文档、问答记录和评测任务上关联的这些标签。
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={deletingId === showDeleteConfirm.id}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deletingId === showDeleteConfirm.id}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deletingId === showDeleteConfirm.id ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
