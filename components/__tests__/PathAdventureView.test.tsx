/**
 * Smoke test della vista avventura (PathAdventureView).
 * Esegui con: npm test
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { PathAdventureView, type PathTreeData } from '@/components/PathAdventureView';

afterEach(cleanup);

const base: PathTreeData = {
  title: 'Fondamentali',
  difficulty: 'DELFINO',
  nodes: [
    { id: 'a', title: 'Impugnatura', category: 'tecnica', status: 'completed' },
    { id: 'b', title: 'Dritto', category: 'tecnica', status: 'in_progress', progress: 40, goalId: 'g-b' },
    { id: 'c', title: 'Rovescio', category: 'tecnica', status: 'planned', goalId: 'g-c' },
    { id: 'd', title: 'Scambio', category: 'tattica', status: 'planned', goalId: 'g-d' },
  ],
  edges: [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
    { from: 'c', to: 'd' },
  ],
};

describe('PathAdventureView', () => {
  it('renders nodes, labels and finish flag', () => {
    render(<PathAdventureView data={base} />);
    expect(screen.getByText('Fondamentali')).toBeTruthy();
    expect(screen.getByLabelText(/Tappa 1: Impugnatura/)).toBeTruthy();
    expect(screen.getByLabelText(/Tappa 4: Scambio/)).toBeTruthy();
    expect(screen.getByText('Traguardo')).toBeTruthy();
    expect(screen.getByText(/Avatar: Cucciolo/)).toBeTruthy();
  });

  it('opens the sheet and blocks locked nodes correctly', () => {
    render(<PathAdventureView data={base} />);
    fireEvent.click(screen.getByLabelText(/Tappa 3: Rovescio/));
    expect(screen.getByText(/Per sbloccare, completa prima/)).toBeTruthy();
    expect(screen.getByText('Dritto', { selector: 'li' })).toBeTruthy();
  });

  it('handles empty path (0 tappe)', () => {
    render(<PathAdventureView data={{ ...base, nodes: [], edges: [] }} />);
    expect(screen.getByText('Traguardo')).toBeTruthy();
  });

  it('single node path', () => {
    render(
      <PathAdventureView
        data={{ ...base, nodes: [{ id: 'x', title: 'Solo', category: 'mente', status: null }], edges: [] }}
        isPreview
      />
    );
    expect(screen.getByLabelText(/Tappa 1: Solo/)).toBeTruthy();
  });

  it('finished path shows trophy, next-level hint, tier Adulto', () => {
    const done: PathTreeData = {
      ...base,
      nodes: base.nodes.map((n) => ({ ...n, status: 'completed' as const })),
    };
    render(<PathAdventureView data={done} />);
    expect(screen.getAllByText('Percorso completato!').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/mondo Cerbiatto/)).toBeTruthy();
    expect(screen.getByText(/Avatar: Adulto/)).toBeTruthy();
  });

  it('COCCODRILLO finished has no next level', () => {
    const done: PathTreeData = {
      ...base,
      difficulty: 'COCCODRILLO',
      nodes: base.nodes.map((n) => ({ ...n, status: 'completed' as const })),
    };
    render(<PathAdventureView data={done} />);
    expect(screen.getByText(/raggiunto la vetta/)).toBeTruthy();
  });

  it('available node action', () => {
    const data: PathTreeData = {
      ...base,
      nodes: [
        { id: 'a', title: 'Impugnatura', category: 'tecnica', status: 'completed' },
        { id: 'b', title: 'Dritto', category: 'tecnica', status: 'planned', goalId: 'g-b' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    };
    let started = '';
    render(<PathAdventureView data={data} onStart={(id) => (started = id)} />);
    fireEvent.click(screen.getByLabelText(/Tappa 2: Dritto/));
    fireEvent.click(screen.getByText('Inizia la tappa'));
    expect(started).toBe('g-b');
  });
});
