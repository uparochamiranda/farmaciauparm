export default function Loading() {
  return (
    <main className="access-state" aria-busy="true">
      <div className="skeleton" style={{ width: 400, height: 80 }} />
      <p>Carregando a farmácia…</p>
    </main>
  );
}
