import { useState, useEffect, useRef } from "react";
import { Plus, ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { api } from "@/lib/api";
import TagBadge from "./TagBadge";
import type { Tag } from "../../shared/types";

interface TagSelectorProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  showColor?: boolean;
}

interface TagWithChildren extends Tag {
  children: TagWithChildren[];
}

export default function TagSelector({
  selectedTagIds,
  onChange,
  placeholder = "选择标签",
  disabled = false,
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tags, setTags] = useState<TagWithChildren[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [searchText, setSearchText] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
      console.error("加载标签失败:", e);
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

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const removeTag = (tagId: string) => {
    onChange(selectedTagIds.filter((id) => id !== tagId));
  };

  const selectedTags = allTags.filter((t) => selectedTagIds.includes(t.id));

  const filteredTags = searchText
    ? allTags.filter((t) =>
        t.name.toLowerCase().includes(searchText.toLowerCase())
      )
    : [];

  const renderTagTree = (tagList: TagWithChildren[], depth = 0) => {
    return tagList.map((tag) => {
      const hasChildren = tag.children && tag.children.length > 0;
      const isExpanded = expandedIds.has(tag.id);
      const isSelected = selectedTagIds.includes(tag.id);

      return (
        <div key={tag.id}>
          <div
            className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-100 transition-colors ${
              isSelected ? "bg-primary-50" : ""
            }`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(tag.id);
                }}
                className="p-0.5 text-slate-400 hover:text-slate-600"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-4.5" />
            )}
            <label className="flex items-center gap-2 flex-1 cursor-pointer">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleTag(tag.id)}
                className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              <span className="text-sm text-slate-700 truncate">
                {tag.name}
              </span>
            </label>
          </div>
          {hasChildren && isExpanded && (
            <div>{renderTagTree(tag.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  const renderFlatList = (tagList: Tag[]) => {
    return tagList.map((tag) => {
      const isSelected = selectedTagIds.includes(tag.id);
      return (
        <div
          key={tag.id}
          className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-100 transition-colors ${
            isSelected ? "bg-primary-50" : ""
          }`}
          onClick={() => toggleTag(tag.id)}
        >
          <label className="flex items-center gap-2 flex-1 cursor-pointer">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleTag(tag.id)}
              className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: tag.color }}
            />
            <span className="text-sm text-slate-700 truncate">
              {tag.name}
            </span>
          </label>
        </div>
      );
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`min-h-[38px] px-3 py-1.5 border rounded-md bg-white cursor-pointer flex flex-wrap gap-1.5 items-center ${
          disabled
            ? "bg-slate-50 cursor-not-allowed border-slate-200"
            : "border-slate-300 hover:border-slate-400"
        }`}
      >
        {selectedTags.length > 0 ? (
          selectedTags.map((tag) => (
            <TagBadge
              key={tag.id}
              tag={tag}
              size="sm"
              onRemove={() => removeTag(tag.id)}
            />
          ))
        ) : (
          <span className="text-slate-400 text-sm">{placeholder}</span>
        )}
        <div className="ml-auto">
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="搜索标签..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
              />
              {searchText && (
                <button
                  onClick={() => setSearchText("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {searchText ? (
              filteredTags.length > 0 ? (
                renderFlatList(filteredTags)
              ) : (
                <div className="py-6 text-center text-slate-400 text-sm">
                  未找到匹配的标签
                </div>
              )
            ) : tags.length > 0 ? (
              renderTagTree(tags)
            ) : (
              <div className="py-6 text-center text-slate-400 text-sm">
                暂无标签，请先创建标签
              </div>
            )}
          </div>
          <div className="p-2 border-t border-slate-100 bg-slate-50">
            <button
              onClick={() => onChange([])}
              disabled={selectedTagIds.length === 0}
              className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              清空选择
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
