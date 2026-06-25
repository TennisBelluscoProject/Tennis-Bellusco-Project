'use client';

/**
 * PathEditor — editor a FORM del percorso (lato maestro), v2.
 *
 * Il maestro aggiunge tappe (da catalogo goal_templates o personalizzate) e per
 * ciascuna sceglie i prerequisiti. Gli archi del DAG sono derivati: per ogni
 * prerequisito `p` della tappa `n` si crea l'arco p -> n.
 *
 * CICLI — due livelli di difesa, pensati per essere intuitivi:
 *   1. PREVENZIONE: un chip prerequisito che creerebbe un ciclo (cioe' una
 *      tappa che gia' DIPENDE, anche indirettamente, da quella corrente) e'
 *      disabilitato e marcato "creerebbe un giro" — il ciclo non si puo'
 *      proprio costruire dall'editor.
 *   2. VALIDAZIONE: se un ciclo esiste comunque (es. dati caricati), Kahn
 *      (`computePathState`) lo rileva, le tappe coinvolte vengono evidenziate
 *      e il salvataggio resta bloccato finche' non si rimuove un prerequisito.
 *
 * L'anteprima usa lo stesso layering topologico di PathTreeView (auto-layout).
 */

import { useEffect, useMemo, useState } from 'react';
import type { GoalCategory, GoalTemplate, Path, PlayerLevel } from '@/lib/database.types';
import { pathRepo } from '@/lib/repositories';
import { CATEGORY_CONFIG, LEVELS } from '@/lib/constants';
import { computePathState } from '@/lib/paths/topo';
import { Button, Input, Textarea, Select, Spinner, Badge } from './UI';
import { CategoryIcon } from './CategoryIcon';
import { GoalTemplatePicker } from './GoalTemplatePicker';
import { PathTreeView, type PathTreeData } from './PathTreeView';

interface NodeDraft {
  id: string;
  title: string;
  category: GoalCategory;
  description: string | null;
  goal_template_id: string | null;
  prereqs: string[]; // id delle tappe prerequisito
}

interface PathEditorProps {
  coachId: string;
  path: Path | null; // null = nuovo percorso
  onClose: () => void;
  onSaved: () => void;
}

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const categoryOptions = (
  Object.entries(CATEGORY_CONFIG) as [GoalCategory, (typeof CATEGORY_CONFIG)[GoalCategory]][]
).map(([k, v]) => ({ value: k, label: v.label }));

const levelOptions = LEVELS.map((lv) => ({ value: lv, label: lv }));

export function PathEditor({ coachId, path, onClose, onSaved }: PathEditorProps) {
  const [title, setTitle] = useState(path?.title ?? '');
  const [description, setDescription] = useState(path?.description ?? '');
  const [difficulty, setDifficulty] = useState<PlayerLevel>(path?.difficulty ?? 'CERBIATTO');
  const [nodes, setNodes] = useState<NodeDraft[]>([]);
  const [loading, setLoading] = useState(!!path);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);

  // form "nuova tappa personalizzata"
  const [nTitle, setNTitle] = useState('');
  const [nCategory, setNCategory] = useState<GoalCategory>('tecnica');
  const [nDesc, setNDesc] = useState('');

  // Carica il grafo esistente in modalita' modifica.
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    (async () => {
      const res = await pathRepo.getGraph(path.id);
      if (cancelled) return;
      const graph = res.data;
      if (graph) {
        const prereqMap = new Map<string, string[]>();
        for (const e of graph.edges) {
          const arr = prereqMap.get(e.to_node_id) ?? [];
          arr.push(e.from_node_id);
          prereqMap.set(e.to_node_id, arr);
        }
        setNodes(
          graph.nodes.map((n) => ({
            id: n.id,
            title: n.title,
            category: n.category,
            description: n.description,
            goal_template_id: n.goal_template_id,
            prereqs: prereqMap.get(n.id) ?? [],
          }))
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  // Archi derivati + stato topologico (Kahn): validazione + layering.
  const edges = useMemo(
    () => nodes.flatMap((n) => n.prereqs.map((p) => ({ from: p, to: n.id }))),
    [nodes]
  );
  const topo = useMemo(
    () => computePathState(nodes.map((n) => ({ id: n.id })), edges, new Set()),
    [nodes, edges]
  );
  const acyclic = topo.valid;

  // Tappe coinvolte in un eventuale ciclo: quelle che Kahn non riesce a
  // processare (non compaiono nell'ordine topologico parziale).
  const cycleIds = useMemo(() => {
    if (acyclic) return new Set<string>();
    const inOrder = new Set(topo.order);
    return new Set(nodes.filter((n) => !inOrder.has(n.id)).map((n) => n.id));
  }, [acyclic, topo.order, nodes]);

  // PREVENZIONE dei cicli: per ogni tappa n, l'insieme delle tappe che
  // dipendono da n (discendenti, anche indiretti). Sceglierne una come
  // prerequisito di n chiuderebbe un giro → il chip viene disabilitato.
  const descendants = useMemo(() => {
    const adj = new Map<string, string[]>();
    for (const n of nodes) adj.set(n.id, []);
    for (const e of edges) adj.get(e.from)?.push(e.to);
    const result = new Map<string, Set<string>>();
    for (const n of nodes) {
      const seen = new Set<string>();
      const stack = [n.id];
      while (stack.length) {
        const u = stack.pop()!;
        for (const v of adj.get(u) ?? []) {
          if (!seen.has(v)) {
            seen.add(v);
            stack.push(v);
          }
        }
      }
      result.set(n.id, seen);
    }
    return result;
  }, [nodes, edges]);

  const previewData: PathTreeData = useMemo(
    () => ({
      title: title || 'Anteprima percorso',
      difficulty,
      nodes: nodes.map((n) => ({
        id: n.id,
        title: n.title,
        category: n.category,
        description: n.description,
        status: null,
      })),
      edges,
    }),
    [nodes, edges, title, difficulty]
  );

  const addNode = (draft: Omit<NodeDraft, 'id' | 'prereqs'>) => {
    setNodes((prev) => [...prev, { ...draft, id: newId(), prereqs: [] }]);
  };

  const removeNode = (id: string) => {
    setNodes((prev) =>
      prev
        .filter((n) => n.id !== id)
        .map((n) => ({ ...n, prereqs: n.prereqs.filter((p) => p !== id) }))
    );
  };

  const togglePrereq = (nodeId: string, prereqId: string) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              prereqs: n.prereqs.includes(prereqId)
                ? n.prereqs.filter((p) => p !== prereqId)
                : [...n.prereqs, prereqId],
            }
          : n
      )
    );
  };

  const addCustom = () => {
    if (!nTitle.trim()) return;
    addNode({ title: nTitle.trim(), category: nCategory, description: nDesc.trim() || null, goal_template_id: null });
    setNTitle('');
    setNDesc('');
  };

  const addFromTemplate = (t: GoalTemplate) => {
    addNode({ title: t.title, category: t.category, description: t.description, goal_template_id: t.id });
    setShowCatalog(false);
  };

  const handleSave = async () => {
    setError(null);
    if (!title.trim()) return setError('Inserisci un titolo per il percorso.');
    if (nodes.length === 0) return setError('Aggiungi almeno una tappa al percorso.');
    if (!acyclic)
      return setError(
        'I prerequisiti formano un giro chiuso: rimuovi un prerequisito dalle tappe evidenziate in rosso.'
      );

    setSaving(true);
    try {
      let pathId = path?.id;
      if (path) {
        const res = await pathRepo.update(path.id, { title: title.trim(), description: description.trim() || null, difficulty });
        if (res.error) throw new Error(res.error.message);
      } else {
        const res = await pathRepo.create({ createdBy: coachId, data: { title: title.trim(), description: description.trim() || null, difficulty } });
        if (res.error || !res.data) throw new Error(res.error?.message ?? 'Creazione fallita');
        pathId = res.data.id;
      }

      const saveRes = await pathRepo.saveGraph(
        pathId!,
        nodes.map((n, i) => ({
          id: n.id,
          title: n.title,
          category: n.category,
          description: n.description,
          goal_template_id: n.goal_template_id,
          sort_order: i,
        })),
        edges
      );
      if (saveRes.error) throw new Error(saveRes.error.message);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore durante il salvataggio.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (showCatalog) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <GoalTemplatePicker
          defaultLevel={difficulty}
          onSelect={addFromTemplate}
          onBack={() => setShowCatalog(false)}
          onCreateCustom={() => setShowCatalog(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pb-3 border-b border-gray-100">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-500 hover:text-[var(--club-blue)] transition-colors group -ml-1 px-1 py-1 rounded-lg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-0.5 transition-transform">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Indietro
        </button>
        <span className="text-[13px] font-bold text-gray-900">
          {path ? 'Modifica percorso' : 'Nuovo percorso'}
        </span>
      </div>

      {/* Body scrollabile */}
      <div className="flex-1 min-h-0 overflow-y-auto py-4 flex flex-col gap-6">
        {/* 1 · Informazioni */}
        <section className="flex flex-col gap-3">
          <SectionTitle step={1} label="Informazioni" />
          <Input label="Titolo" value={title} onChange={setTitle} placeholder="Es. Fondamentali da fondo campo" required />
          <Textarea label="Descrizione" value={description} onChange={setDescription} placeholder="A cosa serve questo percorso..." rows={2} />
          <Select label="Difficoltà" value={difficulty} onChange={(v) => setDifficulty(v as PlayerLevel)} options={levelOptions} />
        </section>

        {/* 2 · Tappe e prerequisiti */}
        <section className="flex flex-col gap-2.5">
          <SectionTitle step={2} label={`Tappe del percorso (${nodes.length})`} />

          {/* Come funziona, in parole semplici */}
          <div className="flex items-start gap-2.5 text-[12px] leading-relaxed text-[var(--club-blue)] bg-[var(--club-blue-light)] border border-[var(--club-blue)]/10 rounded-xl px-3 py-2.5">
            <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              L&apos;allievo sblocca una tappa quando ha completato <b>tutti i suoi prerequisiti</b>;
              le tappe senza prerequisiti sono disponibili da subito. I prerequisiti non possono
              formare un giro chiuso (es. A richiede B e B richiede A): le scelte che lo
              creerebbero sono disabilitate automaticamente.
            </span>
          </div>

          {/* Avviso ciclo (possibile solo su dati pre-esistenti) */}
          {!acyclic && (
            <div className="flex items-start gap-2.5 text-[12px] leading-relaxed text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>
                <b>I prerequisiti formano un giro chiuso</b> tra:{' '}
                {nodes.filter((n) => cycleIds.has(n.id)).map((n) => `"${n.title}"`).join(', ')}.
                Togli un prerequisito da una di queste tappe (evidenziate in rosso) per poter salvare.
              </span>
            </div>
          )}

          {nodes.length === 0 && (
            <p className="text-[12px] text-gray-400">Nessuna tappa. Aggiungine una dal catalogo o personalizzata.</p>
          )}

          {nodes.map((n) => {
            const cat = CATEGORY_CONFIG[n.category];
            const others = nodes.filter((o) => o.id !== n.id);
            const inCycle = cycleIds.has(n.id);
            const forbidden = descendants.get(n.id) ?? new Set<string>();
            return (
              <div
                key={n.id}
                className={`rounded-xl border bg-white p-3 transition-colors ${
                  inCycle ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge color={cat.color} bg={cat.bg}>
                        <CategoryIcon name={cat.icon} size={11} /> {cat.label}
                      </Badge>
                      {acyclic && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold text-gray-400 bg-gray-100">
                          Livello {(topo.layer[n.id] ?? 0) + 1}
                        </span>
                      )}
                      {inCycle && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold text-red-600 bg-red-50">
                          Nel giro chiuso
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] font-bold text-gray-900 mt-1 leading-snug">{n.title}</p>
                  </div>
                  <button
                    onClick={() => removeNode(n.id)}
                    className="shrink-0 text-gray-300 hover:text-red-500 transition-colors p-1"
                    aria-label="Rimuovi tappa"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {others.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                      Da completare prima di questa tappa
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {others.map((o) => {
                        const sel = n.prereqs.includes(o.id);
                        const wouldCycle = !sel && forbidden.has(o.id);
                        if (wouldCycle) {
                          return (
                            <span
                              key={o.id}
                              title={`"${o.title}" dipende gia' da questa tappa: sceglierla come prerequisito creerebbe un giro chiuso.`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-dashed border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed select-none"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                                <rect x="3" y="11" width="18" height="11" rx="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                              </svg>
                              {o.title}
                              <span className="font-normal">· creerebbe un giro</span>
                            </span>
                          );
                        }
                        return (
                          <button
                            key={o.id}
                            onClick={() => togglePrereq(n.id, o.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                              sel
                                ? 'bg-[var(--club-blue)] text-white border-[var(--club-blue)]'
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {sel && '✓ '}
                            {o.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Aggiungi tappa */}
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-gray-700">Aggiungi tappa</span>
              <button onClick={() => setShowCatalog(true)} className="text-[12px] font-semibold text-[var(--club-blue)] hover:underline">
                Dal catalogo →
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <Input value={nTitle} onChange={setNTitle} placeholder="Titolo della tappa personalizzata" />
              <div className="flex gap-2">
                <Select value={nCategory} onChange={(v) => setNCategory(v as GoalCategory)} options={categoryOptions} className="flex-1" />
                <Button variant="secondary" onClick={addCustom} disabled={!nTitle.trim()}>Aggiungi</Button>
              </div>
              <Textarea value={nDesc} onChange={setNDesc} placeholder="Descrizione (opzionale)" rows={2} />
            </div>
          </div>
        </section>

        {/* 3 · Anteprima auto-layout */}
        {nodes.length > 0 && acyclic && (
          <section className="flex flex-col gap-2">
            <SectionTitle step={3} label="Anteprima (come la vedrà l'allievo)" />
            {/* Nessuna altezza fissa: l'anteprima cresce con il contenuto e
                scorre insieme al resto del form (niente scrollbar annidata). */}
            <div className="rounded-xl border border-gray-100 bg-[var(--background)] p-3">
              <PathTreeView data={previewData} isPreview />
            </div>
          </section>
        )}
      </div>

      {/* Footer azioni */}
      <div className="shrink-0 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
        {error ? (
          <p className="text-[12px] font-medium text-red-600 flex-1">{error}</p>
        ) : (
          <span className="flex-1" />
        )}
        <Button variant="ghost" onClick={onClose}>Annulla</Button>
        <Button variant="primary" onClick={handleSave} loading={saving} disabled={!acyclic}>
          {path ? 'Salva modifiche' : 'Crea percorso'}
        </Button>
      </div>
    </div>
  );
}

// ─── Titolo di sezione numerato ──────────────────────────────────────────────

function SectionTitle({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-5 h-5 rounded-md text-white text-[11px] font-bold flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'var(--club-blue)' }}
      >
        {step}
      </span>
      <span className="text-[13px] font-bold text-gray-900">{label}</span>
    </div>
  );
}
