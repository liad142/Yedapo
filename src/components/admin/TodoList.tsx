'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Copy, Trash2, Check, X, ListTodo, ChevronRight, ImagePlus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { elevation } from '@/lib/elevation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toast } from '@/components/ui/toast';
import type { AdminTodo, TodoStatus, TodoPriority } from '@/types/admin';

const STATUS_ORDER: TodoStatus[] = ['idea', 'planned', 'in_progress', 'done'];
const PRIORITY_ORDER: TodoPriority[] = ['low', 'medium', 'high'];

const STATUS_COLORS: Record<TodoStatus, string> = {
  idea: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  planned: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  done: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const PRIORITY_COLORS: Record<TodoPriority, string> = {
  low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  medium: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const STATUS_LABELS: Record<TodoStatus, string> = {
  idea: 'Idea',
  planned: 'Planned',
  in_progress: 'In Progress',
  done: 'Done',
};

const FILTER_TABS = ['all', ...STATUS_ORDER] as const;
type FilterTab = (typeof FILTER_TABS)[number];

function formatPrompt(todo: AdminTodo): string {
  return `I want to implement a new feature for Sumfi:

**Feature:** ${todo.title}

**Description:**
${todo.description || '(No description provided)'}

Please analyze the codebase and create a detailed implementation plan for this feature.`;
}

export function TodoList() {
  const [todos, setTodos] = useState<AdminTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingTodoId, setUploadingTodoId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editTitleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTodoIdRef = useRef<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setToastOpen(true);
    setTimeout(() => setToastOpen(false), 2500);
  }, []);

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/todos');
      if (res.ok) setTodos(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

  const addTodo = async () => {
    if (!newTitle.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetch('/api/admin/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (res.ok) {
        const todo: AdminTodo = await res.json();
        setTodos(prev => [todo, ...prev]);
        setNewTitle('');
        titleInputRef.current?.focus();
      }
    } finally {
      setAdding(false);
    }
  };

  const updateTodo = async (id: string, updates: Partial<AdminTodo>) => {
    const res = await fetch(`/api/admin/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated: AdminTodo = await res.json();
      setTodos(prev => prev.map(t => t.id === id ? updated : t));
      return updated;
    }
    return null;
  };

  const deleteTodo = async (id: string) => {
    const res = await fetch(`/api/admin/todos/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTodos(prev => prev.filter(t => t.id !== id));
      setDeletingId(null);
    }
  };

  const cycleStatus = (todo: AdminTodo) => {
    const idx = STATUS_ORDER.indexOf(todo.status);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    updateTodo(todo.id, { status: next });
  };

  const cyclePriority = (todo: AdminTodo) => {
    const idx = PRIORITY_ORDER.indexOf(todo.priority);
    const next = PRIORITY_ORDER[(idx + 1) % PRIORITY_ORDER.length];
    updateTodo(todo.id, { priority: next });
  };

  const copyPrompt = async (todo: AdminTodo) => {
    const prompt = formatPrompt(todo);
    await navigator.clipboard.writeText(prompt);
    await updateTodo(todo.id, { plan_prompt: prompt });
    showToast('Plan prompt copied to clipboard');
  };

  const startEdit = (todo: AdminTodo) => {
    setEditingId(todo.id);
    setEditTitle(todo.title);
    setEditDescription(todo.description);
    setTimeout(() => editTitleRef.current?.focus(), 0);
  };

  const saveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;
    await updateTodo(editingId, {
      title: editTitle.trim(),
      description: editDescription.trim(),
    });
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const triggerUpload = (todoId: string) => {
    uploadTodoIdRef.current = todoId;
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const todoId = uploadTodoIdRef.current;
    if (!files || files.length === 0 || !todoId) return;

    setUploadingTodoId(todoId);

    const formData = new FormData();
    for (const file of Array.from(files)) {
      formData.append('file', file);
    }

    try {
      const res = await fetch(`/api/admin/todos/${todoId}/images`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const updated: AdminTodo = await res.json();
        setTodos(prev => prev.map(t => t.id === todoId ? updated : t));
        showToast(`Uploaded ${files.length} image${files.length > 1 ? 's' : ''}`);
      } else {
        const err = await res.json();
        showToast(err.error || 'Upload failed');
      }
    } catch {
      showToast('Upload failed');
    } finally {
      setUploadingTodoId(null);
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteImage = async (todoId: string, url: string) => {
    const res = await fetch(`/api/admin/todos/${todoId}/images`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (res.ok) {
      const updated: AdminTodo = await res.json();
      setTodos(prev => prev.map(t => t.id === todoId ? updated : t));
      if (lightboxUrl === url) setLightboxUrl(null);
    }
  };

  const filtered = filter === 'all' ? todos : todos.filter(t => t.status === filter);

  return (
    <div className={cn(elevation.card, 'rounded-xl p-5')}>
      {/* Hidden file input shared by all todos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex items-center gap-2 mb-4">
        <ListTodo className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Todo List
        </h3>
      </div>

      {/* Add form */}
      <form
        onSubmit={e => { e.preventDefault(); addTodo(); }}
        className="flex gap-2 mb-4"
      >
        <Input
          ref={titleInputRef}
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="New feature idea..."
          className="flex-1"
        />
        <Button
          type="submit"
          variant="default"
          size="sm"
          disabled={!newTitle.trim() || adding}
          className="shrink-0"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </form>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {FILTER_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap',
              filter === tab
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
          >
            {tab === 'all' ? 'All' : STATUS_LABELS[tab]}
            {tab === 'all'
              ? ` (${todos.length})`
              : ` (${todos.filter(t => t.status === tab).length})`}
          </button>
        ))}
      </div>

      {/* Todo list */}
      <div className="space-y-2">
        {loading && todos.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {filter === 'all' ? 'No todos yet. Add one above!' : `No ${STATUS_LABELS[filter as TodoStatus].toLowerCase()} items`}
          </div>
        )}
        {filtered.map(todo => (
          <div
            key={todo.id}
            className={cn(
              elevation.card,
              'rounded-lg p-3 transition-all',
              todo.status === 'done' && 'opacity-60'
            )}
          >
            {editingId === todo.id ? (
              /* Editing mode */
              <div className="space-y-2">
                <Input
                  ref={editTitleRef}
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="text-sm"
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveEdit();
                    if (e.key === 'Escape') cancelEdit();
                  }}
                />
                <textarea
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder="Add a description..."
                  rows={3}
                  className={cn(
                    'w-full rounded-md px-3 py-2 text-sm resize-none',
                    elevation.input
                  )}
                  onKeyDown={e => {
                    if (e.key === 'Escape') cancelEdit();
                  }}
                />
                <div className="flex gap-1 justify-end">
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                    <X className="h-3.5 w-3.5 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" variant="default" onClick={saveEdit} disabled={!editTitle.trim()}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Save
                  </Button>
                </div>
              </div>
            ) : (
              /* Display mode */
              <>
                <div className="flex items-start gap-2">
                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
                    className="mt-0.5 p-0.5 rounded hover:bg-accent/50 transition-colors shrink-0"
                  >
                    <ChevronRight className={cn(
                      'h-3.5 w-3.5 text-muted-foreground transition-transform',
                      expandedId === todo.id && 'rotate-90'
                    )} />
                  </button>

                  {/* Title - click to edit */}
                  <button
                    onClick={() => startEdit(todo)}
                    className={cn(
                      'flex-1 text-left text-sm font-medium hover:text-primary transition-colors',
                      todo.status === 'done' && 'line-through'
                    )}
                  >
                    {todo.title}
                    {todo.images?.length > 0 && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">
                        ({todo.images.length} img)
                      </span>
                    )}
                  </button>

                  {/* Badges & actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      className={cn('cursor-pointer text-[10px] px-2 py-0.5', STATUS_COLORS[todo.status])}
                      onClick={() => cycleStatus(todo)}
                    >
                      {STATUS_LABELS[todo.status]}
                    </Badge>
                    <Badge
                      className={cn('cursor-pointer text-[10px] px-2 py-0.5', PRIORITY_COLORS[todo.priority])}
                      onClick={() => cyclePriority(todo)}
                    >
                      {todo.priority}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => copyPrompt(todo)}
                      title="Copy plan prompt"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {deletingId === todo.id ? (
                      <div className="flex items-center gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteTodo(todo.id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setDeletingId(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeletingId(todo.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded section: description + images */}
                {expandedId === todo.id && (
                  <div className="mt-2 ml-6 space-y-3">
                    {/* Description */}
                    {todo.description ? (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{todo.description}</p>
                    ) : (
                      <button
                        onClick={() => startEdit(todo)}
                        className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                      >
                        Click to add a description...
                      </button>
                    )}

                    {/* Image gallery */}
                    <div className="flex flex-wrap gap-2 items-start">
                      {(todo.images || []).map((url) => (
                        <div
                          key={url}
                          className="relative group rounded-md overflow-hidden border border-border/50"
                        >
                          <button
                            onClick={() => setLightboxUrl(url)}
                            className="block"
                          >
                            <img
                              src={url}
                              alt=""
                              className="h-20 w-20 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            />
                          </button>
                          <button
                            onClick={() => deleteImage(todo.id, url)}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}

                      {/* Upload button */}
                      <button
                        onClick={() => triggerUpload(todo.id)}
                        disabled={uploadingTodoId === todo.id}
                        className={cn(
                          'h-20 w-20 rounded-md border border-dashed border-border/50 flex items-center justify-center',
                          'text-muted-foreground/50 hover:text-muted-foreground hover:border-border transition-colors',
                          uploadingTodoId === todo.id && 'pointer-events-none'
                        )}
                        title="Upload images"
                      >
                        {uploadingTodoId === todo.id ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <ImagePlus className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox overlay */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      <Toast open={toastOpen} onOpenChange={setToastOpen}>
        <p className="text-sm font-medium">{toastMessage}</p>
      </Toast>
    </div>
  );
}
