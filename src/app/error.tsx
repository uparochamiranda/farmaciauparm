'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="access-state">
      <h1>Não foi possível carregar o painel</h1>
      <p>Verifique sua conexão e tente novamente.</p>
      <button className="button button-primary" onClick={reset}>
        Tentar novamente
      </button>
    </main>
  );
}
