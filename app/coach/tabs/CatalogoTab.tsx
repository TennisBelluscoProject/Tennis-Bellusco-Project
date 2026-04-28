'use client';

import { GoalTemplateManager } from '@/components/GoalTemplateManager';

interface Props {
  coachId: string;
}

export function CatalogoTab({ coachId }: Props) {
  return (
    <div className="px-4 py-5 animate-fade-in">
      <GoalTemplateManager coachId={coachId} />
    </div>
  );
}
