'use client';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { number } from '@/lib/utils';
import { situationLabels } from '@/lib/domain/stock';
export const colors: Record<string, string> = {
  CRITICO: '#ed3347',
  ATENCAO: '#f5a01b',
  NORMAL: '#279f59',
  ZERADO: '#8b929b',
  SEM_CONSUMO: '#9264bd',
};
export function TrendChart({
  rows,
  dataKey = 'quantidade',
}: {
  rows: Record<string, unknown>[];
  dataKey?: string;
}) {
  if (!rows.length)
    return (
      <div className="chart-empty">O gráfico aparecerá após a primeira importação confirmada.</div>
    );
  const data = rows.map((r) => ({
    ...r,
    label: new Date(String(r.created_at)).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }),
  }));
  return (
    <div className="trend-chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1684ee" stopOpacity={0.23} />
              <stop offset="100%" stopColor="#1684ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e3eaf3" vertical />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#657994' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 10, fill: '#657994' }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v) => [number(Number(v), 1), 'Estoque']}
            contentStyle={{ borderRadius: 8, border: '1px solid #dce5f0', fontSize: 12 }}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey={dataKey}
            stroke="#087df2"
            strokeWidth={2}
            fill="url(#stockGradient)"
            dot={{ r: 3, fill: '#087df2', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function StatusChart({ stats }: { stats: Record<string, number> }) {
  const data = Object.entries(situationLabels).map(([key, name]) => ({
      key,
      name,
      value: stats[key] ?? 0,
    })),
    total = stats.total ?? 0;
  return (
    <div className="status-chart">
      <div className="donut">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie
              isAnimationActive={false}
              data={total ? data : [{ key: 'ZERADO', name: 'Sem dados', value: 1 }]}
              dataKey="value"
              innerRadius="62%"
              outerRadius="91%"
              stroke="#fff"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
            >
              {(total ? data : [{ key: 'ZERADO' }]).map((d) => (
                <Cell key={d.key} fill={colors[d.key]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-label">
          <strong>{number(total)}</strong>
          <span>produtos</span>
        </div>
      </div>
      <div className="chart-legend">
        {data.map((d) => (
          <div key={d.key}>
            <span>
              <i style={{ background: colors[d.key] }} />
              {d.name}
            </span>
            <span>
              {number(d.value)} <small>({total ? number((d.value / total) * 100, 1) : 0}%)</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
export function DetailChart({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={[...rows]
            .reverse()
            .map((r) => ({
              ...r,
              data: new Date(String(r.created_at)).toLocaleDateString('pt-BR'),
            }))}
        >
          <CartesianGrid stroke="#e3eaf3" />
          <XAxis dataKey="data" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line dataKey="quantidade" name="Estoque" stroke="#087df2" />
          <Line dataKey="dias_cobertura" name="Cobertura (dias)" stroke="#20a362" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
