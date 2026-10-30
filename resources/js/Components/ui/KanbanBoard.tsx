import React, { useState, useCallback } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { router } from '@inertiajs/react';
import {
  Clock,
  Sparkles,
  Shield,
  CheckCircle2,
  XCircle,
  GripVertical,
  ExternalLink,
  FolderGit2,
} from 'lucide-react';

/* ────────────────────────────────────────────── types ── */

export interface KanbanTask {
  id: number;
  key: string;
  repository: string;
  issueNumber: number;
  issueUrl: string | null;
  title: string;
  path: string;
  status: 'queued' | 'in_progress' | 'needs_review' | 'completed' | 'failed' | 'publishing' | 'outcome_unknown';
  provenance: string | null;
  isDedicated: boolean;
  isSynthetic: boolean;
  isOfflineExample: boolean;
  isSimulated: boolean;
  verificationDecision: string | null;
  model?: string | null;
  publishedPrNumber: number | null;
  publishedPrUrl: string | null;
  publishedBranch: string | null;
  updatedAt: string;
}

interface Column {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  tasks: KanbanTask[];
}

interface KanbanBoardProps {
  tasks: KanbanTask[];
  activeTaskId?: number | null;
  onSelectTask?: (task: KanbanTask) => void;
}

/* ────────────────────────────────────────────── status badge helpers ── */

function statusBadge(task: KanbanTask) {
  if (task.isSimulated && task.status === 'needs_review') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        Simulated
      </span>
    );
  }
  if (!task.isSimulated && task.verificationDecision === 'VERIFIED') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3" /> Verified
      </span>
    );
  }
  if (task.publishedPrNumber) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">
        PR #{task.publishedPrNumber}
      </span>
    );
  }
  if (task.status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        <XCircle className="w-3 h-3" /> Failed
      </span>
    );
  }
  return null;
}

/* ────────────────────────────────────────────── card animation ── */

const cardVariants: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 25 } },
  exit: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.2 } },
};

const columnVariants: Variants = {
  initial: { opacity: 0, y: 30 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, type: 'spring' as const, stiffness: 260, damping: 24 },
  }),
};

/* ────────────────────────────────────────────── draggable card ── */

function TaskCard({
  task,
  index,
  isActive,
  onSelect,
}: {
  task: KanbanTask;
  index: number;
  isActive: boolean;
  onSelect?: (t: KanbanTask) => void;
}) {
  return (
    <Draggable draggableId={String(task.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`group rounded-xl border p-3 space-y-2 transition-all duration-200 cursor-pointer select-none ${
            snapshot.isDragging
              ? 'shadow-xl ring-2 ring-violet-400/50 border-violet-300 bg-white scale-[1.02] rotate-[1deg]'
              : isActive
              ? 'border-violet-400 bg-violet-50/50 ring-1 ring-violet-300 shadow-md'
              : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-md shadow-sm'
          }`}
          onClick={() => onSelect?.(task)}
        >
          {/* Drag handle + header */}
          <div className="flex items-start gap-2">
            <div
              {...provided.dragHandleProps}
              className="mt-0.5 p-0.5 rounded text-slate-300 hover:text-slate-500 transition opacity-0 group-hover:opacity-100"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/60 truncate">
                  #{task.issueNumber}
                </span>
                {isActive && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-[9px] font-bold uppercase tracking-wider text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-md"
                  >
                    Active
                  </motion.span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-900 line-clamp-2 leading-snug">{task.title}</p>
            </div>
          </div>

          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-1 pl-6">
            <span className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100 truncate max-w-[140px]">
              <FolderGit2 className="w-2.5 h-2.5 text-slate-400 shrink-0" />
              {task.repository.split('/')[1] || task.repository}
            </span>
            {task.model && (
              <span className="text-[9px] font-medium text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded-md border border-violet-100">
                {task.model}
              </span>
            )}
            {task.isDedicated && (
              <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">
                Test Repo
              </span>
            )}
            {task.isOfflineExample && (
              <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/60">
                Offline
              </span>
            )}
            {statusBadge(task)}
          </div>

          {/* PR Link */}
          {task.publishedPrUrl && (
            <a
              href={task.publishedPrUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[10px] font-medium text-violet-600 hover:text-violet-800 pl-6"
            >
              <ExternalLink className="w-3 h-3" />
              View Draft PR
            </a>
          )}
        </div>
      )}
    </Draggable>
  );
}

/* ────────────────────────────────────────────── main board ── */

export function KanbanBoard({ tasks, activeTaskId, onSelectTask }: KanbanBoardProps) {
  const [localTasks, setLocalTasks] = useState(tasks);

  // Sync with server props
  React.useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const columns: Column[] = [
    {
      id: 'queued',
      title: 'Queued',
      icon: <Clock className="w-3.5 h-3.5" />,
      color: 'text-slate-700',
      bgColor: 'bg-slate-50/70',
      borderColor: 'border-slate-200/80',
      dotColor: 'bg-slate-400',
      tasks: localTasks.filter((t) => t.status === 'queued'),
    },
    {
      id: 'in_progress',
      title: 'In Progress',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      color: 'text-violet-700',
      bgColor: 'bg-violet-50/40',
      borderColor: 'border-violet-200/60',
      dotColor: 'bg-violet-500',
      tasks: localTasks.filter((t) => t.status === 'in_progress' || t.status === 'publishing'),
    },
    {
      id: 'needs_review',
      title: 'Needs Review',
      icon: <Shield className="w-3.5 h-3.5" />,
      color: 'text-amber-700',
      bgColor: 'bg-amber-50/40',
      borderColor: 'border-amber-200/60',
      dotColor: 'bg-amber-500',
      tasks: localTasks.filter((t) => t.status === 'needs_review'),
    },
    {
      id: 'completed',
      title: 'Completed',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50/40',
      borderColor: 'border-emerald-200/60',
      dotColor: 'bg-emerald-500',
      tasks: localTasks.filter((t) => t.status === 'completed'),
    },
  ];

  const failedTasks = localTasks.filter((t) => t.status === 'failed' || t.status === 'outcome_unknown');

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      const { source, destination, draggableId } = result;
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;

      // Server-authoritative status transitions are complex; the drag provides visual feedback
      // and we post the intent to the server. The board updates optimistically, but server
      // props always win on next render.
      const taskId = parseInt(draggableId, 10);
      const task = localTasks.find((t) => t.id === taskId);
      if (!task) return;

      // For now, only allow selecting/switching tasks by drag — the server controls status.
      // A drag from one column to the same column reorders visually.
      if (source.droppableId !== destination.droppableId) {
        router.post('/issues/switch-task', { task_id: taskId }, { preserveScroll: true });
      }
    },
    [localTasks]
  );

  return (
    <div className="space-y-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map((col, colIndex) => (
            <motion.div
              key={col.id}
              custom={colIndex}
              variants={columnVariants}
              initial="initial"
              animate="animate"
              className={`rounded-2xl border ${col.borderColor} ${col.bgColor} p-3 space-y-3 min-h-[200px]`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-1">
                <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${col.color}`}>
                  <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                  {col.icon}
                  <span>{col.title}</span>
                </div>
                <span className={`text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full ${col.bgColor} ${col.color} border ${col.borderColor}`}>
                  {col.tasks.length}
                </span>
              </div>

              {/* Droppable area */}
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-2.5 min-h-[120px] rounded-xl transition-colors duration-200 p-1 ${
                      snapshot.isDraggingOver ? 'bg-violet-100/40 ring-2 ring-violet-300/30 ring-inset' : ''
                    }`}
                  >
                    <AnimatePresence mode="popLayout">
                      {col.tasks.length > 0 ? (
                        col.tasks.map((task, index) => (
                          <motion.div
                            key={task.id}
                            variants={cardVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            layout
                          >
                            <TaskCard
                              task={task}
                              index={index}
                              isActive={task.id === activeTaskId}
                              onSelect={onSelectTask}
                            />
                          </motion.div>
                        ))
                      ) : (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col items-center justify-center py-8 text-center"
                        >
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-2">
                            {col.icon}
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium">No tasks</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </motion.div>
          ))}
        </div>
      </DragDropContext>

      {/* Failed tasks drawer */}
      <AnimatePresence>
        {failedTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-rose-200/60 bg-rose-50/30 p-4 space-y-3">
              <div className="flex items-center gap-2 px-1">
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                  Failed ({failedTasks.length})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {failedTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    variants={cardVariants}
                    initial="initial"
                    animate="animate"
                    className="rounded-xl border border-rose-200 bg-white p-3 space-y-1.5 cursor-pointer hover:shadow-md transition"
                    onClick={() => onSelectTask?.(task)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200">
                        #{task.issueNumber}
                      </span>
                      <span className="text-[10px] font-semibold text-rose-600">{task.verificationDecision || 'FAILED'}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-900 line-clamp-2">{task.title}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
