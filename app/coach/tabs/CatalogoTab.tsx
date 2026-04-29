'use client';

import { GoalTemplateManager } from '@/components/GoalTemplateManager';

interface Props {
  coachId: string;
}

export function CatalogoTab({ coachId }: Props) {
  return (
    <div className="flex flex-col h-full animate-fade-in">
      <GoalTemplateManager coachId={coachId} />
    </div>
  );
}
