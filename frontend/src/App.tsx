/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from 'recharts';

const TREND_VISIBLE_POINTS = 10;
const TUBE_TREND_Y_MAX = 0.6;
const SUMMARY_ANOMALY_LIMIT = 20;
const DETAIL_ANOMALY_LIMIT = 300;
const SENSOR_DATA_LIMIT = 300;
const ALERT_LIST_LIMIT = 100;
const ALERT_DROPDOWN_LIMIT = 5;

const STATUS_LEVELS = {
  danger: { label: '위험', color: 'bg-red-500' },
  warning: { label: '주의', color: 'bg-orange-500' },
  normal: { label: '정상', color: 'bg-[#38bdf8]' }
};



type ApiPlant = {
  plantId: number;
  plantName: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  generationCount?: number;
};

type ApiEquipment = {
  equipmentId: number;
  plantName?: string;
  equipmentName?: string;
  equipmentname?: string;
  equipmentType: 'MOTOR' | 'TUBE' | string;
  status?: string;
  unitNo?: number;
};

type ApiAnomaly = {
  equipmentType?: string;
  anomalyResultId: number;
  componentName?: string;
  measuredAt?: string;
  anomalyScore: number;
  severity: 'NORMAL' | 'WARNING' | 'DANGER' | string;
  eventType?: string;
  durationSec?: number;
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
  createdAt?: string;
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
  [key: string]: unknown;
};

type ApiThreshold = {
  sensorTag?: string;
  tag?: string;
  displayName?: string;
  lowerThreshold?: number;
  upperThreshold?: number;
  minValue?: number;
  maxValue?: number;
  [key: string]: unknown;
};

type UiPlant = {
  id: string;
  plantId?: number;
  name: string;
  location: string;
  capacity: string;
  latitude?: number;
  longitude?: number;
  generationCount: number;
  top: number;
  left: number;
};

declare global {
  interface Window {
    kakao?: any;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const KAKAO_MAP_KEY = (import.meta.env.VITE_KAKAO_MAP_KEY || '').replace(/\s+/g, ''); // 카카오맵 JavaScript 키(.env) 자리
const TUBE_DIAGRAM_SRC = '/tube-diagram.png';
const REALTIME_UPDATE_EVENT = 'pm:realtime-update';
const REALTIME_REFRESH_DEBOUNCE_MS = 750;
const AUTH_LOGOUT_EVENT = 'pm:auth-logout';

function clearStoredToken() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
}

function isJwtExpired(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

function getStoredAccessToken() {
  return localStorage.getItem('accessToken') || localStorage.getItem('token');
}

function getStoredRefreshToken() {
  return localStorage.getItem('refreshToken');
}

function emitRealtimeUpdate() {
  window.dispatchEvent(new CustomEvent(REALTIME_UPDATE_EVENT));
}

function emitLogout() {
  clearStoredToken();
  window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT));
}

function useRealtimeTick(intervalMs = 10_000) {
  const [realtimeTick, setRealtimeTick] = useState(0);
  const debounceTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const refresh = () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        setRealtimeTick(value => value + 1);
      }, REALTIME_REFRESH_DEBOUNCE_MS);
    };

    window.addEventListener(REALTIME_UPDATE_EVENT, refresh);
    const pollingId = window.setInterval(refresh, intervalMs);
    return () => {
      window.removeEventListener(REALTIME_UPDATE_EVENT, refresh);
      window.clearInterval(pollingId);
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [intervalMs]);

  return realtimeTick;
}

async function refreshAccessToken() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearStoredToken();
    return null;
  }

  const data = await response.json();
  const accessToken = data.accessToken || data.token;
  if (!accessToken) {
    clearStoredToken();
    return null;
  }

  localStorage.setItem('accessToken', accessToken);
  if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
  return accessToken;
}

async function apiRequest<T>(path: string, options: RequestInit = {}, retryOnUnauthorized = true): Promise<T> {
  let token = getStoredAccessToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  const isAuthRequest = path.startsWith('/api/auth/');

  if (!isAuthRequest && (!token || isJwtExpired(token))) {
    token = await refreshAccessToken();
  }

  if (token && !isAuthRequest) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && !isAuthRequest) {
      if (retryOnUnauthorized) {
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken) {
          return apiRequest<T>(path, options, false);
        }
      }
      clearStoredToken();
      window.location.reload();
    }
    const text = await response.text().catch(() => '');
    throw new Error(text || `API 요청 실패: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

function normalizeSeverity(score?: number, severity?: string) {
  if (severity) return severity.toUpperCase();
  if (score == null) return 'NORMAL';
  if (score >= 0.9) return 'DANGER';
  if (score >= 0.7) return 'WARNING';
  return 'NORMAL';
}

const EQUIPMENT_SCORE_THRESHOLDS = {
  TUBE: { warning: 0.3, danger: 0.4 },
  MOTOR: { warning: 0.7, danger: 0.9 },
} as const;

function severityFromEquipmentScore(score?: number, equipmentType?: string, severity?: string) {
  if (severity) return severity.toUpperCase();
  if (score == null) return 'NORMAL';

  const type = (equipmentType || '').toUpperCase();
  const thresholds = type === 'TUBE' ? EQUIPMENT_SCORE_THRESHOLDS.TUBE : EQUIPMENT_SCORE_THRESHOLDS.MOTOR;
  if (score >= thresholds.danger) return 'DANGER';
  if (score >= thresholds.warning) return 'WARNING';
  return 'NORMAL';
}

function barClassBySeverity(severity?: string) {
  const upper = normalizeSeverity(undefined, severity || 'NORMAL');
  if (upper === 'DANGER') return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.35)]';
  if (upper === 'WARNING') return 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.25)]';
  return 'bg-[#8ed5ff] shadow-[0_0_10px_rgba(142,213,255,0.20)]';
}

function logScoreTextClass(status?: string) {
  if (status === 'danger') return 'text-red-500';
  if (status === 'warning') return 'text-orange-500';
  return 'text-[#38bdf8]';
}

function logScoreBarClass(status?: string) {
  if (status === 'danger') return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
  if (status === 'warning') return 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]';
  return 'bg-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.25)]';
}

function severityToStatus(severity: string) {
  const upper = normalizeSeverity(undefined, severity);
  if (upper === 'DANGER') return 'danger';
  if (upper === 'WARNING') return 'warning';
  return 'normal';
}

function formatApiTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR', { hour12: false });
}

function formatCompactApiTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}.${month}.${day} ${hours}:${minutes}:${seconds}`;
}

function hasBrokenText(value?: string) {
  if (!value) return false;
  return value.includes('�') || /\?{2,}/.test(value);
}

function readableAlertMessage(alert: ApiAlert, part?: string) {
  if (alert.message && !hasBrokenText(alert.message)) return alert.message;
  const severity = normalizeSeverity(undefined, alert.severity || 'NORMAL');
  const label = severity === 'DANGER' ? '위험' : severity === 'WARNING' ? '주의' : '정상';
  return `${part ? `${part} ` : ''}${label} 알림이 발생했습니다.`;
}

function alertTargetKey(alert: Pick<ApiAlert, 'equipmentId' | 'anomalyResultId' | 'anomalyResultType'>) {
  return `${(alert.anomalyResultType || 'UNKNOWN').toUpperCase()}:${alert.equipmentId || 'unknown'}:${alert.anomalyResultId || 'unknown'}`;
}

function anomalyTargetKey(equipment: ApiEquipment, anomaly: ApiAnomaly) {
  return `${(equipment.equipmentType || anomaly.equipmentType || 'UNKNOWN').toUpperCase()}:${equipment.equipmentId}:${anomaly.anomalyResultId}`;
}

function alertSendTitle(alert: ApiAlert) {
  const channel = (alert.channel || 'Slack').toLowerCase() === 'slack' ? 'Slack' : alert.channel || 'Slack';
  if (alert.sendStatus === 'SUCCESS') return `${channel} 알림 전송 완료`;
  if (alert.sendStatus === 'FAILED') return `${channel} 알림 전송 실패`;
  return `${channel} 알림 전송 대기`;
}

function scoreFromAlertMessage(message?: string) {
  if (!message) return undefined;
  const numbers = [...message.matchAll(/\b\d+(?:\.\d+)?\b/g)].map(match => Number(match[0]));
  return numbers.reverse().find(value => value >= 0 && value <= 1);
}

function getEquipmentName(equipment: ApiEquipment) {
  return equipment.equipmentName || equipment.equipmentname || '';
}

function getStaticPlantMeta(name: string, index: number) {
  const matched = STATIC_PLANTS.find(p => p.name === name || name.includes(p.name.replace('발전본부', '')));
  return matched || { ...STATIC_PLANTS[index % STATIC_PLANTS.length], name, id: String(index + 1) };
}

function sortAnomaliesDesc(items: ApiAnomaly[]) {
  return [...items].sort((a, b) => {
    const aTime = a.measuredAt ? new Date(a.measuredAt).getTime() : 0;
    const bTime = b.measuredAt ? new Date(b.measuredAt).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;
    return (b.anomalyResultId || 0) - (a.anomalyResultId || 0);
  });
}

function severityRank(severity?: string) {
  const upper = normalizeSeverity(undefined, severity || 'NORMAL');
  if (upper === 'DANGER') return 3;
  if (upper === 'WARNING') return 2;
  if (upper === 'STOP') return 1;
  return 0;
}

function pickHighestSeverity(severities: Array<string | undefined>) {
  return severities.reduce((best, severity) => {
    const current = normalizeSeverity(undefined, severity || 'NORMAL');
    return severityRank(current) > severityRank(best) ? current : best;
  }, 'NORMAL');
}

function anomalySeverityForEquipment(anomaly: ApiAnomaly | undefined, equipmentType?: string) {
  if (!anomaly) return 'NORMAL';
  return pickHighestSeverity([
    anomaly.severity,
    severityFromEquipmentScore(anomaly.anomalyScore, equipmentType),
  ]);
}

function pickMostSevereAnomaly(items: ApiAnomaly[]) {
  return items.reduce<ApiAnomaly | undefined>((best, item) => {
    if (!best) return item;
    const itemRank = severityRank(item.severity);
    const bestRank = severityRank(best.severity);
    if (itemRank !== bestRank) return itemRank > bestRank ? item : best;
    return item.anomalyScore > best.anomalyScore ? item : best;
  }, undefined);
}

function latestAnomalySnapshot(items: ApiAnomaly[]) {
  const sorted = sortAnomaliesDesc(items);
  const latest = sorted[0];
  if (!latest) return undefined;
  const latestTime = latest.measuredAt ? new Date(latest.measuredAt).getTime() : 0;
  return pickMostSevereAnomaly(sorted.filter(item => {
    const time = item.measuredAt ? new Date(item.measuredAt).getTime() : 0;
    return time === latestTime;
  }));
}

function sensorValueFromRow(row: ApiSensorRow | undefined, tag: string) {
  if (!row) return undefined;
  const camelTag = tag.replaceAll('_', '');
  const legacyTubeTag = tag === 'bopc1_1_16200_fi_po041' ? 'bopc1116200FiPo041' : tag;
  const value = row[tag] ?? row[camelTag] ?? row[legacyTubeTag];
  return typeof value === 'number' ? value : undefined;
}

function displaySensorValue(row: ApiSensorRow | undefined, tag: string, isMotor: boolean) {
  const value = sensorValueFromRow(row, tag);
  if (value == null) return undefined;
  return isMotor && tag.startsWith('ii') && value < 0 ? 0 : value;
}

function latestSensorRow(rows: ApiSensorRow[]) {
  return [...rows].sort((a, b) => {
    const aTime = a.measuredAt ? new Date(a.measuredAt).getTime() : 0;
    const bTime = b.measuredAt ? new Date(b.measuredAt).getTime() : 0;
    return bTime - aTime;
  })[0];
}

function formatDateDot(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

function chartDataFromAnomalies(items: ApiAnomaly[]) {
  return [...items].reverse().map((item, index) => ({
    date: formatDateDot(item.measuredAt) || '-',
    time: item.measuredAt ? new Date(item.measuredAt).toLocaleTimeString('ko-KR', { hour12: false }) : String(index + 1),
    score: item.anomalyScore,
  }));
}

type TrendPoint = ReturnType<typeof chartDataFromAnomalies>[number];

function AnomalyTrendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: TrendPoint; value?: number | string }> }) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  const rawScore = typeof point?.score === 'number' ? point.score : Number(payload[0]?.value);
  const score = Number.isFinite(rawScore) ? rawScore : undefined;

  return (
    <div className="rounded-lg border border-white/10 bg-[#11171c] px-3 py-2 text-[11px] shadow-xl">
      <p className="text-white">{point?.date || '-'}</p>
      <p className="text-white">{point?.time || '-'}</p>
      <p className="text-[#38bdf8]">score : {score == null ? '-' : score}</p>
    </div>
  );
}

function ScrollableAnomalyTrendChart({ data, yMax, scrollKey }: { data: TrendPoint[]; yMax: number; scrollKey: string }) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const scrollbarRef = useRef<HTMLDivElement | null>(null);
  const pinnedToLatestRef = useRef(true);
  const programmaticScrollRef = useRef(false);
  const scrollFrameRef = useRef<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [windowStart, setWindowStart] = useState(0);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const observer = new ResizeObserver(entries => {
      setViewportWidth(entries[0]?.contentRect.width || 0);
    });
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current != null) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  const maxStart = Math.max(0, data.length - TREND_VISIBLE_POINTS);
  const safeWindowStart = Math.min(windowStart, maxStart);
  const visibleData = data.slice(safeWindowStart, safeWindowStart + TREND_VISIBLE_POINTS);
  const virtualWidth = viewportWidth > 0 && data.length > TREND_VISIBLE_POINTS
    ? (viewportWidth / TREND_VISIBLE_POINTS) * data.length
    : viewportWidth;
  const yTicks = useMemo(() => [0, 0.25, 0.5, 0.75, 1].map(ratio => Number((yMax * ratio).toFixed(2))), [yMax]);

  const scrollToStart = (start: number) => {
    const scrollbar = scrollbarRef.current;
    if (!scrollbar) return;
    const maxScrollLeft = scrollbar.scrollWidth - scrollbar.clientWidth;
    if (maxScrollLeft <= 0 || maxStart <= 0) {
      programmaticScrollRef.current = true;
      scrollbar.scrollLeft = 0;
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false;
      });
      return;
    }
    const nextScrollLeft = (Math.min(start, maxStart) / maxStart) * maxScrollLeft;
    if (Math.abs(scrollbar.scrollLeft - nextScrollLeft) < 1) return;
    programmaticScrollRef.current = true;
    scrollbar.scrollLeft = nextScrollLeft;
    requestAnimationFrame(() => {
      programmaticScrollRef.current = false;
    });
  };

  useEffect(() => {
    pinnedToLatestRef.current = true;
    setWindowStart(maxStart);
    requestAnimationFrame(() => {
      scrollToStart(maxStart);
    });
  }, [scrollKey]);

  useEffect(() => {
    if (!pinnedToLatestRef.current) {
      setWindowStart(previous => Math.min(previous, maxStart));
      return;
    }
    setWindowStart(maxStart);
    requestAnimationFrame(() => {
      scrollToStart(maxStart);
    });
  }, [data.length, maxStart]);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollToStart(pinnedToLatestRef.current ? maxStart : safeWindowStart);
    });
  }, [virtualWidth, viewportWidth, maxStart]);

  const updateFromScroll = () => {
    if (programmaticScrollRef.current || scrollFrameRef.current != null) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;

      const scrollbar = scrollbarRef.current;
      if (!scrollbar) return;
      const maxScrollLeft = scrollbar.scrollWidth - scrollbar.clientWidth;
      if (maxScrollLeft <= 0 || maxStart <= 0) {
        pinnedToLatestRef.current = true;
        setWindowStart(0);
        return;
      }
      const nextStart = Math.max(0, Math.min(maxStart, Math.round((scrollbar.scrollLeft / maxScrollLeft) * maxStart)));
      pinnedToLatestRef.current = scrollbar.scrollLeft >= maxScrollLeft - 8;
      setWindowStart(previous => previous === nextStart ? previous : nextStart);
    });
  };

  const handleChartWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const scrollbar = scrollbarRef.current;
    if (!scrollbar || scrollbar.scrollWidth <= scrollbar.clientWidth) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (delta === 0) return;
    event.preventDefault();
    scrollbar.scrollLeft += delta;
  };

  return (
    <div className="h-full min-w-0 flex flex-col gap-2">
      <div
        ref={chartRef}
        className="min-h-0 min-w-0 flex-1"
        onWheel={handleChartWheel}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={visibleData}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="time" stroke="#64748b" fontSize={10} interval={0} />
            <YAxis domain={[0, yMax]} ticks={yTicks} allowDataOverflow stroke="#64748b" fontSize={10} />
            <Tooltip content={<AnomalyTrendTooltip />} />
            <Line type="monotone" dataKey="score" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {data.length > TREND_VISIBLE_POINTS && (
        <div ref={scrollbarRef} className="h-4 overflow-x-auto overflow-y-hidden custom-scrollbar" onScroll={updateFromScroll}>
          <div style={{ width: Math.max(virtualWidth, viewportWidth), height: 1 }} />
        </div>
      )}
    </div>
  );
}

function percentFromDescription(value?: string) {
  if (!value) return undefined;
  const match = value.match(/(-?\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : undefined;
}

function formatSignedPercent(value?: number) {
  if (value == null || !Number.isFinite(value)) return '-';
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  return `${normalized > 0 ? '+' : ''}${normalized.toFixed(2)}%`;
}

const KakaoPlantMap = ({ plants, selectedPlantId, onPlantClick }: { plants: UiPlant[], selectedPlantId: string, onPlantClick: (id: string) => void }) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!KAKAO_MAP_KEY) return;
    if (window.kakao?.maps) {
      setReady(true);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-kakao-map="true"]');
    if (existing) {
      existing.addEventListener('load', () => setReady(true), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.dataset.kakaoMap = 'true';
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_KEY}&autoload=false`;
    script.async = true;
    script.onload = () => window.kakao?.maps?.load(() => setReady(true));
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.kakao?.maps || plants.length === 0) return;
    const selected = plants.find(plant => plant.id === selectedPlantId) || plants[0];
    const center = new window.kakao.maps.LatLng(36.3, 127.8);
    const map = new window.kakao.maps.Map(mapRef.current, {
      center,
      level: 13,
    });

    plants.forEach(plant => {
      const lat = plant.latitude ?? (38.4 - (plant.top / 100) * 5.6);
      const lng = plant.longitude ?? (124.4 + (plant.left / 100) * 6.2);
      const position = new window.kakao.maps.LatLng(lat, lng);
      const marker = new window.kakao.maps.Marker({ position, map });
      const info = new window.kakao.maps.InfoWindow({
        content: `<div style="padding:6px 10px;font-size:12px;font-weight:700;color:#111">${plant.name}</div>`,
      });
      window.kakao.maps.event.addListener(marker, 'click', () => onPlantClick(plant.id));
      if (plant.id === selected.id) info.open(map, marker);
    });
  }, [ready, plants, selectedPlantId, onPlantClick]);

  if (!KAKAO_MAP_KEY) return null;
  return <div ref={mapRef} className="absolute inset-0 z-20 opacity-100" />;
};

const LogAnalysisPanel = ({ log, onClose }: { log: any, onClose: () => void }) => {
  const contributions: ApiContribution[] = log.contributions || [];
  const alerts: ApiAlert[] = log.alerts || [];
  const part = log.part || '';
  const scoreTextClass = logScoreTextClass(log.status);
  const scoreBarClass = logScoreBarClass(log.status);
  const scoreBarWidth = Math.max(0, Math.min(100, (log.score ?? 0) * 100));

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute top-0 right-0 w-[500px] h-full bg-[#111821] border-l border-outline-variant shadow-2xl z-[100] flex flex-col"
    >
      {/* 헤더 섹션 */}
      <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">analytics</span>
            상세 원인 분석
          </h3>
          <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-1">
            <span className="material-symbols-outlined text-xs">schedule</span>
            {log.time} · {log.location}
          </p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar pb-12">
        {/* 점수 위젯: 0~1 사이로 정규화된 점수 표시 */}
        <section>
          <div className="bg-surface-container-highest/20 rounded-xl p-6 border border-outline-variant/30 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined text-6xl">priority_high</span>
            </div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">이상징후 지수 (정규화된 이상 지표)</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-5xl font-data-lg font-bold ${scoreTextClass}`}>
                {(log.score == null ? '-' : log.score.toFixed(3))}
              </span>
              <span className="text-on-surface-variant text-lg">/ 1.000</span>
            </div>
            <div className="mt-4 w-full h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${scoreBarWidth}%` }}
                className={`h-full ${scoreBarClass}`}
              />
            </div>
          </div>
        </section>

        {/* 센서 기여도 분석 차트 */}
        <section>
          <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-primary">analytics</span>
            센서별 이상 기여도 (Contribution)
          </h4>
          {contributions.length === 0 ? (
            <div className="h-48 w-full mb-4 rounded-xl border border-dashed border-outline-variant/30 bg-surface-container-highest/10 flex items-center justify-center px-6 text-center">
              <p className="text-xs text-on-surface-variant">선택한 로그의 센서 기여도 데이터가 없습니다.</p>
            </div>
          ) : (
            <div className="h-48 w-full mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={contributions} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <XAxis type="number" domain={[0, 1]} hide />
                  <YAxis dataKey="sensorTag" type="category" stroke="#87929A" fontSize={10} width={100} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: '#1B2024', border: '1px solid #3E484F', fontSize: '11px', borderRadius: '8px' }}
                  />
                  <Bar dataKey="contributionScore" radius={[0, 4, 4, 0]}>
                    {contributions.map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#EF4444' : '#F97316'} fillOpacity={0.8 - index * 0.15} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="space-y-2">
            {contributions.map((c, i) => (
              <div key={c.sensorTag} className="flex items-center justify-between p-3 bg-surface-container-low rounded border border-outline-variant/10 text-xs">
                <div className="flex items-center gap-3">
                  <span className={`w-5 h-5 flex items-center justify-center rounded font-bold ${i === 0 ? 'bg-red-500 text-white shadow-sm' : 'bg-white/5 text-on-surface-variant'}`}>
                    {i + 1}
                  </span>
                  <span className="font-mono text-on-surface">{c.sensorTag}</span>
                </div>
                <div className="text-right">
                  <span className="text-on-surface-variant mr-3">현재값: <b className="text-on-surface">{c.sensorValue ?? '-'}</b></span>
                  <span className="text-primary font-bold">{(c.contributionScore ?? 0).toFixed(3)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 최종 Slack 알림 발송 현황 */}
        <section>
          <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-[#4A154B]">forum</span>
            최종 Slack 알림 발송 현황
          </h4>
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#4A154B]/25 bg-[#4A154B]/5 p-5 text-center">
                <p className="text-xs text-on-surface-variant">선택한 로그의 Slack 알림 발송 이력이 없습니다.</p>
              </div>
            ) : alerts.map((alert) => (
              <div key={alert.alertId} className="flex gap-4 p-4 rounded-lg bg-[#4A154B]/5 border border-[#4A154B]/20">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  alert.sendStatus === 'SUCCESS' ? 'bg-[#4A154B]/10 text-[#4A154B]' : 'bg-red-500/10 text-red-500'
                }`}>
                  <span className="material-symbols-outlined text-lg">alternate_email</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-white tracking-wide">슬랙 봇 (Slack Bot)</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 border ${
                      alert.sendStatus === 'SUCCESS' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
                    }`}>
                      <span className="material-symbols-outlined text-[10px]">{alert.sendStatus === 'SUCCESS' ? 'check_circle' : 'error'}</span>
                      {alert.sendStatus === 'SUCCESS' ? '전송 완료' : '전송 실패'}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-on-surface-variant mb-2">{readableAlertMessage(alert, part)}</p>
                  <p className="text-[9px] text-outline text-right font-data-sm opacity-50">{formatApiTime(alert.occurredAt)} KST</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </motion.div>
  );
};

const LoginPage = ({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> | void }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center justify-center p-gutter relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(#334155 0.5px, transparent 0.5px)', backgroundSize: '40px 40px' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[160px]"></div>
      </div>

      <main className="relative z-10 w-full max-w-[400px] flex flex-col gap-10 items-center">
        {/* Brand Identity */}
        <header className="flex flex-col items-center">
          <h1 className="font-display-lg text-display-lg text-on-surface tracking-tighter uppercase">KOWEPO</h1>
        </header>

        {/* Login Card */}
        <section className="glass-panel w-full p-8 rounded-xl shadow-2xl flex flex-col gap-8">
          <div className="flex flex-col items-center gap-2">
            <h2 className="font-headline-md text-headline-md text-on-surface">로그인</h2>
            <div className="w-8 h-[2px] bg-primary/60 rounded-full"></div>
          </div>

          <form 
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              Promise.resolve(onLogin(username, password)).catch(() => setError('로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요.'));
            }}
          >
            {/* Username */}
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-label-caps text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">person</span>
                아이디
              </label>
              <div className="relative">
                <input 
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all outline-none" 
                  placeholder="아이디를 입력하세요" 
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-label-caps text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">lock</span>
                비밀번호
              </label>
              <div className="relative group">
                <input 
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all outline-none" 
                  placeholder="비밀번호를 입력하세요" 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-primary transition-colors p-1" 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-red-400 text-center">{error}</p>}

            {/* Submit Button */}
            <button 
              className="mt-2 w-full bg-primary-container text-on-primary-container font-title-sm text-title-sm py-4 rounded flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.99] transition-all" 
              type="submit"
            >
              로그인
            </button>
          </form>
        </section>
      </main>
    </div>
  );
};

const STATIC_PLANTS = [
  { id: 'taean', name: "태안발전본부", location: "충청남도 태안군 원북면 발전로 457", capacity: "6,504.5", top: 38, left: 40 },
  { id: 'seoincheon', name: "서인천발전본부", location: "인천광역시 서구 장도로 57", capacity: "1,861.8", top: 20, left: 45 },
  { id: 'pyeongtaek', name: "평택발전본부", location: "경기도 평택시 포승읍 남양만로 175-2", capacity: "871.4", top: 32, left: 50 },
  { id: 'gunsan', name: "군산발전본부", location: "전라북도 군산시 구암 3.1로 91-5", capacity: "719.4", top: 58, left: 45 },
  { id: 'gimpo', name: "김포발전본부", location: "경기도 김포시 양촌읍 학운리", capacity: "495", top: 23, left: 48 }
];

const DashboardPage = ({ onNavigateToDetail }: { onNavigateToDetail: (plantId: string) => void }) => {
  const [plants, setPlants] = useState<UiPlant[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState('');
  const [zoom, setZoom] = useState(1);
  const [mapPosition, setMapPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let alive = true;
    apiRequest<ApiPlant[]>('/api/plants')
      .then(apiPlants => {
        const enriched = apiPlants.map((plant, index) => {
          const meta = getStaticPlantMeta(plant.plantName, index);
          return {
            ...meta,
            id: String(plant.plantId),
            plantId: plant.plantId,
            name: plant.plantName,
            location: meta.location,
            capacity: meta.capacity,
            latitude: plant.latitude,
            longitude: plant.longitude,
            generationCount: plant.generationCount ?? 0,
          };
        });
        if (alive && enriched.length > 0) {
          setPlants(enriched);
          setSelectedPlantId(enriched[0].id);
        }
      })
      .catch(() => setPlants([]));
    return () => { alive = false; };
  }, []);

  const selectedPlant = plants.find(p => p.id === selectedPlantId) || plants[0];

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 0.5));
  
  const handleFocus = () => {
    setZoom(2.5);
    const x = (50 - selectedPlant.left) * 6;
    const y = (50 - selectedPlant.top) * 8;
    setMapPosition({ x, y });
  };

  const handleResetView = () => {
    setZoom(1);
    setMapPosition({ x: 0, y: 0 });
  };

  const handlePlantClick = (id: string) => {
    if (selectedPlantId === id) {
      onNavigateToDetail(id);
    } else {
      setSelectedPlantId(id);
    }
  };

  return (
    <div className="bg-background text-on-surface font-body-md overflow-hidden h-screen flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center px-margin h-16 w-full z-50 bg-surface border-b border-outline-variant shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-display-lg text-headline-md font-bold text-primary-container tracking-wider">KOWEPO</span>
          <div className="h-6 w-[1px] bg-outline-variant"></div>
          <span className="font-headline-md text-title-sm text-on-surface">발전소 현황</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-data-lg text-title-sm text-primary">2024.05.22 14:30:45 KST</span>
          </div>
<HeaderActions />
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="flex flex-col h-full w-96 py-margin px-6 gap-stack-gap bg-surface-container-low border-r border-outline-variant overflow-y-auto shrink-0">
          {plants.map((plant) => (
            <div 
              key={plant.id} 
              onClick={() => handlePlantClick(plant.id)}
              className={`transition-all rounded-lg p-card-padding border cursor-pointer group active:translate-x-1 ${
                selectedPlantId === plant.id 
                  ? 'bg-secondary-container text-on-secondary-container border-primary/40 shadow-lg' 
                  : 'hover:bg-surface-container-highest border-outline-variant'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className={`font-title-sm text-title-sm font-bold ${selectedPlantId === plant.id ? 'text-inherit' : 'text-on-surface'}`}>
                  {plant.name}
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-sm mt-0.5">location_on</span>
                  <span className="text-xs leading-relaxed">{plant.location}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={`text-[10px] font-bold uppercase ${selectedPlantId === plant.id ? 'text-primary' : 'text-outline/70'}`}>설비용량</p>
                    <p className="font-data-lg text-data-lg text-on-surface">
                      {plant.capacity}
                      <span className="text-xs ml-1">MW</span>
                    </p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-bold uppercase ${selectedPlantId === plant.id ? 'text-primary' : 'text-outline/70'}`}>발전대수</p>
                    <p className="font-data-lg text-data-lg text-on-surface">
                      {plant.generationCount}
                      <span className="text-xs ml-1">대</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </aside>

        {/* Main Map Area */}
        <section className="flex-1 relative bg-background overflow-hidden flex items-center justify-center">
          <KakaoPlantMap plants={plants} selectedPlantId={selectedPlantId} onPlantClick={handlePlantClick} />
          {/* Background Grid */}
          <div className="absolute inset-0 grid-bg opacity-40 z-0"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50 pointer-events-none z-1"></div>
          
          <motion.div 
            className="relative w-[600px] h-[800px] z-10"
            animate={{ 
              scale: zoom,
              x: mapPosition.x,
              y: mapPosition.y
            }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          >
            <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none fill-primary" viewBox="0 0 100 125" xmlns="http://www.w3.org/2000/svg">
              <path d="M48.5,10.2 C49.2,10.8 50.1,11.5 50.8,12.2 C51.5,12.9 52.1,13.8 52.6,14.7 C53.1,15.6 53.4,16.7 53.5,17.8 C53.6,18.9 53.4,20.1 53.0,21.2 C52.6,22.3 52.0,23.3 51.2,24.1 C50.4,24.9 49.5,25.6 48.4,26.0 C47.3,26.4 46.1,26.6 44.9,26.5 C43.7,26.4 42.6,26.1 41.6,25.5 C40.6,24.9 39.8,24.1 39.2,23.2 C38.6,22.3 38.3,21.2 38.2,20.1 C38.1,19.0 38.3,17.8 38.7,16.7 C39.1,15.6 39.7,14.6 40.5,13.8 C41.3,13.0 42.2,12.4 43.3,12.0 C44.4,11.6 45.5,11.4 46.7,11.5 C47.9,11.6 49.0,11.9 50.0,12.5 Z" opacity="0.2"></path>
              <path d="M45,15 L55,15 L60,25 L55,35 L45,45 L40,60 L35,75 L45,85 L55,90 L65,85 L70,70 L65,55 L75,45 L80,30 L75,15 L65,10 L50,5 L35,10 L25,20 L20,35 L25,50 L30,65 L25,80 L35,95 L55,98 L75,95 L85,80 L90,60 L85,40 L90,20 L80,5 L60,2 L45,15 Z"></path>
            </svg>
            
            {/* Markers */}
            {plants.map((plant) => {
              const isActive = selectedPlantId === plant.id;
              
              return (
                <motion.div 
                  key={plant.id}
                  layoutId={`marker-${plant.id}`}
                  initial={false}
                  animate={{ 
                    top: `${plant.top}%`, 
                    left: `${plant.left}%`,
                    scale: isActive ? 1.1 / zoom : 1 / zoom
                  }}
                  className={`absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 ${isActive ? 'z-30' : 'z-20'}`}
                >
                  {isActive ? (
                    <>
                      <div 
                        className="relative cursor-pointer"
                        onClick={() => handlePlantClick(plant.id)}
                      >
                        <motion.div 
                          layoutId="active-pulse"
                          className="absolute -inset-4 rounded-full bg-[#ccff00]/10 animate-pulse"
                        ></motion.div>
                        <motion.div 
                          layoutId="active-ping"
                          className="absolute -inset-2 rounded-full bg-[#ccff00]/20 animate-ping"
                        ></motion.div>
                        <div className="w-8 h-8 rounded-full bg-[#ccff00]/90 border-2 border-yellow-950 flex items-center justify-center shadow-[0_0_15px_rgba(204,255,0,0.4)] relative z-10 transition-all">
                          <span className="material-symbols-outlined text-[16px] text-yellow-950" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                        </div>
                      </div>
                      <motion.div 
                        layoutId="active-label"
                        onClick={() => handlePlantClick(plant.id)}
                        className="bg-[#ccff00]/90 text-yellow-950 mt-3 px-4 py-1.5 rounded-sm text-xs font-bold shadow-lg border border-yellow-950/40 ring-1 ring-white/10 backdrop-blur-sm whitespace-nowrap cursor-pointer"
                      >
                        {plant.name}
                      </motion.div>
                    </>
                  ) : (
                    <>
                      <div 
                        onClick={() => handlePlantClick(plant.id)}
                        className="w-3 h-3 rounded-full bg-primary border border-yellow-950/50 shadow-[0_0_12px_rgba(142,213,255,0.8)] hover:scale-125 transition-transform cursor-pointer"
                      ></div>
                    </>
                  )}
                </motion.div>
              );
            })}
          </motion.div>

          <div className="absolute bottom-margin right-margin flex flex-col gap-2 z-30">
            <button 
              onClick={handleFocus}
              className="glass-panel w-12 h-12 rounded-lg flex items-center justify-center hover:bg-surface-container-highest transition-colors shadow-lg border-primary/20 active:scale-90"
            >
              <span className="material-symbols-outlined text-primary text-[24px]">filter_center_focus</span>
            </button>
            <button 
              onClick={handleResetView}
              className="glass-panel w-12 h-12 rounded-lg flex items-center justify-center hover:bg-surface-container-highest transition-colors shadow-lg border-primary/20 active:scale-90"
            >
              <span className="material-symbols-outlined text-primary text-[24px]">restart_alt</span>
            </button>
            <div className="h-[1px] w-8 bg-outline-variant mx-auto my-1"></div>
            <button 
              onClick={handleZoomIn}
              className="glass-panel w-12 h-12 rounded-lg flex items-center justify-center hover:bg-surface-container-highest transition-colors shadow-lg border-primary/20 active:scale-90"
            >
              <span className="material-symbols-outlined text-primary text-[24px]">add</span>
            </button>
            <button 
              onClick={handleZoomOut}
              className="glass-panel w-12 h-12 rounded-lg flex items-center justify-center hover:bg-surface-container-highest transition-colors shadow-lg border-primary/20 active:scale-90"
            >
              <span className="material-symbols-outlined text-primary text-[24px]">remove</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};
const PlantDetailPage = ({ plantId, initialMenu = 'generators', onBack, onSwitchPlant, onNavigateToDashboard }: { plantId: string, initialMenu?: 'generators' | 'logs', onBack: () => void, onSwitchPlant: (id: string) => void, onNavigateToDashboard: (genId: number, comp: 'motor' | 'gasifier') => void }) => {
  const [activeMenu, setActiveMenu] = useState<'generators' | 'logs'>(initialMenu);
  const [activeLogSubMenu, setActiveLogSubMenu] = useState<'gasifier' | 'motor'>('gasifier');
  const [selectedLogUnit, setSelectedLogUnit] = useState(1);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showPlantList, setShowPlantList] = useState(false);
  const [plants, setPlants] = useState<UiPlant[]>([]);
  const [equipments, setEquipments] = useState<ApiEquipment[]>([]);
  const [latestAnomalies, setLatestAnomalies] = useState<Record<number, ApiAnomaly | undefined>>({});
  const [anomalyLogsByEquipment, setAnomalyLogsByEquipment] = useState<Record<number, ApiAnomaly[]>>({});
  const [contributionsByAnomaly, setContributionsByAnomaly] = useState<Record<string, ApiContribution[]>>({});
  const [alertLogs, setAlertLogs] = useState<ApiAlert[]>([]);
  const realtimeTick = useRealtimeTick();

  useEffect(() => {
    apiRequest<ApiPlant[]>('/api/plants')
      .then(apiPlants => {
        const mapped = apiPlants.map((plant, index) => ({
          ...getStaticPlantMeta(plant.plantName, index),
          id: String(plant.plantId),
          plantId: plant.plantId,
          name: plant.plantName,
          location: getStaticPlantMeta(plant.plantName, index).location,
          capacity: getStaticPlantMeta(plant.plantName, index).capacity,
          latitude: plant.latitude,
          longitude: plant.longitude,
          generationCount: plant.generationCount ?? 0,
        }));
        if (mapped.length > 0) setPlants(mapped);
      })
      .catch(() => undefined);
  }, []);

  const plant = plants.find(p => p.id === plantId) || plants[0] || { id: plantId, name: '발전본부 데이터 없음', location: '', capacity: '', generationCount: 0, top: 50, left: 50 };
  const numericPlantId = plant?.plantId || Number(plantId);

  useEffect(() => {
    if (!numericPlantId || Number.isNaN(numericPlantId)) return;
    let cancelled = false;

    Promise.all([
      apiRequest<ApiEquipment[]>(`/api/equipments?plantId=${numericPlantId}`),
      apiRequest<ApiAlert[]>(`/api/alerts?limit=${ALERT_LIST_LIMIT}`),
    ])
      .then(([nextEquipments, nextAlertLogs]) => {
        if (cancelled) return;
        setEquipments(nextEquipments);
        setAlertLogs(nextAlertLogs);
      })
      .catch(error => {
        console.error(error);
      });

    return () => {
      cancelled = true;
    };
  }, [numericPlantId, realtimeTick]);

  useEffect(() => {
    if (equipments.length === 0) return;
    let cancelled = false;

    Promise.all(equipments.map(async equipment => {
      try {
        const anomalies = await apiRequest<ApiAnomaly[]>(`/api/equipments/${equipment.equipmentId}/anomalies?limit=${ALERT_LIST_LIMIT}`);
        return {
          equipmentId: equipment.equipmentId,
          anomalies,
          anomaly: latestAnomalySnapshot(anomalies.slice(0, SUMMARY_ANOMALY_LIMIT)),
          ok: true,
        } as const;
      } catch {
        return { equipmentId: equipment.equipmentId, ok: false } as const;
      }
    })).then(entries => {
      if (cancelled) return;
      setLatestAnomalies(previous => {
        const next = { ...previous };
        entries.forEach(entry => {
          if (!entry.ok) return;
          if (entry.anomaly) {
            next[entry.equipmentId] = entry.anomaly;
          } else {
            delete next[entry.equipmentId];
          }
        });
        return next;
      });
      setAnomalyLogsByEquipment(previous => {
        const next = { ...previous };
        entries.forEach(entry => {
          if (!entry.ok) return;
          next[entry.equipmentId] = sortAnomaliesDesc(entry.anomalies);
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [equipments, realtimeTick]);

  useEffect(() => {
    if (equipments.length === 0) {
      setContributionsByAnomaly({});
      return;
    }

    const equipmentById = new Map<number, ApiEquipment>(equipments.map(equipment => [equipment.equipmentId, equipment]));
    const uniqueTargets = Object.entries(anomalyLogsByEquipment)
      .flatMap(([equipmentId, anomalies]) => {
        const equipment = equipmentById.get(Number(equipmentId));
        if (!equipment) return [];
        const type = (equipment.equipmentType || '').toUpperCase() === 'MOTOR' ? 'motor' : 'gasifier';
        return anomalies
          .filter(anomaly => severityRank(anomalySeverityForEquipment(anomaly, equipment.equipmentType)) > 0)
          .map(anomaly => ({
            equipmentId: equipment.equipmentId,
            anomalyResultId: anomaly.anomalyResultId,
            measuredAt: anomaly.measuredAt,
            key: anomalyTargetKey(equipment, anomaly),
            type,
          }));
      })
      .sort((a, b) => {
        const aTime = a.measuredAt ? new Date(a.measuredAt).getTime() : 0;
        const bTime = b.measuredAt ? new Date(b.measuredAt).getTime() : 0;
        return bTime - aTime;
      })
      .filter((target, index, list) => list.findIndex(item => item.key === target.key) === index);

    const contributionTargets = [
      ...uniqueTargets.filter(target => target.type === 'gasifier').slice(0, ALERT_LIST_LIMIT),
      ...uniqueTargets.filter(target => target.type === 'motor').slice(0, ALERT_LIST_LIMIT),
    ];

    if (contributionTargets.length === 0) {
      setContributionsByAnomaly({});
      return;
    }

    Promise.all(contributionTargets.map(async target => {
      let contributions: ApiContribution[] = [];

      try {
        contributions = await apiRequest<ApiContribution[]>(`/api/equipments/${target.equipmentId}/anomalies/${target.anomalyResultId}/contributions`);
      } catch (error) {
        console.error(error);
      }

      return [target.key, contributions] as const;
    })).then(entries => {
      setContributionsByAnomaly(Object.fromEntries(entries.map(([key, contributions]) => [key, contributions])));
    });
  }, [anomalyLogsByEquipment, equipments]);

  const unitCount = useMemo(() => {
    const unitNos = equipments.map(e => e.unitNo).filter((n): n is number => typeof n === 'number');
    return unitNos.length > 0 ? Math.max(...unitNos) : 0;
  }, [equipments]);

  const generators = useMemo(() => Array.from({ length: unitCount }, (_, i) => {
    const id = i + 1;
    const unitEquipments = equipments.filter(e => e.unitNo === id);
    const gasifierEquipment = unitEquipments.find(e => e.equipmentType === 'TUBE');
    const motorEquipment = unitEquipments.find(e => e.equipmentType === 'MOTOR');
    const gasifierAnomaly = gasifierEquipment ? latestAnomalies[gasifierEquipment.equipmentId] : undefined;
    const motorAnomaly = motorEquipment ? latestAnomalies[motorEquipment.equipmentId] : undefined;
    const gasifierScore = gasifierAnomaly?.anomalyScore;
    const motorScore = motorAnomaly?.anomalyScore;
    const gasifierSeverity = pickHighestSeverity([
      gasifierEquipment?.status,
      anomalySeverityForEquipment(gasifierAnomaly, 'TUBE'),
    ]);
    const motorSeverity = pickHighestSeverity([
      motorEquipment?.status,
      anomalySeverityForEquipment(motorAnomaly, 'MOTOR'),
    ]);
    const scores = [gasifierScore, motorScore].filter((n): n is number => typeof n === 'number');
    const score = scores.length ? Math.max(...scores) : undefined;
    const severity = pickHighestSeverity([
      gasifierSeverity,
      motorSeverity,
      normalizeSeverity(score),
    ]);
    return {
      id,
      status: 'running',
      score,
      severity,
      gasifierEquipment,
      motorEquipment,
      gasifierScore,
      motorScore,
      gasifierSeverity,
      motorSeverity,
    };
  }), [unitCount, equipments, latestAnomalies]);

  const derivedLogs = useMemo(() => {
    if (equipments.length === 0) return [];

    const equipmentById = new Map<number, ApiEquipment>(equipments.map(e => [e.equipmentId, e]));
    const alertsByTarget = new Map<string, ApiAlert[]>();

    alertLogs.forEach(alert => {
      if (!alert.equipmentId || !alert.anomalyResultId) return;
      const key = alertTargetKey(alert);
      alertsByTarget.set(key, [...(alertsByTarget.get(key) || []), alert]);
    });

    const logs = Object.entries(anomalyLogsByEquipment)
      .flatMap(([equipmentId, anomalies]) => {
        const equipment = equipmentById.get(Number(equipmentId));
        if (!equipment) return [];

        const unitNo = equipment.unitNo || 1;
        const type = (equipment.equipmentType || '').toUpperCase() === 'MOTOR' ? 'motor' : 'gasifier';

        return anomalies
          .filter(anomaly => severityRank(anomalySeverityForEquipment(anomaly, equipment.equipmentType)) > 0)
          .map(anomaly => {
            const targetKey = anomalyTargetKey(equipment, anomaly);
            const part = type === 'motor' ? (anomaly.componentName || '고압전동기').replace(/_/g, ' ') : '가스화기';
            const severity = anomalySeverityForEquipment(anomaly, equipment.equipmentType);
            const status = severityToStatus(severity);
            const statusLabel = (STATUS_LEVELS as any)[status]?.label || '';
            const alerts = (alertsByTarget.get(targetKey) || []).map(alert => ({
              ...alert,
              message: readableAlertMessage(alert, part),
            }));

            return {
              id: targetKey,
              equipmentId: equipment.equipmentId,
              anomalyResultId: anomaly.anomalyResultId,
              time: formatApiTime(anomaly.measuredAt),
              measuredAt: anomaly.measuredAt,
              status,
              score: anomaly.anomalyScore ?? 0,
              unitNo,
              location: `${plant.name} ${unitNo}호기`,
              type,
              part,
              message: anomaly.description || `${part} ${statusLabel} 상태가 감지되었습니다.`,
              contributions: contributionsByAnomaly[targetKey] || [],
              alerts,
            };
          });
      })
      .sort((a, b) => {
        const aTime = a.measuredAt ? new Date(a.measuredAt).getTime() : 0;
        const bTime = b.measuredAt ? new Date(b.measuredAt).getTime() : 0;
        if (bTime !== aTime) return bTime - aTime;
        return String(b.id).localeCompare(String(a.id));
      });

    return [
      ...logs.filter(log => log.type === 'gasifier').slice(0, ALERT_LIST_LIMIT),
      ...logs.filter(log => log.type === 'motor').slice(0, ALERT_LIST_LIMIT),
    ].sort((a, b) => {
      const aTime = a.measuredAt ? new Date(a.measuredAt).getTime() : 0;
      const bTime = b.measuredAt ? new Date(b.measuredAt).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return String(b.id).localeCompare(String(a.id));
    });
  }, [anomalyLogsByEquipment, alertLogs, equipments, plant.name, contributionsByAnomaly]);

  useEffect(() => {
    if (!selectedLog) return;
    const freshLog = derivedLogs.find(log => log.id === selectedLog.id);
    if (freshLog) {
      setSelectedLog(freshLog);
    }
  }, [derivedLogs, selectedLog?.id]);

  return (
    <div className="bg-background text-[#dee3e8] font-sans overflow-hidden h-screen flex flex-col relative">
      <AnimatePresence>
        {selectedLog && (
          <LogAnalysisPanel log={selectedLog} onClose={() => setSelectedLog(null)} />
        )}
      </AnimatePresence>

      {/* 상단 헤더 */}
      <header className="flex justify-between items-center px-margin h-16 w-full z-50 bg-surface border-b border-outline-variant shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-surface-container-highest rounded-lg mr-2 transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined">grid_view</span>
          </button>
          <span className="font-display-lg text-headline-md font-bold text-primary-container tracking-wider uppercase">KOWEPO</span>
          <div className="h-6 w-[1px] bg-outline-variant"></div>
          
          <div className="relative">
            <button 
              onClick={() => setShowPlantList(!showPlantList)}
              className="flex items-center gap-2 font-headline-md text-title-sm text-on-surface hover:text-primary transition-colors"
            >
              {plant.name}
              <span className={`material-symbols-outlined text-sm transition-transform ${showPlantList ? 'rotate-180' : ''}`}>expand_more</span>
            </button>
            <AnimatePresence>
              {showPlantList && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 mt-2 w-48 bg-surface border border-outline-variant rounded-xl overflow-hidden py-2 z-[60] shadow-2xl"
                >
                  {plants.map(p => (
                    <button 
                      key={p.id}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-primary/10 transition-colors ${p.id === plantId ? 'text-primary bg-primary/5' : 'text-on-surface'}`}
                      onClick={() => {
                        onSwitchPlant(p.id);
                        setShowPlantList(false);
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-data-lg text-title-sm text-primary">2024.05.22 14:30:45 KST</span>
          </div>
<HeaderActions />
        </div>
      </header>
      
      <main className="flex-1 flex overflow-hidden">
        {/* 좌측 사이드바 */}
        <aside className="flex flex-col h-full w-64 py-6 bg-surface border-r border-outline-variant shrink-0">
          <nav className="flex-1 px-2 space-y-1 mt-2">
            {/* 발전기 */}
            <div className={`relative group transition-all ${activeMenu === 'generators' ? '' : 'opacity-60'}`}>
              {activeMenu === 'generators' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-primary rounded-r-full"></div>}
              <button 
                onClick={() => setActiveMenu('generators')}
                className={`flex items-center w-full gap-3 px-6 py-3 transition-colors ${activeMenu === 'generators' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <span className="text-sm">발전기</span>
              </button>
            </div>
            {/* 운영 로그 */}
            <div className={`relative group transition-all ${activeMenu === 'logs' ? '' : 'opacity-60'}`}>
              {activeMenu === 'logs' && <div className="absolute left-0 top-[1.125rem] w-1.5 h-8 bg-primary rounded-r-full"></div>}
              <button 
                onClick={() => setActiveMenu('logs')}
                className={`flex items-center w-full gap-3 px-6 py-3 transition-colors ${activeMenu === 'logs' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <span className="text-sm font-medium">운영 로그</span>
              </button>
              {activeMenu === 'logs' && (
                <div className="ml-8 mt-1 space-y-1">
                  <button 
                    onClick={() => setActiveLogSubMenu('gasifier')}
                    className={`flex items-center w-full px-4 py-2 rounded-lg text-xs transition-colors ${activeLogSubMenu === 'gasifier' ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant hover:bg-white/5'}`}
                  >
                    가스화기
                  </button>
                  <button 
                    onClick={() => setActiveLogSubMenu('motor')}
                    className={`flex items-center w-full px-4 py-2 rounded-lg text-xs transition-colors ${activeLogSubMenu === 'motor' ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant hover:bg-white/5'}`}
                  >
                    고압전동기
                  </button>
                </div>
              )}
            </div>
          </nav>
        </aside>

        {/* 메인 콘텐츠 영역 */}
        <section className="flex-1 p-10 overflow-y-auto custom-scrollbar">
          <div className="max-w-[1600px] mx-auto">
            {activeMenu === 'generators' ? (
              <>
                {/* 페이지 헤더 */}
                <div className="flex justify-between items-end mb-10">
                  <div>
                    <div className="flex flex-col gap-1">
                      <span className="text-lg font-extrabold text-primary uppercase tracking-widest leading-none mb-1">{plant.name}</span>
                      <h2 className="text-3xl font-bold text-white tracking-tight">발전기 현황</h2>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="glass-panel px-6 py-3 rounded-full flex items-center gap-5 border border-white/5">
                      {[
                        { label: '정상', color: 'bg-green-500' },
                        { label: '주의', color: 'bg-yellow-400' },
                        { label: '위험', color: 'bg-red-500' },
                        { label: '정지', color: 'bg-outline-variant' }
                      ].map(item => (
                        <div key={item.label} className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${item.color}`}></span>
                          <span className="text-[11px] font-bold text-on-surface-variant">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 발전기 그리드 */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                  {generators.map(gen => {
                    const gasifierScore = gen.gasifierScore;
                    const motorScore = gen.motorScore;
                    const scoreValues = [gasifierScore, motorScore].filter((n): n is number => typeof n === 'number');
                    const maxScore = scoreValues.length ? Math.max(...scoreValues) : undefined;
                    const overallSeverity = normalizeSeverity(maxScore, gen.severity);
                    const statusLabel = overallSeverity === 'DANGER' ? '위험' : overallSeverity === 'WARNING' ? '주의' : overallSeverity === 'STOP' ? '정지' : '정상';
                    const statusClass = overallSeverity === 'DANGER' ? 'text-red-300' : overallSeverity === 'WARNING' ? 'text-yellow-300' : overallSeverity === 'STOP' ? 'text-gray-400' : 'text-[#8ed5ff]';
                    return (
                      <div key={gen.id} className="asset-card glass-panel rounded-[22px] p-7 border border-white/[0.07] bg-[#11171c]/80 flex flex-col gap-7 hover:border-[#38bdf8]/20 transition-all">
                        <div className="flex justify-between items-start">
                          <h3 className="text-2xl font-bold text-white tracking-tight">{gen.id}호기</h3>
                          <span className={`text-xs font-extrabold tracking-wider ${statusClass}`}>{statusLabel}</span>
                        </div>

                        <button onClick={() => onNavigateToDashboard(gen.id, 'gasifier')} className="text-left group/score">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">가스화기 점수</span>
                            <span className="text-xs font-mono text-gray-400">{gasifierScore == null ? '-' : gasifierScore.toFixed(3)}</span>
                          </div>
                          <div className="h-3 rounded-full bg-white/[0.05] overflow-hidden border border-white/[0.04] group-hover/score:border-[#38bdf8]/30 transition-colors">
                            <div className={`h-full rounded-full ${barClassBySeverity(gen.gasifierSeverity)}`} style={{ width: `${(gasifierScore ?? 0) * 100}%` }}></div>
                          </div>
                        </button>

                        <button onClick={() => onNavigateToDashboard(gen.id, 'motor')} className="text-left group/score">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">고압전동기 점수</span>
                            <span className="text-xs font-mono text-gray-400">{motorScore == null ? '-' : motorScore.toFixed(3)}</span>
                          </div>
                          <div className="h-3 rounded-full bg-white/[0.05] overflow-hidden border border-white/[0.04] group-hover/score:border-[#38bdf8]/30 transition-colors">
                            <div className={`h-full rounded-full ${barClassBySeverity(gen.motorSeverity)}`} style={{ width: `${(motorScore ?? 0) * 100}%` }}></div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-8">
                <div className="flex justify-between items-end mb-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-lg font-extrabold text-primary uppercase tracking-widest leading-none mb-1">
                      {activeLogSubMenu === 'gasifier' ? '가스화기' : '고압전동기'}
                    </span>
                    <h2 className="text-3xl font-bold text-white tracking-tight">운영 로그</h2>
                  </div>
                </div>

                <section className="rounded-2xl border border-white/[0.06] bg-[#11171c]/70 p-5 dashboard-card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs font-bold text-[#38bdf8] tracking-widest">호기 선택</p>
                      <p className="text-[11px] text-gray-500 mt-1">선택된 발전본부 기준으로 운영 로그를 조회합니다.</p>
                    </div>
                    <span className="text-[11px] text-gray-500 font-mono">총 {unitCount}기</span>
                  </div>
                  <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    {Array.from({ length: unitCount }).map((_, i) => {
                      const unit = i + 1;
                      const hasLog = derivedLogs.some(log => log.unitNo === unit && log.type === activeLogSubMenu);
                      return (
                        <button
                          key={unit}
                          onClick={() => setSelectedLogUnit(unit)}
                          className={`py-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer hover:-translate-y-0.5 active:scale-95 ${selectedLogUnit === unit ? 'border-[#38bdf8]/60 bg-[#38bdf8]/15 text-[#38bdf8]' : 'border-white/[0.05] bg-white/[0.03] text-gray-400 hover:text-white hover:border-white/[0.12]'}`}
                        >
                          {unit}호기
                          {hasLog && <span className="ml-1 text-[9px] text-red-300">●</span>}
                        </button>
                      );
                    })}
                  </div>
                </section>
                
                <div className="flex flex-col">
                  {/* 로그 리스트 */}
                  <div className="flex flex-col">
                    {derivedLogs.filter(log => log.unitNo === selectedLogUnit && log.type === activeLogSubMenu).length > 0 ? (
                      derivedLogs.filter(log => log.unitNo === selectedLogUnit && log.type === activeLogSubMenu).map(log => {
                        const [, unitName] = log.location.split(' ');
                        const scoreTextClass = logScoreTextClass(log.status);
                        return (
                          <button 
                            key={log.id} 
                            onClick={() => setSelectedLog(log)}
                            className="w-full flex flex-col px-8 py-8 border-b border-gray-800/30 hover:bg-[#38bdf8]/5 transition-all group text-left gap-4"
                          >
                            <span className="font-data-lg text-xs text-gray-500 group-hover:text-[#38bdf8] transition-colors">{log.time}</span>
                            
                            <div className="flex items-center gap-4">
                              <span className="text-white font-bold text-2xl">{unitName}</span>
                              <span className={`px-4 py-1.5 rounded-md text-xs font-bold text-white ${(STATUS_LEVELS as any)[log.status]?.color} flex items-center gap-2 shadow-md shrink-0`}>
                                <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                                {(STATUS_LEVELS as any)[log.status]?.label}
                              </span>
                            </div>

                            <div className="flex justify-between items-end">
                              <div className="flex flex-col">
                                {activeLogSubMenu === 'motor' && (
                                  <span className="text-gray-400 font-medium text-sm">{log.part || '-'}</span>
                                )}
                              </div>

                              <div className="flex items-baseline gap-2">
                                <span className="text-[10px] text-gray-600 font-bold uppercase whitespace-nowrap">이상 점수</span>
                                <span className={`font-data-lg text-3xl font-bold ${scoreTextClass}`}>
                                  {(log.score == null ? '-' : log.score.toFixed(3))}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="py-20 text-center opacity-20 flex flex-col items-center">
                        <span className="material-symbols-outlined text-6xl mb-4">history</span>
                        <p className="text-lg font-medium">선택한 호기의 로그 데이터가 존재하지 않습니다.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

const HeaderActions = () => {
  const [showAlerts, setShowAlerts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [alerts, setAlerts] = useState<Array<{ id: number; type: string; title: string; desc: string; time: string }>>([]);
  const realtimeTick = useRealtimeTick();

  useEffect(() => {
    apiRequest<ApiAlert[]>(`/api/alerts?limit=${ALERT_DROPDOWN_LIMIT}&sort=createdAt`)
      .then(list => setAlerts(list.slice(0, 5).map((alert, index) => ({
        id: alert.alertId || index + 1,
        type: normalizeSeverity(undefined, alert.severity || 'NORMAL'),
        title: alertSendTitle(alert),
        desc: readableAlertMessage(alert),
        time: formatCompactApiTime(alert.createdAt || alert.occurredAt),
      }))))
      .catch(() => undefined);
  }, [realtimeTick]);

  const applyTheme = (nextTheme: 'dark' | 'light') => {
    setTheme(nextTheme);
    document.documentElement.classList.toggle('light-mode', nextTheme === 'light');
  };

  return (
    <div className="flex items-center gap-2 relative">
      <div className="relative">
        <button
          onClick={() => {
            setShowAlerts(!showAlerts);
            setShowSettings(false);
            setShowProfile(false);
          }}
          className="relative p-2 hover:bg-white/5 transition-colors rounded-lg active:scale-95"
          title="Slack 알림"
        >
          <span className="material-symbols-outlined text-[#38bdf8]">notifications</span>
          {alerts.length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
          )}
        </button>
        <AnimatePresence>
          {showAlerts && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute right-0 top-12 w-80 bg-[#0f1418] border border-gray-800 rounded-2xl shadow-2xl z-[100] overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-white">Slack 알림</p>
                  <p className="text-[10px] text-gray-500">최근 알림 이력</p>
                </div>
                <span className="text-[10px] px-2 py-1 rounded-full bg-[#38bdf8]/10 text-[#38bdf8] font-bold">{alerts.length}</span>
              </div>
              <div className="max-h-72 overflow-y-auto custom-scrollbar">
                {alerts.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-gray-500">표시할 알림이 없습니다.</div>
                ) : alerts.map(alert => (
                  <div key={alert.id} className="px-4 py-3 border-b border-gray-800/50 hover:bg-white/[0.03] transition-colors">
                    <div className="flex justify-between gap-3 mb-1">
                      <span className={`text-[10px] font-bold ${alert.type === 'DANGER' ? 'text-red-400' : alert.type === 'WARNING' ? 'text-orange-400' : 'text-green-400'}`}>{alert.type}</span>
                      <span className="text-[10px] text-gray-500 font-mono">{alert.time}</span>
                    </div>
                    <p className="text-xs font-bold text-white">{alert.title}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{alert.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative">
        <button
          onClick={() => {
            setShowSettings(!showSettings);
            setShowAlerts(false);
            setShowProfile(false);
          }}
          className="p-2 hover:bg-white/5 transition-colors rounded-lg active:scale-95"
          title="화면 설정"
        >
          <span className="material-symbols-outlined text-[#38bdf8]">settings</span>
        </button>
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute right-0 top-12 w-48 bg-[#0f1418] border border-gray-800 rounded-2xl shadow-2xl z-[100] p-2"
            >
              <p className="px-3 py-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest">테마 설정</p>
              {(['dark', 'light'] as const).map(item => (
                <button
                  key={item}
                  onClick={() => applyTheme(item)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${theme === item ? 'bg-[#38bdf8]/10 text-[#38bdf8]' : 'text-gray-300 hover:bg-white/5'}`}
                >
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
          onClick={() => {
            setShowProfile(!showProfile);
            setShowAlerts(false);
            setShowSettings(false);
          }}
          className="w-9 h-9 rounded-xl bg-[#38bdf8] flex items-center justify-center text-[#001e2c] hover:brightness-110 transition-all active:scale-95 shadow-[0_0_14px_rgba(56,189,248,0.25)]"
          title="운영자 프로필"
        >
          <span className="material-symbols-outlined text-[20px]">person</span>
        </button>
        <AnimatePresence>
          {showProfile && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute right-0 top-12 w-56 bg-[#0f1418] border border-gray-800 rounded-2xl shadow-2xl z-[100] p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#38bdf8] flex items-center justify-center text-[#001e2c]">
                  <span className="material-symbols-outlined text-[20px]">person</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">관리자</p>
                  <p className="text-[11px] text-gray-400 mt-1">운영 관리자</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-800 text-[10px] text-gray-500">ROLE_ADMIN</div>
              <button
                onClick={emitLogout}
                className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-gray-800 px-3 py-2 text-xs font-bold text-gray-300 hover:border-[#38bdf8]/40 hover:text-[#38bdf8] transition-colors"
              >
                <span className="material-symbols-outlined text-sm">logout</span>
                로그아웃
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const OperationalStateDashboard = ({ plantId, initialGenId = 1, initialComp = 'motor', onBack, onNavigateToLogs, onSwitchPlant }: { plantId: string, initialGenId?: number, initialComp?: 'gasifier' | 'motor', onBack: () => void, onNavigateToLogs: () => void, onSwitchPlant: (id: string) => void }) => {
  const [activeTab, setActiveTab] = useState('A');
  const [activeGenId, setActiveGenId] = useState(initialGenId);
  const [activeMainComp, setActiveMainComp] = useState<'gasifier' | 'motor'>(initialComp);
  const [showGenList, setShowGenList] = useState(false);
  const [showCompList, setShowCompList] = useState(false);
  const [showGenSwitchList, setShowGenSwitchList] = useState(false);
  const [showPlantList, setShowPlantList] = useState(false);
  const [plants, setPlants] = useState<UiPlant[]>([]);
  const [equipments, setEquipments] = useState<ApiEquipment[]>([]);
  const [latestAnomaly, setLatestAnomaly] = useState<ApiAnomaly | null>(null);
  const [anomalyRows, setAnomalyRows] = useState<ApiAnomaly[]>([]);
  const [contributions, setContributions] = useState<ApiContribution[]>([]);
  const [sensorRows, setSensorRows] = useState<any[]>([]);
  const [sensorThresholds, setSensorThresholds] = useState<ApiThreshold[]>([]);
  const realtimeTick = useRealtimeTick();

  useEffect(() => {
    apiRequest<ApiPlant[]>('/api/plants')
      .then(apiPlants => {
        const mapped = apiPlants.map((plant, index) => ({
          ...getStaticPlantMeta(plant.plantName, index),
          id: String(plant.plantId),
          plantId: plant.plantId,
          name: plant.plantName,
          location: getStaticPlantMeta(plant.plantName, index).location,
          capacity: getStaticPlantMeta(plant.plantName, index).capacity,
          latitude: plant.latitude,
          longitude: plant.longitude,
          generationCount: plant.generationCount ?? 0,
        }));
        if (mapped.length > 0) setPlants(mapped);
      })
      .catch(() => undefined);
  }, []);

  const plant = plants.find(p => p.id === plantId) || plants[0] || { id: plantId, name: '발전본부 데이터 없음', location: '', capacity: '', generationCount: 0, top: 50, left: 50 };
  const numericPlantId = plant?.plantId || Number(plantId);
  const unitCount = Math.max(0, ...equipments.map(e => e.unitNo || 0));

  useEffect(() => {
    if (!numericPlantId || Number.isNaN(numericPlantId)) return;
    apiRequest<ApiEquipment[]>(`/api/equipments?plantId=${numericPlantId}`)
      .then(setEquipments)
      .catch(error => {
        console.error(error);
      });
  }, [numericPlantId]);

  const motorSensorGroups: Record<string, string[]> = {
    A: ['ii1211a', 'tt1228a', 'yi1593aa', 'tt1227a', 'yi1593ab', 'yi1594aa', 'yi1594ab'],
    B: ['ii1211b', 'tt1228b', 'yi1593ba', 'tt1227b', 'yi1593bb', 'yi1594ba', 'yi1594bb'],
    C: ['ii1442', 'tt1427', 'yi1483a', 'tt1428', 'yi1483b', 'yi1484a', 'yi1484b'],
    D: ['ii7140', 'tt7111', 'yi7364a', 'tt7100', 'yi7364b', 'yi7365a', 'yi7365b'],
    E: ['ii7145', 'tt7152', 'yi7358a', 'tt7151', 'yi7358b', 'yi7359a', 'yi7359b']
  };

  const motorSensorLabels: Record<string, string> = {
    A: 'MAC A',
    B: 'MAC B',
    C: 'BAC',
    D: 'DGAN',
    E: 'VHP'
  };

  const motorComponentNames: Record<string, string> = {
    A: 'MAC_A',
    B: 'MAC_B',
    C: 'BAC',
    D: 'DGAN',
    E: 'VHP'
  };

  const gasifierSensorGroups: Record<string, string[]> = {
    TUBE: ['tag_13tt0064', 'tag_15pdt0002a', 'tag_13pdt0067', 'tag_13fi0044', 'tag_13ffyc0046', 'tag_13fy0045', 'tag_13jyi9001', 'tag_10ind0001', 'bopc1_1_16200_fi_po041']
  };

  const gasifierSensorLabels: Record<string, string> = {
    TUBE: '튜브'
  };

  const sensorGroups = activeMainComp === 'motor' ? motorSensorGroups : gasifierSensorGroups;
  const sensorGroupsLabels = activeMainComp === 'motor' ? motorSensorLabels : gasifierSensorLabels;
  const activeGroupKey = sensorGroups[activeTab] ? activeTab : Object.keys(sensorGroups)[0];
  const activeSensors = sensorGroups[activeGroupKey];
  const activeMotorComponentName = activeMainComp === 'motor' ? motorComponentNames[activeGroupKey] : undefined;
  const activeEquipment = equipments.find(e => e.unitNo === activeGenId && (activeMainComp === 'motor' ? e.equipmentType === 'MOTOR' : e.equipmentType === 'TUBE'));

  useEffect(() => {
    if (!activeEquipment) {
      setLatestAnomaly(null);
      setAnomalyRows([]);
      setContributions([]);
      setSensorRows([]);
      setSensorThresholds([]);
      return;
    }

    let cancelled = false;
    const loadEquipmentData = async () => {
      try {
        const anomalyLimitQuery = `limit=${DETAIL_ANOMALY_LIMIT}`;
        const anomalyPath = activeMotorComponentName
          ? `/api/equipments/${activeEquipment.equipmentId}/anomalies?component=${encodeURIComponent(activeMotorComponentName)}&${anomalyLimitQuery}`
          : `/api/equipments/${activeEquipment.equipmentId}/anomalies?${anomalyLimitQuery}`;
        const [anomalies, sensors, thresholds] = await Promise.all([
          apiRequest<ApiAnomaly[]>(anomalyPath),
          apiRequest<ApiSensorRow[]>(`/api/equipments/${activeEquipment.equipmentId}/sensor-data?limit=${SENSOR_DATA_LIMIT}`),
          apiRequest<ApiThreshold[]>(`/api/equipments/${activeEquipment.equipmentId}/sensor-thresholds`),
        ]);
        if (cancelled) return;

        const sorted = sortAnomaliesDesc(anomalies);
        const latest = sorted[0] || null;
        setAnomalyRows(sorted);
        setLatestAnomaly(latest);
        setSensorRows(sensors);
        setSensorThresholds(thresholds);

        if (latest) {
          try {
            const list = await apiRequest<ApiContribution[]>(`/api/equipments/${activeEquipment.equipmentId}/anomalies/${latest.anomalyResultId}/contributions`);
            const visibleList = activeMainComp === 'motor'
              ? list.filter(item => activeSensors.includes(item.sensorTag))
              : list;
            if (!cancelled) setContributions(visibleList);
          } catch (error) {
            console.error(error);
          }
        } else {
          setContributions([]);
        }
      } catch (error) {
        if (cancelled) return;
        console.error(error);
      }
    };

    loadEquipmentData();
    return () => {
      cancelled = true;
    };
  }, [activeEquipment?.equipmentId, activeMainComp, activeGroupKey, activeMotorComponentName, realtimeTick]);

  const componentLabel = activeMainComp === 'motor' ? '고압전동기' : '가스화기';
  const graphLabel = activeMainComp === 'motor' ? '통합 이상 수치 추이' : '가스화기 튜브 이상 수치 추이';
  const eventDescPrefix = activeMainComp === 'motor' ? sensorGroupsLabels[activeGroupKey] : '가스화기 튜브';
  const latestSensor = latestSensorRow(sensorRows);
  const sensorDisplayNameMap = useMemo(() => {
    const entries = sensorThresholds
      .map(item => [item.sensorTag || item.tag, item.displayName] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[0] && entry[1]));
    return new Map(entries);
  }, [sensorThresholds]);
  const getSensorDisplayName = (tag: string) => sensorDisplayNameMap.get(tag) || tag;
  const trendData = chartDataFromAnomalies(anomalyRows);
  const trendScrollKey = `${activeMainComp}:${activeEquipment?.equipmentId || 'none'}:${activeGroupKey}`;
  const currentSeverity = normalizeSeverity(latestAnomaly?.anomalyScore, latestAnomaly?.severity);
  const showContribution = currentSeverity !== 'NORMAL';
  const operationState = useMemo(() => {
    const currentTag = activeMainComp === 'motor' ? activeSensors[0] : undefined;
    const currentSeries = currentTag
      ? sensorRows
          .map(row => ({
            time: row.measuredAt ? new Date(row.measuredAt).getTime() : 0,
            value: sensorValueFromRow(row, currentTag),
          }))
          .filter((row): row is { time: number; value: number } => typeof row.value === 'number')
          .sort((a, b) => b.time - a.time)
      : [];

    const latestCurrentRaw = currentSeries[0]?.value;
    const latestCurrent = latestCurrentRaw == null ? undefined : Math.max(0, latestCurrentRaw);
    const baseline = currentSeries[Math.min(29, currentSeries.length - 1)]?.value;
    const measuredChangePercent = baseline && baseline > 0 && latestCurrentRaw != null
      ? ((latestCurrentRaw - baseline) / baseline) * 100
      : undefined;

    const stateEvent = anomalyRows.find(event => {
      const eventType = (event.eventType || '').toUpperCase();
      return ['STOP', 'LOAD_CHANGE', 'TREND_CHANGE'].includes(eventType);
    }) || latestAnomaly;
    const eventType = (stateEvent?.eventType || '').toUpperCase();
    const eventPercent = percentFromDescription(stateEvent?.description);
    const changePercent = eventPercent ?? measuredChangePercent;
    const severity = normalizeSeverity(stateEvent?.anomalyScore, stateEvent?.severity);

    if (eventType === 'STOP' || (latestCurrentRaw != null && latestCurrentRaw <= 0)) {
      return {
        badge: '정지 감지',
        center: '정지',
        state: '정지',
        change: latestCurrent == null ? '-' : `${latestCurrent.toFixed(2)} A`,
        color: '#64748b',
        lineClass: 'rotate-0',
      };
    }

    if (eventType === 'LOAD_CHANGE') {
      return {
        badge: '부하 급변',
        center: '변동',
        state: '부하 급변',
        change: formatSignedPercent(changePercent),
        color: '#ffbd45',
        lineClass: changePercent != null && changePercent < 0 ? 'rotate-[45deg]' : 'rotate-[-45deg]',
      };
    }

    if (eventType === 'TREND_CHANGE') {
      return {
        badge: '추세 변화',
        center: '추세',
        state: changePercent != null && changePercent < 0 ? '하강 추세' : '상승 추세',
        change: formatSignedPercent(changePercent),
        color: '#38bdf8',
        lineClass: changePercent != null && changePercent < 0 ? 'rotate-[45deg]' : 'rotate-[-45deg]',
      };
    }

    if (severity === 'DANGER' || severity === 'WARNING') {
      return {
        badge: severity === 'DANGER' ? '위험 패턴' : '주의 패턴',
        center: severity === 'DANGER' ? '위험' : '주의',
        state: stateEvent?.eventType || severity,
        change: formatSignedPercent(changePercent),
        color: severity === 'DANGER' ? '#ff8181' : '#ffbd45',
        lineClass: 'rotate-[-45deg]',
      };
    }

    return {
      badge: '정상 추적',
      center: '정상',
      state: '정상',
      change: formatSignedPercent(changePercent),
      color: '#38bdf8',
      lineClass: changePercent != null && changePercent < 0 ? 'rotate-[45deg]' : 'rotate-[-45deg]',
    };
  }, [activeMainComp, activeSensors, anomalyRows, latestAnomaly, sensorRows]);

  const contributionPanel = (
    <section className="rounded-2xl p-5 border border-gray-800/50 bg-black/20 dashboard-card h-full">
      <h3 className="text-xs font-bold text-[#38bdf8] uppercase mb-5 tracking-[0.12em]">센서 기여도 (TOP 3)</h3>
      {currentSeverity === 'NORMAL' ? (
        <div className="h-full min-h-[90px] flex items-center justify-center text-center rounded-xl border border-dashed border-white/[0.06] bg-white/[0.02] px-4">
          <p className="text-xs font-bold text-gray-500">정상 상태에서는 기여도 데이터가 표시되지 않습니다.</p>
        </div>
      ) : contributions.length === 0 ? (
        <div className="h-full min-h-[90px] flex items-center justify-center text-center rounded-xl border border-dashed border-white/[0.06] bg-white/[0.02] px-4">
          <p className="text-xs font-bold text-gray-500">센서 기여도 데이터가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {contributions.slice(0, 3).map((item, i) => {
            const score = item.contributionScore ?? 0;
            return (
              <div key={item.sensorTag} className="grid grid-cols-[20px_80px_1fr_74px] items-center gap-3 text-[11px]">
                <span className="text-white font-bold">{i + 1}</span>
                <span className="text-gray-400 truncate font-mono">{(item.displayName || item.sensorTag).replace('tag_', '')}</span>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: String(Math.round(score * 100)) + '%' }} transition={{ duration: 1, ease: 'easeOut' }} className="h-full bg-[#38bdf8] rounded-full shadow-[0_0_8px_#38bdf8/25]"></motion.div>
                </div>
                <span className="text-right text-white font-mono">{score.toFixed(2)} ({Math.round(score * 100)}%)</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  const eventTimeline = (
    <section className="rounded-2xl border border-gray-800/50 bg-black/20 overflow-hidden dashboard-card h-full flex flex-col">
      <header className="p-4 border-b border-gray-800/30">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">이벤트 타임라인</h3>
      </header>
      <div className="p-4 custom-scrollbar text-[11px] space-y-6 overflow-y-auto">
        {anomalyRows.length === 0 ? (
          <div className="h-24 flex items-center justify-center text-gray-500 text-xs border border-dashed border-white/[0.06] rounded-xl">이벤트 데이터가 없습니다.</div>
        ) : (
          <div className="relative border-l border-gray-800 pl-4 ml-1 space-y-6">
            {anomalyRows.slice(0, 8).map(event => {
              const severity = normalizeSeverity(event.anomalyScore, event.severity);
              const color = severity === 'DANGER' ? '#ff8181' : severity === 'WARNING' ? '#ffbd45' : '#38bdf8';
              return (
                <div key={event.anomalyResultId} className="relative">
                  <div className="absolute -left-[21px] top-1 w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
                  <span className="font-mono" style={{ color }}>{formatApiTime(event.measuredAt)}</span>
                  <p className="font-bold text-white mt-1">{event.eventType || severity}</p>
                  <p className="opacity-60 text-gray-400">{eventDescPrefix} {event.description || ('이상 점수 ' + event.anomalyScore.toFixed(3))}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );

  const handleCompChange = (comp: 'motor' | 'gasifier') => {
    setActiveMainComp(comp);
    setActiveTab(comp === 'motor' ? 'A' : 'TUBE');
    setShowCompList(false);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0f12] text-[#dee3e8] font-sans overflow-hidden dashboard-shell">
      <header className="flex justify-between items-center px-margin h-16 w-full z-50 bg-[#0f1418] border-b border-gray-800 shrink-0 dashboard-header">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-surface-container-highest rounded-lg mr-2 transition-colors active:scale-95">
            <span className="material-symbols-outlined">grid_view</span>
          </button>
          <span className="font-display-lg text-headline-md font-bold text-[#38bdf8] tracking-wider uppercase">KOWEPO</span>
          <div className="h-6 w-[1px] bg-gray-700"></div>
          <div className="flex items-center gap-2 font-headline-md text-title-sm text-white">
            <div className="relative">
              <button onClick={() => setShowPlantList(!showPlantList)} className="flex items-center gap-2 hover:text-[#38bdf8] transition-colors">
                {plant.name}
                <span className={`material-symbols-outlined text-sm transition-transform ${showPlantList ? 'rotate-180' : ''}`}>expand_more</span>
              </button>
              <AnimatePresence>
                {showPlantList && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full left-0 mt-2 w-48 bg-[#0f1418] border border-gray-800 rounded-xl overflow-hidden py-2 z-[60] shadow-2xl">
                    {plants.map(p => (
                      <button key={p.id} className={`w-full text-left px-4 py-2 text-sm hover:bg-[#38bdf8]/20 transition-colors ${p.id === plantId ? 'text-[#38bdf8] bg-[#38bdf8]/10' : 'text-white'}`} onClick={() => { onSwitchPlant(p.id); setShowPlantList(false); }}>
                        {p.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="text-gray-600 mx-1">|</span>
            <div className="relative">
              <button onClick={() => setShowGenSwitchList(!showGenSwitchList)} className="flex items-center gap-1 hover:text-[#38bdf8] transition-colors text-white">
                발전기
                <span className={`material-symbols-outlined text-xs transition-transform ${showGenSwitchList ? 'rotate-180' : ''}`}>expand_more</span>
              </button>
              <AnimatePresence>
                {showGenSwitchList && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full left-0 mt-2 w-32 bg-[#0f1418] border border-gray-800 rounded-xl overflow-hidden py-2 z-[60] shadow-2xl">
                    {[{ label: '발전기', action: onBack }, { label: '운영 로그', action: onNavigateToLogs }].map(item => (
                      <button key={item.label} className="w-full text-left px-4 py-2 text-xs hover:bg-[#38bdf8]/20 transition-colors text-white" onClick={() => { item.action(); setShowGenSwitchList(false); }}>
                        {item.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="text-gray-600 mx-1">|</span>
            <div className="relative">
              <button onClick={() => setShowGenList(!showGenList)} className="flex items-center gap-1 hover:text-[#38bdf8] transition-colors text-white">
                제 {activeGenId}호기
                <span className={`material-symbols-outlined text-xs transition-transform ${showGenList ? 'rotate-180' : ''}`}>expand_more</span>
              </button>
              <AnimatePresence>
                {showGenList && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full left-0 mt-2 w-32 bg-[#0f1418] border border-gray-800 rounded-xl overflow-hidden py-2 z-[60] shadow-2xl">
                    {Array.from({ length: unitCount }).map((_, i) => (
                      <button key={i} className={`w-full text-left px-4 py-2 text-xs hover:bg-[#38bdf8]/20 transition-colors ${activeGenId === (i + 1) ? 'text-[#38bdf8] bg-[#38bdf8]/10' : 'text-white'}`} onClick={() => { setActiveGenId(i + 1); setShowGenList(false); }}>
                        제 {i + 1}호기
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="text-gray-600 mx-1">|</span>
            <div className="relative">
              <button onClick={() => setShowCompList(!showCompList)} className="flex items-center gap-1 hover:text-[#38bdf8] transition-colors text-white">
                {componentLabel}
                <span className={`material-symbols-outlined text-xs transition-transform ${showCompList ? 'rotate-180' : ''}`}>expand_more</span>
              </button>
              <AnimatePresence>
                {showCompList && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full left-0 mt-2 w-32 bg-[#0f1418] border border-gray-800 rounded-xl overflow-hidden py-2 z-[60] shadow-2xl">
                    {[{ id: 'gasifier', label: '가스화기' }, { id: 'motor', label: '고압전동기' }].map(comp => (
                      <button key={comp.id} className={`w-full text-left px-4 py-2 text-xs hover:bg-[#38bdf8]/20 transition-colors ${activeMainComp === comp.id ? 'text-[#38bdf8] bg-[#38bdf8]/10' : 'text-white'}`} onClick={() => handleCompChange(comp.id as 'gasifier' | 'motor')}>
                        {comp.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <span className="font-data-lg text-title-sm text-[#38bdf8]">2024.05.22 14:30:45 KST</span>
          <HeaderActions />
        </div>
      </header>

      <nav className="flex px-8 bg-[#0f1418] border-b border-gray-800/50 dashboard-tabbar">
        {Object.keys(sensorGroups).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-8 py-5 text-sm font-bold transition-all relative ${activeGroupKey === tab ? 'text-[#38bdf8]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
            {sensorGroupsLabels[tab]}
            {activeGroupKey === tab && <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-1 bg-[#38bdf8] shadow-[0_0_10px_#38bdf8]" />}
          </button>
        ))}
      </nav>

      <div className="flex flex-1 overflow-hidden p-4 gap-4 dashboard-content">
        {activeMainComp === 'gasifier' ? (
          <>
            <main className="w-[52%] flex flex-col gap-4">
              <section className="flex-1 bg-[#171c20]/80 rounded-2xl p-8 border border-gray-800/50 relative shadow-2xl overflow-hidden group dashboard-card">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold mb-1 font-headline-md text-[#38bdf8]">{graphLabel}</h2>
                    <p className="text-xs text-on-surface-variant/60 font-medium">{componentLabel} - {sensorGroupsLabels[activeGroupKey]} 분석 데이터</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="material-symbols-outlined text-sm text-[#38bdf8] animate-pulse">sensors</span>
                    <span className="text-[10px] font-bold text-[#38bdf8] tracking-widest uppercase">실시간 추적 중</span>
                  </div>
                </div>
                <div className="mt-8 h-[72%] relative rounded-xl overflow-hidden border border-gray-800/30 bg-black/10 p-4">
                  {trendData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-gray-500">이상 수치 데이터가 없습니다.</div>
                  ) : (
                    <ScrollableAnomalyTrendChart data={trendData} yMax={TUBE_TREND_Y_MAX} scrollKey={trendScrollKey} />
                  )}
                  <div className="absolute right-5 top-5 text-right">
                    <p className="font-data-lg text-4xl font-bold text-[#38bdf8]">{latestAnomaly?.anomalyScore == null ? '-' : latestAnomaly.anomalyScore.toFixed(3)}</p>
                    <span className="text-[11px] px-3 py-1 rounded-full bg-[#38bdf8]/10 text-[#38bdf8] font-bold">{currentSeverity}</span>
                  </div>
                </div>
              </section>

              <section className="h-[34%] min-h-[210px] bg-[#171c20]/50 rounded-2xl p-5 border border-gray-800/50 flex flex-col dashboard-card">
                <div className="flex-1 rounded-xl border border-dashed border-gray-700/70 bg-white/[0.02] overflow-hidden flex items-center justify-center">
                  <img src={TUBE_DIAGRAM_SRC} alt="가스화기 튜브 도면" className="w-full h-full object-contain" />
                </div>
              </section>
            </main>

            <aside className="w-[22%] flex flex-col gap-4 min-h-0">
              <div className="flex-[1.15] min-h-0">{eventTimeline}</div>
              <div className="flex-[0.85] min-h-0">{contributionPanel}</div>
            </aside>

            <aside className="w-[26%] flex flex-col gap-4 bg-[#171c20]/50 rounded-2xl p-5 border border-gray-800/50 h-full overflow-hidden dashboard-card">
              <section className="flex flex-col min-h-0 flex-1">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold text-[#38bdf8] uppercase tracking-[0.2em]">실시간 센서 현황</h3>
                  <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-white/40 font-mono">개수: {activeSensors.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {activeSensors.map((tag, i) => (
                    <div key={tag} className="p-4 bg-black/40 rounded-xl border border-white/[0.03] flex flex-col gap-3 hover:border-[#38bdf8]/30 transition-all hover:bg-black/60 group sensor-card">
                      <div className="flex justify-between items-end">
                        <span className="font-mono text-[11px] text-[#38bdf8]/70 group-hover:text-[#38bdf8] transition-colors">{getSensorDisplayName(tag)}</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-white font-data-lg text-lg tracking-tighter">{displaySensorValue(latestSensor, tag, activeMainComp === 'motor') == null ? '-' : displaySensorValue(latestSensor, tag, activeMainComp === 'motor')!.toFixed(2)}</span>
                          <span className="text-[9px] text-gray-600 font-bold uppercase whitespace-nowrap">현재값</span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full relative overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, Number(displaySensorValue(latestSensor, tag, activeMainComp === 'motor') ?? 0)))}%` }} className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#38bdf8]/10 to-[#38bdf8]/40 shadow-[0_0_8px_#38bdf8/20]"></motion.div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </>
        ) : (
          <>
            <main className="min-w-0 flex-1 flex flex-col gap-4">
              <section className="min-w-0 flex-1 bg-[#171c20]/80 rounded-2xl p-8 border border-gray-800/50 relative shadow-2xl overflow-hidden group dashboard-card">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold mb-1 font-headline-md text-[#38bdf8]">{graphLabel}</h2>
                    <p className="text-xs text-on-surface-variant/60 font-medium">{componentLabel} - {sensorGroupsLabels[activeGroupKey]} 분석 데이터</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="material-symbols-outlined text-sm text-[#38bdf8] animate-pulse">sensors</span>
                    <span className="text-[10px] font-bold text-[#38bdf8] tracking-widest uppercase">실시간 추적 중</span>
                  </div>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-700">
                  <span className="material-symbols-outlined text-[320px]">monitoring</span>
                </div>
                <div className="mt-12 w-full min-w-0 h-[75%] px-2 relative z-10 overflow-hidden">
                  {trendData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-gray-500">이상 수치 데이터가 없습니다.</div>
                  ) : (
                    <ScrollableAnomalyTrendChart data={trendData} yMax={1} scrollKey={trendScrollKey} />
                  )}
                </div>
              </section>

              <div className="h-[30%] flex gap-4 min-h-[180px]">
                <div className="w-2/5">{contributionPanel}</div>

                <section className="w-3/5 bg-[#171c20]/50 rounded-2xl p-5 border border-[#38bdf8]/30 relative overflow-hidden flex flex-col dashboard-card">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-bold text-[#38bdf8] uppercase tracking-widest">운전 상태 변화</h3>
                    <span
                      className="text-[9px] px-2 py-0.5 rounded font-bold"
                      style={{ backgroundColor: `${operationState.color}1a`, color: operationState.color }}
                    >
                      {operationState.badge}
                    </span>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <div
                      className="relative w-24 h-24 border rounded-full flex items-center justify-center"
                      style={{ borderColor: `${operationState.color}55` }}
                    >
                      <div
                        className="absolute w-10 h-10 rounded-full border italic flex items-center justify-center text-[7px] font-bold"
                        style={{
                          backgroundColor: `${operationState.color}0d`,
                          borderColor: `${operationState.color}33`,
                          color: operationState.color,
                        }}
                      >
                        {operationState.center}
                      </div>
                      <div
                        className="absolute top-3 right-6 w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: operationState.color,
                          boxShadow: `0 0 10px ${operationState.color}`,
                        }}
                      ></div>
                      <div
                        className={`absolute w-10 h-[1px] origin-left ml-5 mt-[-10px] ${operationState.lineClass}`}
                        style={{ background: `linear-gradient(to right, transparent, ${operationState.color})` }}
                      ></div>
                    </div>
                    <div className="ml-6 space-y-2">
                      <p className="text-[10px] text-gray-400 font-bold">변화 크기: <span className="text-white">{operationState.change}</span></p>
                      <p className="text-[10px] text-gray-400 font-bold">현재 상태: <span className="text-white">{operationState.state}</span></p>
                    </div>
                  </div>
                </section>
              </div>
            </main>

            <aside className="w-[30%] shrink-0 flex flex-col gap-4 bg-[#171c20]/50 rounded-2xl p-5 border border-gray-800/50 h-full overflow-hidden dashboard-card">
              <section className="flex flex-col min-h-0 flex-1">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold text-[#38bdf8] uppercase tracking-[0.2em]">실시간 센서 현황</h3>
                  <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-white/40 font-mono">개수: {activeSensors.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {activeSensors.map((tag, i) => (
                    <div key={tag} className="p-4 bg-black/40 rounded-xl border border-white/[0.03] flex flex-col gap-3 hover:border-[#38bdf8]/30 transition-all hover:bg-black/60 group sensor-card">
                      <div className="flex justify-between items-end">
                        <span className="font-mono text-[11px] text-[#38bdf8]/70 group-hover:text-[#38bdf8] transition-colors">{getSensorDisplayName(tag)}</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-white font-data-lg text-lg tracking-tighter">{displaySensorValue(latestSensor, tag, activeMainComp === 'motor') == null ? '-' : displaySensorValue(latestSensor, tag, activeMainComp === 'motor')!.toFixed(2)}</span>
                          <span className="text-[9px] text-gray-600 font-bold uppercase whitespace-nowrap">현재값</span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full relative overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, Number(displaySensorValue(latestSensor, tag, activeMainComp === 'motor') ?? 0)))}%` }} className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#38bdf8]/10 to-[#38bdf8]/40 shadow-[0_0_8px_#38bdf8/20]"></motion.div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <div className="flex-1 min-h-0">{eventTimeline}</div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const initialAccessToken = (() => {
    return getStoredAccessToken();
  })();
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(initialAccessToken));
  const [view, setView] = useState<'login' | 'dashboard' | 'detail' | 'motor_detail'>(initialAccessToken ? 'dashboard' : 'login');
  const [activePlantId, setActivePlantId] = useState('taean');
  const [activeGeneratorId, setActiveGeneratorId] = useState(1);
  const [detailActiveMenu, setDetailActiveMenu] = useState<'generators' | 'logs'>('generators');

  const [activeComp, setActiveComp] = useState<'motor' | 'gasifier'>('motor');

  useEffect(() => {
    const handleLogout = () => {
      setIsLoggedIn(false);
      setView('login');
      setActivePlantId('taean');
      setActiveGeneratorId(1);
      setDetailActiveMenu('generators');
      setActiveComp('motor');
    };

    window.addEventListener(AUTH_LOGOUT_EVENT, handleLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, handleLogout);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    const eventSource = new EventSource(`${API_BASE_URL}/api/events/stream`);
    eventSource.onmessage = () => emitRealtimeUpdate();
    eventSource.addEventListener('realtime-update', () => emitRealtimeUpdate());
    eventSource.onerror = () => undefined;

    return () => eventSource.close();
  }, [isLoggedIn]);

  const handleLogin = async (username: string, password: string) => {
    try {
      clearStoredToken();
      const response = await apiRequest<{ accessToken?: string; token?: string; refreshToken?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      const token = response.accessToken || response.token;
      if (!token) {
        alert('로그인 응답에 토큰이 없습니다.');
        return;
      }
      localStorage.setItem('accessToken', token);
      if (response.refreshToken) localStorage.setItem('refreshToken', response.refreshToken);
      setIsLoggedIn(true);
      setView('dashboard');
    } catch (error) {
      console.error(error);
      alert('로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요.');
    }
  };

  const handleNavigateToDetail = (plantId: string, menu: 'generators' | 'logs' = 'generators') => {
    setActivePlantId(plantId);
    setDetailActiveMenu(menu);
    setView('detail');
  };

  const handleNavigateToDashboard = (genId: number, comp: 'motor' | 'gasifier') => {
    setActiveGeneratorId(genId);
    setActiveComp(comp);
    setView('motor_detail');
  };

  return (
    <AnimatePresence mode="wait">
      {view === 'login' ? (
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <LoginPage onLogin={handleLogin} />
        </motion.div>
      ) : view === 'dashboard' ? (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="h-screen w-full overflow-hidden"
        >
          <DashboardPage onNavigateToDetail={(id) => handleNavigateToDetail(id, 'generators')} />
        </motion.div>
      ) : view === 'detail' ? (
        <motion.div
          key="detail"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.4 }}
          className="h-screen w-full overflow-hidden"
        >
          <PlantDetailPage 
            plantId={activePlantId} 
            initialMenu={detailActiveMenu}
            onBack={() => setView('dashboard')} 
            onSwitchPlant={(id) => setActivePlantId(id)}
            onNavigateToDashboard={handleNavigateToDashboard}
          />
        </motion.div>
      ) : (
        <motion.div
          key="motor_detail"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4 }}
          className="h-screen w-full overflow-hidden"
        >
          <OperationalStateDashboard 
            plantId={activePlantId} 
            initialGenId={activeGeneratorId}
            initialComp={activeComp}
            onBack={() => setView('detail')} 
            onNavigateToLogs={() => handleNavigateToDetail(activePlantId, 'logs')}
            onSwitchPlant={(id) => setActivePlantId(id)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
