'use client';

import { useDroppable } from '@dnd-kit/core';

export function TrashZone() {
  const { isOver, setNodeRef } = useDroppable({
    id: 'trash-zone',
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        fixed top-32 right-8 w-20 h-20 rounded-full
        flex items-center justify-center
        transition-all duration-300 shadow-2xl backdrop-blur-sm
        border-2 z-40
        ${
          isOver
            ? 'bg-red-600 scale-125 rotate-12 shadow-red-500/50 border-red-400 animate-pulse'
            : 'bg-gray-800/80 hover:bg-gray-700 hover:scale-110 border-gray-600 hover:border-red-500/50'
        }
      `}
      title="Drag gate here to delete"
    >
      <svg
        className="w-10 h-10 text-white"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
    </div>
  );
}
