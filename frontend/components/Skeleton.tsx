import React from "react";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-white/5 rounded-xl ${className || ""}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="p-6 rounded-2xl glass-panel border border-white/5 space-y-4">
      <Skeleton className="w-24 h-4" />
      <Skeleton className="w-16 h-8" />
      <Skeleton className="w-full h-2" />
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 gap-4">
      <div className="flex items-center gap-3 flex-grow">
        <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
        <div className="space-y-2 flex-grow max-w-[200px]">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
      <Skeleton className="w-16 h-4 flex-shrink-0" />
      <Skeleton className="w-20 h-6 rounded-full flex-shrink-0" />
      <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="p-6 rounded-3xl glass-panel border border-white/5 space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="w-32 h-5" />
          <Skeleton className="w-48 h-3" />
        </div>
        <Skeleton className="w-20 h-8 rounded-xl" />
      </div>
      <div className="h-[200px] flex items-end justify-between gap-2 pt-6">
        <Skeleton className="w-[10%] h-[30%]" />
        <Skeleton className="w-[10%] h-[55%]" />
        <Skeleton className="w-[10%] h-[40%]" />
        <Skeleton className="w-[10%] h-[75%]" />
        <Skeleton className="w-[10%] h-[50%]" />
        <Skeleton className="w-[10%] h-[90%]" />
        <Skeleton className="w-[10%] h-[65%]" />
      </div>
    </div>
  );
}
