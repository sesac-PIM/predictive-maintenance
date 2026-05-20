import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

type ApiPlant = {
  plantId: number;
  plantName: string;
  location?: string;
  latitude?: number;
  longitude?: number;
};

type ApiEquipment = {
  equipmentId: number;
  equipmentName?: string;
  equipmentname?: string;
  equipmentType: 'MOTOR' | 'TUBE' | string;
  status?: string;
  unitNo?: number;
};

type ApiAnomaly = {
  anomalyResultId: number;
  equipmentId?: number;
  measuredAt?: string;
  anomalyScore?: number;
  severity?: 'NORMAL' | 'WARNING' | 'DANGER' | string;
  eventType?: string;
  description?: string;
};

type ApiContribution = {
  sensorTag: string;
  displayName?: string;
  sensorValue?: number;
  contributionScore?: number;
  contributionRank?: number;
};

type ApiAlert = {
  alertId?: number;
  equipmentId?: number;
  anomalyResultId?: number;
  anomalyResultType?: string;
  occurredAt?: string;
  severity?: string;
  message?: string;
  channel?: string;
  sendStatus?: string;
};

type ApiSensorRow = {
  sensorTag?: string;
  tag?: string;
  displayName?: string;
  measuredAt?: string;
  timestamp?: string;
  value?: number;
  sensorValue?: number;
  unit?: string;
  status?: string;
  [key: string]: unknown;
};

type ApiThreshold = {
  sensorTag?: string;
  tag?: string;
  minValue?: number;
  maxValue?: number;
  warningMin?: number;
  warningMax?: number;
  dangerMin?: number;
  dangerMax?: number;
  [key: string]: unknown;
};

type View = 'login' | 'dashboard' | 'plant' | 'equipment';
type ComponentType = 'gasifier' | 'motor';
type Severity = 'NORMAL' | 'WARNING' | 'DANGER';

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token && !path.startsWith('/api/auth/')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `API request failed: ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

function reportApiError(context: string, error: unknown) {
  console.error(`[API] ${context}`, error);
}

function normalizeSeverity(score?: number, severity?: string): Severity {
  const upper = severity?.toUpperCase();
  if (upper === 'DANGER' || upper === 'WARNING' || upper === 'NORMAL') return upper;
  if (score == null) return 'NORMAL';
  if (score >= 0.9) return 'DANGER';
  if (score >= 0.7) return 'WARNING';
  return 'NORMAL';
}

function formatTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR', { hour12: false });
}

function formatShortTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('ko-KR', { hour12: false });
}

function equipmentName(equipment?: ApiEquipment) {
  if (!equipment) return '-';
  return equipment.equipmentName || equipment.equipmentname || `${equipment.unitNo ?? '-'}호기 ${equipment.equipmentType}`;
}

function sensorTag(row: ApiSensorRow | ApiThreshold | ApiContribution) {
  return 'sensorTag' in row ? row.sensorTag || ('tag' in row ? row.tag : '') || '' : '';
}

function sensorValue(row?: ApiSensorRow | ApiContribution) {
  if (!row) return undefined;
  if ('sensorValue' in row && typeof row.sensorValue === 'number') return row.sensorValue;
  if ('value' in row && typeof row.value === 'number') return row.value;
  return undefined;
}

function sortAnomaliesDesc(items: ApiAnomaly[]) {
  return [...items].sort((a, b) => {
    const aTime = a.measuredAt ? new Date(a.measuredAt).getTime() : 0;
    const bTime = b.measuredAt ? new Date(b.measuredAt).getTime() : 0;
    return bTime - aTime;
  });
}

function latestSensorItems(rows: ApiSensorRow[]) {
  const latest = [...rows].sort((a, b) => {
    const aTime = a.measuredAt ? new Date(a.measuredAt).getTime() : 0;
    const bTime = b.measuredAt ? new Date(b.measuredAt).getTime() : 0;
    return bTime - aTime;
  })[0];
  if (!latest) return [];
  if (sensorTag(latest) && sensorValue(latest) != null) return rows;

  return Object.entries(latest)
    .filter(([key, value]) => (
      typeof value === 'number' &&
      !key.toLowerCase().includes('id')
    ))
    .map(([key, value]) => ({
      sensorTag: key,
      displayName: key,
      measuredAt: latest.measuredAt,
      value: value as number,
    }));
}

function severityStyle(severity: string) {
  const normalized = normalizeSeverity(undefined, severity);
  if (normalized === 'DANGER') {
    return {
      label: 'DANGER',
      text: 'text-red-300',
      dot: 'bg-red-400',
      border: 'border-red-400/25 shadow-[0_0_14px_rgba(248,113,113,0.12)]',
      bar: '#f87171',
    };
  }
  if (normalized === 'WARNING') {
    return {
      label: 'WARNING',
      text: 'text-yellow-300',
      dot: 'bg-yellow-300',
      border: 'border-yellow-300/25 shadow-[0_0_14px_rgba(253,224,71,0.10)]',
      bar: '#fde047',
    };
  }
  return {
    label: 'NORMAL',
    text: 'text-sky-300',
    dot: 'bg-sky-300',
    border: 'border-sky-300/20 shadow-[0_0_12px_rgba(125,211,252,0.08)]',
    bar: '#7dd3fc',
  };
}

function sortedUnits(equipments: ApiEquipment[]) {
  return Array.from(new Set(equipments.map(e => e.unitNo).filter((unit): unit is number => typeof unit === 'number'))).sort((a, b) => a - b);
}

function latestByEquipment(anomalies: Record<number, ApiAnomaly[]>, equipment?: ApiEquipment) {
  return equipment ? anomalies[equipment.equipmentId]?.[0] : undefined;
}

function buildChartData(anomalies: ApiAnomaly[]) {
  return [...anomalies].reverse().map((item, index) => ({
    label: item.measuredAt ? formatShortTime(item.measuredAt) : `${index + 1}`,
    score: Number(item.anomalyScore ?? 0),
  }));
}

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] p-8 text-center text-sm text-gray-500">
    <span className="material-symbols-outlined mb-3 text-4xl opacity-50">info</span>
    {message}
  </div>
);

const HeaderActions = () => {
  const [alerts, setAlerts] = useState<ApiAlert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    apiRequest<ApiAlert[]>('/api/alerts')
      .then(setAlerts)
      .catch(error => {
        reportApiError('GET /api/alerts', error);
        setAlerts([]);
      });
  }, []);

  const applyTheme = (nextTheme: 'dark' | 'light') => {
    setTheme(nextTheme);
    document.documentElement.classList.toggle('light-mode', nextTheme === 'light');
  };

  return (
    <div className="relative flex items-center gap-2">
      <div className="relative">
        <button
          className="relative rounded-lg p-2 transition-colors hover:bg-white/5"
          onClick={() => {
            setShowAlerts(value => !value);
            setShowSettings(false);
            setShowProfile(false);
          }}
          title="알림"
        >
          <span className="material-symbols-outlined text-[#38bdf8]">notifications</span>
          {alerts.length > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
        </button>
        <AnimatePresence>
          {showAlerts && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 top-12 z-[100] w-80 overflow-hidden rounded-lg border border-gray-800 bg-[#0f1418] shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-white">알림</p>
                  <p className="text-[10px] text-gray-500">Backend API 기준</p>
                </div>
                <span className="rounded bg-[#38bdf8]/10 px-2 py-1 text-[10px] font-bold text-[#38bdf8]">{alerts.length}</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {alerts.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-gray-500">표시할 알림이 없습니다.</div>
                ) : (
                  alerts.slice(0, 10).map((alert, index) => {
                    const style = severityStyle(alert.severity || 'NORMAL');
                    return (
                      <div key={alert.alertId ?? index} className="border-b border-gray-800/50 px-4 py-3">
                        <div className="mb-1 flex justify-between gap-3">
                          <span className={`text-[10px] font-bold ${style.text}`}>{style.label}</span>
                          <span className="font-mono text-[10px] text-gray-500">{formatShortTime(alert.occurredAt)}</span>
                        </div>
                        <p className="text-xs font-bold text-white">{alert.channel || '알림'}</p>
                        <p className="mt-1 text-[11px] text-gray-400">{alert.message || '알림 메시지가 없습니다.'}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative">
        <button
          className="rounded-lg p-2 transition-colors hover:bg-white/5"
          onClick={() => {
            setShowSettings(value => !value);
            setShowAlerts(false);
            setShowProfile(false);
          }}
          title="설정"
        >
          <span className="material-symbols-outlined text-[#38bdf8]">settings</span>
        </button>
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 top-12 z-[100] w-48 rounded-lg border border-gray-800 bg-[#0f1418] p-2 shadow-2xl">
              {(['dark', 'light'] as const).map(item => (
                <button key={item} onClick={() => applyTheme(item)} className={`flex w-full items-center justify-between rounded px-3 py-2 text-xs ${theme === item ? 'bg-[#38bdf8]/10 text-[#38bdf8]' : 'text-gray-300 hover:bg-white/5'}`}>
                  <span>{item === 'dark' ? '다크 모드' : '라이트 모드'}</span>
                  {theme === item && <span className="material-symbols-outlined text-sm">check</span>}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#38bdf8]/30 bg-[#38bdf8]/10 text-[#38bdf8] transition-colors hover:bg-[#38bdf8]/20"
          onClick={() => {
            setShowProfile(value => !value);
            setShowAlerts(false);
            setShowSettings(false);
          }}
          title="프로필"
        >
          <span className="material-symbols-outlined text-[20px]">account_circle</span>
        </button>
        <AnimatePresence>
          {showProfile && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 top-12 z-[100] w-56 rounded-lg border border-gray-800 bg-[#0f1418] p-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#38bdf8]/30 bg-[#38bdf8]/10 text-[#38bdf8]">
                  <span className="material-symbols-outlined text-[20px]">account_circle</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">관리자</p>
                  <p className="mt-1 text-[11px] text-gray-400">운영 관리자</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const AppHeader = ({ title, onBack }: { title: string; onBack?: () => void }) => (
  <header className="flex h-16 w-full shrink-0 items-center justify-between border-b border-outline-variant bg-surface px-margin">
    <div className="flex items-center gap-4">
      {onBack && (
        <button onClick={onBack} className="rounded-lg p-2 transition-colors hover:bg-surface-container-highest">
          <span className="material-symbols-outlined">grid_view</span>
        </button>
      )}
      <span className="font-display-lg text-headline-md font-bold uppercase tracking-wider text-primary-container">KOWEPO</span>
      <div className="h-6 w-px bg-outline-variant" />
      <span className="text-title-sm font-semibold text-on-surface">{title}</span>
    </div>
    <HeaderActions />
  </header>
);

const LoginPage = ({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  return (
    <div className="flex h-screen items-center justify-center bg-background text-on-surface">
      <form
        className="w-full max-w-sm rounded-lg border border-outline-variant bg-surface-container-low p-8 shadow-2xl"
        onSubmit={async event => {
          event.preventDefault();
          setError('');
          try {
            await onLogin(username, password);
          } catch {
            setError('로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요.');
          }
        }}
      >
        <h1 className="mb-2 text-2xl font-bold text-primary-container">KOWEPO</h1>
        <p className="mb-6 text-sm text-on-surface-variant">예지보전 대시보드</p>
        <label className="mb-4 block">
          <span className="mb-2 block text-xs font-bold text-on-surface-variant">아이디</span>
          <input className="w-full rounded border border-outline-variant bg-background px-3 py-3 text-sm outline-none focus:border-primary" value={username} onChange={event => setUsername(event.target.value)} />
        </label>
        <label className="mb-5 block">
          <span className="mb-2 block text-xs font-bold text-on-surface-variant">비밀번호</span>
          <input className="w-full rounded border border-outline-variant bg-background px-3 py-3 text-sm outline-none focus:border-primary" type="password" value={password} onChange={event => setPassword(event.target.value)} />
        </label>
        {error && <p className="mb-4 text-center text-xs text-red-400">{error}</p>}
        <button className="w-full rounded bg-primary-container py-3 font-bold text-on-primary-container transition-all hover:brightness-105" type="submit">
          로그인
        </button>
      </form>
    </div>
  );
};

const DashboardPage = ({ onOpenPlant }: { onOpenPlant: (plantId: string) => void }) => {
  const [plants, setPlants] = useState<ApiPlant[]>([]);
  const [equipmentCounts, setEquipmentCounts] = useState<Record<number, number>>({});
  const [selectedPlantId, setSelectedPlantId] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<ApiPlant[]>('/api/plants')
      .then(async list => {
        setPlants(list);
        setSelectedPlantId(list[0] ? String(list[0].plantId) : '');
        setError('');
        const counts = await Promise.all(list.map(async plant => {
          try {
            const equipments = await apiRequest<ApiEquipment[]>(`/api/equipments?plantId=${plant.plantId}`);
            return [plant.plantId, sortedUnits(equipments).length] as const;
          } catch (error) {
            reportApiError(`GET /api/equipments?plantId=${plant.plantId}`, error);
            return [plant.plantId, 0] as const;
          }
        }));
        setEquipmentCounts(Object.fromEntries(counts));
      })
      .catch(error => {
        reportApiError('GET /api/plants', error);
        setPlants([]);
        setSelectedPlantId('');
        setError('발전본부 데이터를 불러오지 못했습니다.');
      });
  }, []);

  const selectedPlant = plants.find(plant => String(plant.plantId) === selectedPlantId);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-on-surface">
      <AppHeader title="발전소 현황" />
      <main className="flex flex-1 overflow-hidden">
        <aside className="w-96 shrink-0 overflow-y-auto border-r border-outline-variant bg-surface-container-low p-6">
          {error && <div className="mb-4 rounded border border-red-400/30 bg-red-500/5 p-3 text-xs text-red-300">{error}</div>}
          {plants.length === 0 ? (
            <EmptyState message="표시할 발전본부 데이터가 없습니다." />
          ) : (
            <div className="space-y-3">
              {plants.map(plant => (
                <button
                  key={plant.plantId}
                  className={`w-full rounded-lg border p-5 text-left transition-all ${selectedPlantId === String(plant.plantId) ? 'border-primary/40 bg-secondary-container text-on-secondary-container' : 'border-outline-variant hover:bg-surface-container-highest'}`}
                  onClick={() => {
                    if (selectedPlantId === String(plant.plantId)) onOpenPlant(String(plant.plantId));
                    setSelectedPlantId(String(plant.plantId));
                  }}
                >
                  <h3 className="text-lg font-bold text-on-surface">{plant.plantName}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{plant.location || '위치 정보 없음'}</p>
                  <p className="mt-4 text-xs font-bold text-outline">호기 수</p>
                  <p className="font-data-lg text-xl text-on-surface">{equipmentCounts[plant.plantId] ?? 0}호기</p>
                </button>
              ))}
            </div>
          )}
        </aside>
        <section className="relative flex flex-1 items-center justify-center overflow-hidden bg-background">
          <div className="absolute inset-0 grid-bg opacity-40" />
          {selectedPlant ? (
            <div className="z-10 rounded-lg border border-outline-variant bg-surface-container-low p-8 text-center shadow-2xl">
              <p className="text-sm font-bold uppercase tracking-widest text-primary">Selected Plant</p>
              <h2 className="mt-3 text-3xl font-bold text-white">{selectedPlant.plantName}</h2>
              <p className="mt-2 text-sm text-on-surface-variant">{selectedPlant.location || '위치 정보 없음'}</p>
              <button className="mt-6 rounded bg-primary-container px-5 py-3 text-sm font-bold text-on-primary-container" onClick={() => onOpenPlant(String(selectedPlant.plantId))}>
                상세 보기
              </button>
            </div>
          ) : (
            <EmptyState message="발전본부를 선택할 수 없습니다." />
          )}
        </section>
      </main>
    </div>
  );
};

const PlantDetailPage = ({
  plantId,
  initialMenu,
  onBack,
  onOpenEquipment,
}: {
  plantId: string;
  initialMenu: 'generators' | 'logs';
  onBack: () => void;
  onOpenEquipment: (unitNo: number, component: ComponentType) => void;
}) => {
  const [activeMenu, setActiveMenu] = useState<'generators' | 'logs'>(initialMenu);
  const [activeLogType, setActiveLogType] = useState<ComponentType>('gasifier');
  const [selectedUnit, setSelectedUnit] = useState<number | null>(null);
  const [plant, setPlant] = useState<ApiPlant | null>(null);
  const [equipments, setEquipments] = useState<ApiEquipment[]>([]);
  const [anomalies, setAnomalies] = useState<Record<number, ApiAnomaly[]>>({});
  const [alerts, setAlerts] = useState<ApiAlert[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<ApiPlant[]>('/api/plants')
      .then(list => {
        setPlant(list.find(item => String(item.plantId) === plantId) || null);
        setError('');
      })
      .catch(error => {
        reportApiError('GET /api/plants', error);
        setPlant(null);
        setError('발전본부 데이터를 불러오지 못했습니다.');
      });
  }, [plantId]);

  useEffect(() => {
    apiRequest<ApiEquipment[]>(`/api/equipments?plantId=${plantId}`)
      .then(list => {
        setEquipments(list);
        const units = sortedUnits(list);
        setSelectedUnit(current => current ?? units[0] ?? null);
        setError('');
      })
      .catch(error => {
        reportApiError(`GET /api/equipments?plantId=${plantId}`, error);
        setEquipments([]);
        setSelectedUnit(null);
        setError('설비 데이터를 불러오지 못했습니다.');
      });

    apiRequest<ApiAlert[]>('/api/alerts')
      .then(setAlerts)
      .catch(error => {
        reportApiError('GET /api/alerts', error);
        setAlerts([]);
      });
  }, [plantId]);

  useEffect(() => {
    if (equipments.length === 0) {
      setAnomalies({});
      return;
    }
    Promise.all(equipments.map(async equipment => {
      try {
        const list = await apiRequest<ApiAnomaly[]>(`/api/equipments/${equipment.equipmentId}/anomalies`);
        return [equipment.equipmentId, sortAnomaliesDesc(list)] as const;
      } catch (error) {
        reportApiError(`GET /api/equipments/${equipment.equipmentId}/anomalies`, error);
        return [equipment.equipmentId, []] as const;
      }
    })).then(entries => setAnomalies(Object.fromEntries(entries)));
  }, [equipments]);

  const units = useMemo(() => sortedUnits(equipments), [equipments]);
  const equipmentById = useMemo(() => new Map(equipments.map(equipment => [equipment.equipmentId, equipment])), [equipments]);

  const generators = units.map(unitNo => {
    const unitEquipments = equipments.filter(equipment => equipment.unitNo === unitNo);
    const gasifier = unitEquipments.find(equipment => equipment.equipmentType?.toUpperCase() === 'TUBE');
    const motor = unitEquipments.find(equipment => equipment.equipmentType?.toUpperCase() === 'MOTOR');
    const latestGasifier = latestByEquipment(anomalies, gasifier);
    const latestMotor = latestByEquipment(anomalies, motor);
    const scores = [latestGasifier?.anomalyScore, latestMotor?.anomalyScore].filter((score): score is number => typeof score === 'number');
    const worstScore = scores.length ? Math.max(...scores) : undefined;
    const severity = normalizeSeverity(worstScore, [latestGasifier?.severity, latestMotor?.severity].find(Boolean));
    return { unitNo, gasifier, motor, latestGasifier, latestMotor, worstScore, severity };
  });

  const filteredLogs = alerts.filter(alert => {
    const equipment = equipmentById.get(alert.equipmentId ?? -1);
    if (!equipment || equipment.unitNo !== selectedUnit) return false;
    const type: ComponentType = (alert.anomalyResultType || equipment.equipmentType || '').toUpperCase() === 'MOTOR' ? 'motor' : 'gasifier';
    return type === activeLogType;
  });

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-[#dee3e8]">
      <AppHeader title={plant?.plantName || '발전본부'} onBack={onBack} />
      <main className="flex flex-1 overflow-hidden">
        <aside className="w-64 shrink-0 border-r border-outline-variant bg-surface py-6">
          <nav className="space-y-1 px-2">
            {[
              ['generators', '발전기 현황'],
              ['logs', '운영 로그'],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setActiveMenu(id as 'generators' | 'logs')} className={`w-full rounded px-6 py-3 text-left text-sm transition-colors ${activeMenu === id ? 'bg-primary/10 font-bold text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
                {label}
              </button>
            ))}
          </nav>
        </aside>
        <section className="flex-1 overflow-y-auto p-10">
          {error && <div className="mb-6 rounded border border-red-400/30 bg-red-500/5 p-3 text-sm text-red-300">{error}</div>}
          {activeMenu === 'generators' ? (
            <>
              <div className="mb-8 flex items-end justify-between">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-widest text-primary">{plant?.plantName || '-'}</p>
                  <h2 className="mt-1 text-3xl font-bold text-white">발전기 현황</h2>
                </div>
                <div className="flex gap-4 rounded-lg border border-white/5 bg-white/[0.03] px-5 py-3">
                  {(['NORMAL', 'WARNING', 'DANGER'] as const).map(severity => {
                    const style = severityStyle(severity);
                    return (
                      <div key={severity} className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                        <span className="text-[11px] font-bold text-on-surface-variant">{severity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {generators.length === 0 ? (
                <EmptyState message="표시할 설비 데이터가 없습니다." />
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                  {generators.map(generator => {
                    const style = severityStyle(generator.severity);
                    return (
                      <div key={generator.unitNo} className={`rounded-lg border bg-[#11171c]/80 p-6 transition-colors hover:border-[#38bdf8]/30 ${style.border}`}>
                        <div className="mb-6 flex items-start justify-between">
                          <h3 className="text-2xl font-bold text-white">{generator.unitNo}호기</h3>
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                            <span className={`text-xs font-extrabold ${style.text}`}>{style.label}</span>
                          </div>
                        </div>
                        <div className="mb-5 grid grid-cols-2 gap-3 text-xs">
                          <div className="rounded border border-white/[0.06] bg-white/[0.03] p-3">
                            <p className="font-bold text-gray-500">severity</p>
                            <p className={`mt-1 font-bold ${style.text}`}>{style.label}</p>
                          </div>
                          <div className="rounded border border-white/[0.06] bg-white/[0.03] p-3">
                            <p className="font-bold text-gray-500">anomaly score</p>
                            <p className="mt-1 font-mono text-white">{generator.worstScore == null ? '-' : generator.worstScore.toFixed(3)}</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <button disabled={!generator.gasifier} onClick={() => onOpenEquipment(generator.unitNo, 'gasifier')} className="flex w-full items-center justify-between rounded border border-white/[0.06] px-4 py-3 text-left text-sm text-gray-300 transition-colors hover:border-sky-300/30 disabled:cursor-not-allowed disabled:opacity-40">
                            <span>가스화기</span>
                            <span className="font-mono">{generator.latestGasifier?.anomalyScore == null ? '-' : generator.latestGasifier.anomalyScore.toFixed(3)}</span>
                          </button>
                          <button disabled={!generator.motor} onClick={() => onOpenEquipment(generator.unitNo, 'motor')} className="flex w-full items-center justify-between rounded border border-white/[0.06] px-4 py-3 text-left text-sm text-gray-300 transition-colors hover:border-sky-300/30 disabled:cursor-not-allowed disabled:opacity-40">
                            <span>모터</span>
                            <span className="font-mono">{generator.latestMotor?.anomalyScore == null ? '-' : generator.latestMotor.anomalyScore.toFixed(3)}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-widest text-primary">{activeLogType === 'gasifier' ? '가스화기' : '모터'}</p>
                  <h2 className="mt-1 text-3xl font-bold text-white">운영 로그</h2>
                </div>
                <div className="flex gap-2">
                  {(['gasifier', 'motor'] as const).map(type => (
                    <button key={type} onClick={() => setActiveLogType(type)} className={`rounded px-4 py-2 text-xs font-bold ${activeLogType === type ? 'bg-primary/10 text-primary' : 'bg-white/[0.03] text-gray-400'}`}>
                      {type === 'gasifier' ? '가스화기' : '모터'}
                    </button>
                  ))}
                </div>
              </div>
              <section className="rounded-lg border border-white/[0.06] bg-[#11171c]/70 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold tracking-widest text-[#38bdf8]">호기 선택</p>
                    <p className="mt-1 text-[11px] text-gray-500">선택한 발전본부의 equipment 목록 기준입니다.</p>
                  </div>
                  <span className="font-mono text-[11px] text-gray-500">총 {units.length}호기</span>
                </div>
                {units.length === 0 ? (
                  <EmptyState message="호기 목록을 불러올 수 없습니다." />
                ) : (
                  <div className="grid grid-cols-4 gap-2 md:grid-cols-6 lg:grid-cols-8">
                    {units.map(unit => {
                      const hasLog = alerts.some(alert => {
                        const equipment = equipmentById.get(alert.equipmentId ?? -1);
                        if (!equipment || equipment.unitNo !== unit) return false;
                        const type: ComponentType = (alert.anomalyResultType || equipment.equipmentType || '').toUpperCase() === 'MOTOR' ? 'motor' : 'gasifier';
                        return type === activeLogType;
                      });
                      return (
                        <button key={unit} onClick={() => setSelectedUnit(unit)} className={`rounded-lg border py-2.5 text-xs font-bold transition-all ${selectedUnit === unit ? 'border-[#38bdf8]/60 bg-[#38bdf8]/15 text-[#38bdf8]' : 'border-white/[0.05] bg-white/[0.03] text-gray-400 hover:text-white'}`}>
                          {unit}호기
                          {hasLog && <span className="ml-1 text-[9px] text-red-300">●</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
              <section>
                {filteredLogs.length === 0 ? (
                  <EmptyState message="선택한 호기의 운영 로그가 없습니다." />
                ) : (
                  <div className="divide-y divide-gray-800/60">
                    {filteredLogs.map((alert, index) => {
                      const style = severityStyle(alert.severity || 'NORMAL');
                      const equipment = equipmentById.get(alert.equipmentId ?? -1);
                      return (
                        <article key={alert.alertId ?? index} className="py-6">
                          <div className="mb-3 flex items-center gap-4">
                            <span className="font-mono text-xs text-gray-500">{formatTime(alert.occurredAt)}</span>
                            <span className={`rounded border px-3 py-1 text-xs font-bold ${style.text} ${style.border}`}>{style.label}</span>
                          </div>
                          <h3 className="text-xl font-bold text-white">{selectedUnit}호기 {equipmentName(equipment)}</h3>
                          <p className="mt-2 text-sm text-gray-400">{alert.message || '메시지가 없습니다.'}</p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

const SensorStatusPanel = ({ rows, thresholds }: { rows: ApiSensorRow[]; thresholds: ApiThreshold[] }) => {
  const items = latestSensorItems(rows);
  const thresholdByTag = new Map(thresholds.map(item => [sensorTag(item), item]));
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-800/50 bg-[#171c20]/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#38bdf8]">실시간 센서 현황</h3>
        <span className="rounded bg-white/5 px-2 py-1 font-mono text-[10px] text-white/40">개수: {items.length}</span>
      </div>
      {items.length === 0 ? (
        <EmptyState message="센서 데이터가 없습니다." />
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
          {items.map((row, index) => {
            const tag = sensorTag(row) || `sensor-${index + 1}`;
            const value = sensorValue(row);
            const threshold = thresholdByTag.get(tag);
            return (
              <div key={`${tag}-${index}`} className="rounded-lg border border-white/[0.05] bg-black/30 p-4">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11px] text-[#38bdf8]/80">{row.displayName || tag}</p>
                    <p className="mt-1 text-[10px] text-gray-600">{formatShortTime(row.measuredAt || row.timestamp)}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-data-lg text-lg text-white">{value == null ? '-' : value.toFixed(2)}</span>
                    {row.unit && <span className="ml-1 text-[9px] text-gray-500">{row.unit}</span>}
                  </div>
                </div>
                {threshold && (
                  <p className="mt-2 text-[10px] text-gray-600">
                    기준: {threshold.minValue ?? threshold.warningMin ?? threshold.lowerThreshold ?? '-'} ~ {threshold.maxValue ?? threshold.warningMax ?? threshold.upperThreshold ?? '-'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

const ContributionPanel = ({ severity, contributions }: { severity: Severity; contributions: ApiContribution[] }) => (
  <section className="rounded-lg border border-gray-800/50 bg-black/20 p-5">
    <h3 className="mb-5 text-xs font-bold uppercase tracking-[0.12em] text-[#38bdf8]">센서 기여도 TOP3</h3>
    {severity === 'NORMAL' ? (
      <div className="flex min-h-[110px] items-center justify-center rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] px-4 text-center text-xs text-gray-500">
        정상 상태에서는 기여도 데이터가 표시되지 않습니다.
      </div>
    ) : contributions.length === 0 ? (
      <EmptyState message="센서 기여도 데이터가 없습니다." />
    ) : (
      <div className="space-y-4">
        {contributions.slice(0, 3).map((item, index) => {
          const score = item.contributionScore ?? 0;
          return (
            <div key={`${item.sensorTag}-${index}`} className="grid grid-cols-[20px_90px_1fr_72px] items-center gap-3 text-[11px]">
              <span className="font-bold text-white">{index + 1}</span>
              <span className="truncate font-mono text-gray-400">{item.displayName || item.sensorTag}</span>
              <div className="h-2 overflow-hidden rounded bg-white/5">
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, score * 100))}%` }} className="h-full rounded bg-[#38bdf8]" />
              </div>
              <span className="text-right font-mono text-white">{score.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
    )}
  </section>
);

const EventTimeline = ({ anomalies }: { anomalies: ApiAnomaly[] }) => (
  <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-800/50 bg-black/20">
    <header className="border-b border-gray-800/30 p-4">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">이벤트 타임라인</h3>
    </header>
    {anomalies.length === 0 ? (
      <div className="p-4">
        <EmptyState message="이벤트 데이터가 없습니다." />
      </div>
    ) : (
      <div className="min-h-0 flex-1 overflow-y-auto p-4 text-[11px]">
        <div className="ml-1 space-y-6 border-l border-gray-800 pl-4">
          {anomalies.slice(0, 8).map(item => {
            const style = severityStyle(item.severity || normalizeSeverity(item.anomalyScore));
            return (
              <div key={item.anomalyResultId} className="relative">
                <div className={`absolute -left-[21px] top-1 h-2 w-2 rounded-full ${style.dot}`} />
                <span className={`font-mono ${style.text}`}>{formatShortTime(item.measuredAt)}</span>
                <p className="mt-1 font-bold text-white">{item.eventType || style.label}</p>
                <p className="text-gray-400 opacity-70">{item.description || `anomaly score ${item.anomalyScore?.toFixed(3) ?? '-'}`}</p>
              </div>
            );
          })}
        </div>
      </div>
    )}
  </section>
);

const TrendChart = ({ title, anomalies }: { title: string; anomalies: ApiAnomaly[] }) => {
  const data = buildChartData(anomalies);
  const latest = anomalies[0];
  const severity = normalizeSeverity(latest?.anomalyScore, latest?.severity);
  const style = severityStyle(severity);
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-800/50 bg-[#171c20]/80 p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#38bdf8]">{title}</h2>
          <p className="mt-1 text-xs text-on-surface-variant/60">Backend anomaly API 응답 기준</p>
        </div>
        <div className="text-right">
          <p className="font-data-lg text-3xl font-bold text-white">{latest?.anomalyScore == null ? '-' : latest.anomalyScore.toFixed(3)}</p>
          <span className={`rounded border px-3 py-1 text-[11px] font-bold ${style.text} ${style.border}`}>{style.label}</span>
        </div>
      </div>
      <div className="min-h-[260px] flex-1 rounded-lg border border-gray-800/30 bg-black/10 p-4">
        {data.length === 0 ? (
          <EmptyState message="이상 수치 데이터가 없습니다." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" stroke="#64748b" fontSize={10} />
              <YAxis domain={[0, 1]} stroke="#64748b" fontSize={10} />
              <Tooltip contentStyle={{ background: '#11171c', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff' }} />
              <Line type="monotone" dataKey="score" stroke={style.bar} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
};

const OperationalStateDashboard = ({
  plantId,
  unitNo,
  component,
  onBack,
  onOpenLogs,
}: {
  plantId: string;
  unitNo: number;
  component: ComponentType;
  onBack: () => void;
  onOpenLogs: () => void;
}) => {
  const [equipments, setEquipments] = useState<ApiEquipment[]>([]);
  const [anomalies, setAnomalies] = useState<ApiAnomaly[]>([]);
  const [contributions, setContributions] = useState<ApiContribution[]>([]);
  const [sensorRows, setSensorRows] = useState<ApiSensorRow[]>([]);
  const [thresholds, setThresholds] = useState<ApiThreshold[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<ApiEquipment[]>(`/api/equipments?plantId=${plantId}`)
      .then(list => {
        setEquipments(list);
        setError('');
      })
      .catch(error => {
        reportApiError(`GET /api/equipments?plantId=${plantId}`, error);
        setEquipments([]);
        setError('설비 데이터를 불러오지 못했습니다.');
      });
  }, [plantId]);

  const activeEquipment = equipments.find(equipment => equipment.unitNo === unitNo && (component === 'motor' ? equipment.equipmentType?.toUpperCase() === 'MOTOR' : equipment.equipmentType?.toUpperCase() === 'TUBE'));

  useEffect(() => {
    if (!activeEquipment) {
      setAnomalies([]);
      setContributions([]);
      setSensorRows([]);
      setThresholds([]);
      return;
    }

    apiRequest<ApiAnomaly[]>(`/api/equipments/${activeEquipment.equipmentId}/anomalies`)
      .then(async list => {
        const sorted = sortAnomaliesDesc(list);
        setAnomalies(sorted);
        const latest = sorted[0];
        if (!latest) {
          setContributions([]);
          return;
        }
        try {
          const contributionList = await apiRequest<ApiContribution[]>(`/api/equipments/${activeEquipment.equipmentId}/anomalies/${latest.anomalyResultId}/contributions`);
          setContributions(contributionList);
        } catch (error) {
          reportApiError(`GET /api/equipments/${activeEquipment.equipmentId}/anomalies/${latest.anomalyResultId}/contributions`, error);
          setContributions([]);
        }
      })
      .catch(error => {
        reportApiError(`GET /api/equipments/${activeEquipment.equipmentId}/anomalies`, error);
        setAnomalies([]);
        setContributions([]);
      });

    apiRequest<ApiSensorRow[]>(`/api/equipments/${activeEquipment.equipmentId}/sensor-data`)
      .then(setSensorRows)
      .catch(error => {
        reportApiError(`GET /api/equipments/${activeEquipment.equipmentId}/sensor-data`, error);
        setSensorRows([]);
      });

    apiRequest<ApiThreshold[]>(`/api/equipments/${activeEquipment.equipmentId}/sensor-thresholds`)
      .then(setThresholds)
      .catch(error => {
        reportApiError(`GET /api/equipments/${activeEquipment.equipmentId}/sensor-thresholds`, error);
        setThresholds([]);
      });
  }, [activeEquipment?.equipmentId]);

  const latest = anomalies[0];
  const severity = normalizeSeverity(latest?.anomalyScore, latest?.severity);
  const title = component === 'gasifier' ? '가스화기 이상 수치 그래프' : '통합 이상 수치 추이';

  return (
    <div className="dashboard-shell flex h-screen flex-col overflow-hidden bg-[#0a0f12] text-[#dee3e8]">
      <AppHeader title={`${unitNo}호기 ${component === 'gasifier' ? '가스화기' : '모터'} 상세`} onBack={onBack} />
      <div className="flex items-center justify-between border-b border-gray-800/50 bg-[#0f1418] px-8 py-3">
        <div className="text-sm text-gray-400">{activeEquipment ? equipmentName(activeEquipment) : '선택한 호기의 설비가 없습니다.'}</div>
        <button onClick={onOpenLogs} className="rounded border border-[#38bdf8]/30 px-4 py-2 text-xs font-bold text-[#38bdf8] hover:bg-[#38bdf8]/10">
          운영 로그
        </button>
      </div>
      {error && <div className="mx-4 mt-4 rounded border border-red-400/30 bg-red-500/5 p-3 text-sm text-red-300">{error}</div>}
      {!activeEquipment ? (
        <div className="p-4">
          <EmptyState message="선택한 호기의 설비 데이터가 없습니다." />
        </div>
      ) : component === 'gasifier' ? (
        <main className="grid flex-1 grid-cols-[42%_26%_32%] grid-rows-[1fr_260px] gap-4 overflow-hidden p-4">
          <TrendChart title={title} anomalies={anomalies} />
          <div className="row-span-2 flex min-h-0">
            <EventTimeline anomalies={anomalies} />
          </div>
          <SensorStatusPanel rows={sensorRows} thresholds={thresholds} />
          <section className="rounded-lg border border-gray-800/50 bg-[#171c20]/50 p-5">
            <div className="h-full rounded-lg border border-dashed border-gray-700/70 bg-white/[0.02]" />
          </section>
          <ContributionPanel severity={severity} contributions={contributions} />
        </main>
      ) : (
        <main className="grid flex-1 grid-cols-[68%_32%] gap-4 overflow-hidden p-4">
          <section className="flex min-h-0 flex-col gap-4">
            <TrendChart title={title} anomalies={anomalies} />
            <div className="grid h-[260px] grid-cols-[40%_60%] gap-4">
              <ContributionPanel severity={severity} contributions={contributions} />
              <section className="rounded-lg border border-gray-800/50 bg-[#171c20]/50 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#38bdf8]">운전 상태 변화</h3>
                  <span className="rounded bg-[#38bdf8]/10 px-2 py-0.5 text-[9px] font-bold text-[#38bdf8]">{severity}</span>
                </div>
                {anomalies.length === 0 ? (
                  <EmptyState message="운전 상태 변화 데이터가 없습니다." />
                ) : (
                  <ResponsiveContainer width="100%" height="75%">
                    <BarChart data={buildChartData(anomalies.slice(0, 12))}>
                      <XAxis dataKey="label" hide />
                      <YAxis hide domain={[0, 1]} />
                      <Tooltip contentStyle={{ background: '#11171c', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff' }} />
                      <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                        {buildChartData(anomalies.slice(0, 12)).map((item, index) => (
                          <Cell key={index} fill={severityStyle(normalizeSeverity(item.score)).bar} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </section>
            </div>
          </section>
          <aside className="flex min-h-0 flex-col gap-4">
            <SensorStatusPanel rows={sensorRows} thresholds={thresholds} />
            <EventTimeline anomalies={anomalies} />
          </aside>
        </main>
      )}
    </div>
  );
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(localStorage.getItem('accessToken')));
  const [view, setView] = useState<View>(() => (localStorage.getItem('accessToken') ? 'dashboard' : 'login'));
  const [activePlantId, setActivePlantId] = useState('');
  const [activeUnitNo, setActiveUnitNo] = useState(1);
  const [activeComponent, setActiveComponent] = useState<ComponentType>('motor');
  const [plantInitialMenu, setPlantInitialMenu] = useState<'generators' | 'logs'>('generators');

  const handleLogin = async (username: string, password: string) => {
    try {
      localStorage.removeItem('accessToken');
      const response = await apiRequest<{ accessToken?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (!response.accessToken) throw new Error('로그인 응답에 accessToken이 없습니다.');
      localStorage.setItem('accessToken', response.accessToken);
      setIsLoggedIn(true);
      setView('dashboard');
    } catch (error) {
      reportApiError('POST /api/auth/login', error);
      throw error;
    }
  };

  if (!isLoggedIn || view === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <AnimatePresence mode="wait">
      {view === 'dashboard' && (
        <motion.div key="dashboard" className="h-screen w-full overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <DashboardPage
            onOpenPlant={plantId => {
              setActivePlantId(plantId);
              setPlantInitialMenu('generators');
              setView('plant');
            }}
          />
        </motion.div>
      )}
      {view === 'plant' && (
        <motion.div key="plant" className="h-screen w-full overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <PlantDetailPage
            plantId={activePlantId}
            initialMenu={plantInitialMenu}
            onBack={() => setView('dashboard')}
            onOpenEquipment={(unitNo, component) => {
              setActiveUnitNo(unitNo);
              setActiveComponent(component);
              setView('equipment');
            }}
          />
        </motion.div>
      )}
      {view === 'equipment' && (
        <motion.div key="equipment" className="h-screen w-full overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <OperationalStateDashboard
            plantId={activePlantId}
            unitNo={activeUnitNo}
            component={activeComponent}
            onBack={() => setView('plant')}
            onOpenLogs={() => {
              setPlantInitialMenu('logs');
              setView('plant');
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
