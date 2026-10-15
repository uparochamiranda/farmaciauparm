'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { demoData } from '@/lib/demo';
import type { Role } from '@/lib/domain/types';
export type Unit = {
  id: string;
  nome: string;
  sigla: string;
  dias_consumo: number;
  endereco: string;
};
export type Profile = { id: string; nome: string; perfil: Role };
type AppContextType = {
  demo: boolean;
  unit: Unit;
  profile: Profile;
  revision: number;
  refresh: () => void;
  mutate: (action: string, payload: Record<string, unknown>) => Promise<boolean>;
};
export const AppContext = createContext<AppContextType>(null!);
export const useApp = () => useContext(AppContext);
export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetch(url, options);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? 'Não foi possível concluir.');
  return data;
}
export function useData<T>(
  resource: string,
  params: Record<string, string | number | undefined> = {},
) {
  const { demo, unit, revision } = useApp();
  const key = JSON.stringify(params);
  const currentKey = resource + '|' + unit.id + '|' + revision + '|' + key;
  const [snapshot, setSnapshot] = useState<{ key: string; data: T | null; error: string }>({
    key: '',
    data: null,
    error: '',
  });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const p = new URLSearchParams({ resource, unit: unit.id });
    Object.entries(JSON.parse(key)).forEach(([k, v]) => {
      if (v !== undefined && v !== '') p.set(k, String(v));
    });
    const result = demo
      ? Promise.resolve(demoData(resource, p) as T)
      : request<T>('/api/data?' + p, { signal: controller.signal });
    result
      .then((data) => {
        if (active) setSnapshot({ key: currentKey, data, error: '' });
      })
      .catch((e) => {
        if (active && e.name !== 'AbortError')
          setSnapshot({ key: currentKey, data: null, error: e.message });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [resource, key, demo, unit.id, revision, currentKey]);
  const loading = snapshot.key !== currentKey;
  return { data: loading ? null : snapshot.data, loading, error: loading ? '' : snapshot.error };
}

export function useMutations(demo: boolean, unit: Unit, refresh: () => void) {
  return useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      if (demo) {
        toast.info('Demonstração: entre com sua conta para salvar alterações.');
        return false;
      }
      try {
        await request('/api/mutate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, payload: { unidade_id: unit.id, ...payload } }),
        });
        toast.success('Operação concluída com sucesso.');
        refresh();
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
        return false;
      }
    },
    [demo, unit.id, refresh],
  );
}
export function Empty({ text = 'Nenhum registro encontrado.' }: { text?: string }) {
  return (
    <div className="empty-state">
      <span>—</span>
      <p>{text}</p>
    </div>
  );
}
export function Loading() {
  return (
    <div className="table-loading" aria-label="Carregando" aria-busy="true">
      {[1, 2, 3, 4].map((n) => (
        <div className="skeleton" key={n} />
      ))}
    </div>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  return (
    <p role="alert" className="error-message">
      {message}
    </p>
  );
}
export function Pager({
  page,
  count,
  onChange,
}: {
  page: number;
  count: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {count ? page * 15 + 1 : 0}–{Math.min((page + 1) * 15, count)} de {count} registros
      </span>
      <div>
        <button disabled={page === 0} onClick={() => onChange(page - 1)}>
          Anterior
        </button>
        <span>
          {page + 1} / {Math.max(1, Math.ceil(count / 15))}
        </span>
        <button disabled={(page + 1) * 15 >= count} onClick={() => onChange(page + 1)}>
          Próxima
        </button>
      </div>
    </div>
  );
}
