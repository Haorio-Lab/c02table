"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type PhaseType = "prepare" | "hold" | "rest";
type Phase = { type: PhaseType; seconds: number; round: number };
type PresetKey = "first" | "steady" | "long";
type Session = {
  date: string;
  preset: string;
  completed: number;
  total: number;
  duration?: number;
  status?: "completed" | "stopped";
};
type SessionResult = {
  status: "completed" | "stopped";
  completed: number;
  total: number;
  duration: number;
};
type WakeLockLike = { release: () => Promise<void> };

const PREPARE_SECONDS = 15;
const HISTORY_KEY = "co2-history";

const APP_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "BREATHLINE CO₂ 테이블",
  url: "https://co2table.haorio.com/",
  applicationCategory: "HealthApplication",
  operatingSystem: "Web",
  inLanguage: "ko-KR",
  description: "초보 프리다이버를 위한 물 밖 전용 CO₂ 테이블 숨참기 훈련 타이머",
  offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
  featureList: ["CO₂ 테이블 타이머", "초보자용 훈련 설정", "기기 내 훈련 기록", "드라이 훈련 안전 안내"],
};

const PRESETS: Record<
  PresetKey,
  { label: string; eyebrow: string; hold: number; rest: number; rounds: number; step: number }
> = {
  first: {
    label: "30초 테이블",
    eyebrow: "처음이라면 추천",
    hold: 30,
    rest: 90,
    rounds: 6,
    step: 10,
  },
  steady: {
    label: "45초 테이블",
    eyebrow: "차분한 기본 리듬",
    hold: 45,
    rest: 105,
    rounds: 8,
    step: 10,
  },
  long: {
    label: "60초 테이블",
    eyebrow: "익숙해진 뒤 선택",
    hold: 60,
    rest: 120,
    rounds: 8,
    step: 15,
  },
};

const formatTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0")}:${(safeSeconds % 60).toString().padStart(2, "0")}`;
};

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}분 ${rest}초` : `${minutes}분`;
};

const phaseName = (type: PhaseType) => {
  if (type === "prepare") return "준비 호흡";
  if (type === "hold") return "숨 참기";
  return "편안히 호흡";
};

const validHistory = (value: unknown): Session[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Session => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<Session>;
      return (
        typeof candidate.date === "string" &&
        !Number.isNaN(Date.parse(candidate.date)) &&
        typeof candidate.preset === "string" &&
        typeof candidate.completed === "number" &&
        typeof candidate.total === "number"
      );
    })
    .slice(0, 8);
};

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  step,
  display,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="stepper">
      <div>
        <span>{label}</span>
        <small>{hint}</small>
      </div>
      <div className="stepper-controls">
        <button
          type="button"
          aria-label={`${label} 줄이기`}
          disabled={disabled || value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
        >
          −
        </button>
        <strong>{display}</strong>
        <button
          type="button"
          aria-label={`${label} 늘리기`}
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey | "custom">("first");
  const [holdSeconds, setHoldSeconds] = useState(PRESETS.first.hold);
  const [startRest, setStartRest] = useState(PRESETS.first.rest);
  const [rounds, setRounds] = useState(PRESETS.first.rounds);
  const [restStep, setRestStep] = useState(PRESETS.first.step);
  const [safe, setSafe] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [remaining, setRemaining] = useState(PREPARE_SECONDS);
  const [history, setHistory] = useState<Session[]>([]);
  const [result, setResult] = useState<SessionResult | null>(null);

  const deadlineRef = useRef<number | null>(null);
  const pausedMillisecondsRef = useRef(0);
  const completedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockLike | null>(null);

  const tableRows = useMemo(
    () =>
      Array.from({ length: rounds }, (_, index) => ({
        round: index + 1,
        hold: holdSeconds,
        rest: index === rounds - 1 ? null : Math.max(30, startRest - index * restStep),
      })),
    [holdSeconds, restStep, rounds, startRest],
  );

  const phases = useMemo<Phase[]>(() => {
    const next: Phase[] = [{ type: "prepare", seconds: PREPARE_SECONDS, round: 0 }];
    tableRows.forEach((row) => {
      next.push({ type: "hold", seconds: row.hold, round: row.round });
      if (row.rest !== null) next.push({ type: "rest", seconds: row.rest, round: row.round });
    });
    return next;
  }, [tableRows]);

  const phase = phases[phaseIndex] ?? phases[0];
  const totalSeconds = useMemo(
    () => phases.reduce((sum, item) => sum + item.seconds, 0),
    [phases],
  );
  const elapsedBefore = useMemo(
    () => phases.slice(0, phaseIndex).reduce((sum, item) => sum + item.seconds, 0),
    [phaseIndex, phases],
  );
  const elapsedSeconds = Math.min(
    totalSeconds,
    elapsedBefore + Math.max(0, phase.seconds - remaining),
  );
  const overallProgress = result ? 100 : (elapsedSeconds / totalSeconds) * 100;
  const phaseProgress = running ? Math.max(0, Math.min(1, remaining / phase.seconds)) : 1;
  const sessionLabel =
    selectedPreset === "custom" ? "나만의 테이블" : PRESETS[selectedPreset].label;

  const persistHistory = useCallback((entry: Session) => {
    setHistory((current) => {
      const next = [entry, ...current].slice(0, 8);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // The session still completes when browser storage is unavailable.
      }
      return next;
    });
  }, []);

  const releaseWakeLock = useCallback(() => {
    const wakeLock = wakeLockRef.current;
    wakeLockRef.current = null;
    if (wakeLock) void wakeLock.release().catch(() => undefined);
  }, []);

  const requestWakeLock = useCallback(async () => {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> };
    };
    if (!nav.wakeLock || document.visibilityState !== "visible") return;
    try {
      wakeLockRef.current = await nav.wakeLock.request("screen");
    } catch {
      wakeLockRef.current = null;
    }
  }, []);

  const playTone = useCallback(
    (frequency: number, duration = 0.1) => {
      if (!soundOn) return;
      try {
        const context = audioContextRef.current ?? new AudioContext();
        audioContextRef.current = context;
        void context.resume();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.13, context.currentTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + duration + 0.02);
      } catch {
        // Audio cues are optional.
      }
    },
    [soundOn],
  );

  const finishSession = useCallback(
    (status: "completed" | "stopped", completed: number, duration: number) => {
      if (completedRef.current) return;
      completedRef.current = true;
      const nextResult = { status, completed, total: rounds, duration };
      setRunning(false);
      setPaused(false);
      setRemaining(0);
      setResult(nextResult);
      releaseWakeLock();
      if (completed > 0) {
        persistHistory({
          date: new Date().toISOString(),
          preset: sessionLabel,
          completed,
          total: rounds,
          duration,
          status,
        });
      }
      playTone(status === "completed" ? 780 : 360, 0.2);
    },
    [persistHistory, playTone, releaseWakeLock, rounds, sessionLabel],
  );

  useEffect(() => {
    const hydratePreferences = window.setTimeout(() => {
      try {
        setHistory(validHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]")));
        const storedSound = localStorage.getItem("co2-sound");
        if (storedSound !== null) setSoundOn(storedSound === "true");
      } catch {
        setHistory([]);
      }
    }, 0);
    return () => window.clearTimeout(hydratePreferences);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("co2-sound", String(soundOn));
    } catch {
      // Sound preference can remain session-only.
    }
  }, [soundOn]);

  useEffect(() => {
    if (!running || paused || !deadlineRef.current) return;

    const sync = () => {
      const now = Date.now();
      let cursor = phaseIndex;
      let deadline = deadlineRef.current ?? now;

      while (now >= deadline && cursor < phases.length - 1) {
        cursor += 1;
        deadline += phases[cursor].seconds * 1000;
      }

      if (now >= deadline && cursor === phases.length - 1) {
        finishSession("completed", rounds, totalSeconds);
        return;
      }

      deadlineRef.current = deadline;
      if (cursor !== phaseIndex) setPhaseIndex(cursor);
      setRemaining(Math.max(0, Math.ceil((deadline - now) / 1000)));
    };

    sync();
    const timer = window.setInterval(sync, 200);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        sync();
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [finishSession, paused, phaseIndex, phases, requestWakeLock, rounds, running, totalSeconds]);

  useEffect(() => {
    if (!running || paused) return;
    if (remaining > 0 && remaining <= 3) playTone(remaining === 1 ? 660 : 480, 0.08);
  }, [paused, playTone, remaining, running]);

  useEffect(() => {
    if (!running) return;
    playTone(phase.type === "hold" ? 720 : phase.type === "rest" ? 430 : 560, 0.14);
  }, [phase.type, phaseIndex, playTone, running]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.code !== "Space" ||
        !running ||
        target?.matches("button, input, textarea, select, a")
      )
        return;
      event.preventDefault();
      const milliseconds = pausedMillisecondsRef.current;
      if (paused) {
        deadlineRef.current = Date.now() + milliseconds;
        setPaused(false);
      } else {
        pausedMillisecondsRef.current = Math.max(
          0,
          (deadlineRef.current ?? Date.now()) - Date.now(),
        );
        setPaused(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paused, running]);

  useEffect(() => () => releaseWakeLock(), [releaseWakeLock]);

  const applyPreset = (key: PresetKey) => {
    if (running) return;
    const next = PRESETS[key];
    setSelectedPreset(key);
    setHoldSeconds(next.hold);
    setStartRest(next.rest);
    setRounds(next.rounds);
    setRestStep(next.step);
    setResult(null);
    setPhaseIndex(0);
    setRemaining(PREPARE_SECONDS);
  };

  const customize = (setter: (value: number) => void, value: number) => {
    setter(value);
    setSelectedPreset("custom");
    setResult(null);
    setPhaseIndex(0);
    setRemaining(PREPARE_SECONDS);
  };

  const start = () => {
    completedRef.current = false;
    setResult(null);
    setPhaseIndex(0);
    setRemaining(PREPARE_SECONDS);
    setPaused(false);
    deadlineRef.current = Date.now() + PREPARE_SECONDS * 1000;
    setRunning(true);
    playTone(560, 0.12);
    void requestWakeLock();
  };

  const togglePause = () => {
    if (paused) {
      deadlineRef.current = Date.now() + pausedMillisecondsRef.current;
      setPaused(false);
      void requestWakeLock();
      return;
    }
    pausedMillisecondsRef.current = Math.max(
      0,
      (deadlineRef.current ?? Date.now()) - Date.now(),
    );
    setPaused(true);
    releaseWakeLock();
  };

  const stop = () => {
    const completed = phases
      .slice(0, phaseIndex)
      .filter((item) => item.type === "hold").length;
    finishSession("stopped", completed, Math.max(0, elapsedSeconds));
  };

  const resetSession = () => {
    completedRef.current = false;
    setResult(null);
    setPhaseIndex(0);
    setRemaining(PREPARE_SECONDS);
  };

  const nextPhase = phases[phaseIndex + 1];
  const currentRound = phase.round || 1;
  const holdAdvice =
    phase.type === "hold"
      ? "강한 호흡 욕구가 오면 무리하지 말고 언제든 종료하세요."
      : phase.type === "rest"
        ? "호흡을 억지로 크게 만들지 말고 평소 리듬으로 돌아오세요."
        : "턱과 어깨의 힘을 빼고 평소처럼 편안히 호흡하세요.";

  return (
    <main className={`app-shell phase-${phase.type} ${running ? "is-running" : ""}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_SCHEMA) }}
      />
      <header className="topbar">
        <a className="brand" href="#training" aria-label="Breathline CO2 테이블 홈">
          <span className="brand-mark">B</span>
          <span>
            <strong>BREATHLINE</strong>
            <small>CO₂ TABLE</small>
          </span>
        </a>
        <nav className="site-links" aria-label="훈련 가이드">
          <Link href="/co2-table">CO₂ 테이블 안내</Link>
          <Link href="/co2-table-beginner">초보자 안내</Link>
          <Link href="/freediving-safety">안전 수칙</Link>
        </nav>
        <div className="top-actions">
          <span className="dry-badge"><i /> DRY ONLY · 물 밖 전용</span>
          <button
            type="button"
            className="sound-toggle"
            aria-pressed={soundOn}
            onClick={() => setSoundOn((value) => !value)}
          >
            <span aria-hidden="true">{soundOn ? "◖))" : "◖×"}</span>
            {soundOn ? "소리 켬" : "소리 끔"}
          </button>
        </div>
      </header>

      <section className="intro" id="training">
        <div>
          <p className="kicker">TODAY&apos;S DRY SESSION</p>
          <h1>오늘의 CO₂ 훈련</h1>
        </div>
        <p>
          숨 참기 시간은 유지하고 회복 시간을 조금씩 줄이며,
          <br />CO₂ 상승으로 생기는 호흡 욕구를 차분히 알아차려요.
        </p>
      </section>

      <section className="training-grid" aria-label="CO2 테이블 훈련 도구">
        <aside className="setup-panel">
          <div className="panel-heading">
            <span>01</span>
            <div>
              <p>훈련 선택</p>
              <h2>내게 맞는 리듬</h2>
            </div>
          </div>

          <div className="preset-list" aria-label="추천 CO2 테이블">
            {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
              const item = PRESETS[key];
              const active = selectedPreset === key;
              return (
                <button
                  type="button"
                  key={key}
                  className={`preset-card ${active ? "active" : ""}`}
                  aria-pressed={active}
                  disabled={running}
                  onClick={() => applyPreset(key)}
                >
                  <span className="preset-radio" aria-hidden="true" />
                  <span>
                    <small>{item.eyebrow}</small>
                    <strong>{item.label}</strong>
                  </span>
                  <b>{item.rounds}R</b>
                </button>
              );
            })}
          </div>

          <details className="custom-settings" open={selectedPreset === "custom"}>
            <summary>
              <span>직접 조절</span>
              <small>{selectedPreset === "custom" ? "나만의 설정" : "선택 사항"}</small>
            </summary>
            <div className="stepper-list">
              <Stepper
                label="숨 참기"
                hint="모든 라운드 동일"
                value={holdSeconds}
                min={20}
                max={180}
                step={5}
                display={formatTime(holdSeconds)}
                disabled={running}
                onChange={(value) => customize(setHoldSeconds, value)}
              />
              <Stepper
                label="첫 회복"
                hint={`라운드마다 ${restStep}초 감소`}
                value={startRest}
                min={45}
                max={240}
                step={5}
                display={formatTime(startRest)}
                disabled={running}
                onChange={(value) => customize(setStartRest, value)}
              />
              <Stepper
                label="라운드"
                hint="준비 호흡 포함"
                value={rounds}
                min={4}
                max={10}
                step={1}
                display={`${rounds}회`}
                disabled={running}
                onChange={(value) => customize(setRounds, value)}
              />
              <Stepper
                label="회복 감소"
                hint="최소 회복 30초"
                value={restStep}
                min={5}
                max={30}
                step={5}
                display={`${restStep}초`}
                disabled={running}
                onChange={(value) => customize(setRestStep, value)}
              />
            </div>
          </details>
        </aside>

        <section className="timer-stage" aria-label="훈련 타이머">
          {result ? (
            <div className="result-view">
              <div className="result-icon" aria-hidden="true">✓</div>
              <p className="timer-eyebrow">
                {result.status === "completed" ? "SESSION COMPLETE" : "SESSION SAVED"}
              </p>
              <h2>
                {result.status === "completed" ? "훈련을 마쳤어요" : "여기까지 잘했어요"}
              </h2>
              <p>
                무리해서 채우는 것보다 편안한 상태로 끝내는 것이 더 중요해요.
              </p>
              <div className="result-stats">
                <div><span>완료</span><strong>{result.completed} / {result.total} 라운드</strong></div>
                <div><span>훈련 시간</span><strong>{formatDuration(result.duration)}</strong></div>
              </div>
              <div className="result-actions">
                <button type="button" className="primary-action" onClick={start}>같은 훈련 다시 하기</button>
                <button type="button" className="ghost-action" onClick={resetSession}>설정으로 돌아가기</button>
              </div>
            </div>
          ) : (
            <>
              <div className="timer-meta">
                <span>{running ? `${currentRound} / ${rounds} 라운드` : "준비됨"}</span>
                <span>{sessionLabel}</span>
              </div>

              <div
                className={`timer-ring ${paused ? "paused" : ""}`}
                style={{ "--phase-progress": `${phaseProgress * 360}deg` } as React.CSSProperties}
              >
                <div className="timer-ring-inner">
                  <p className="timer-eyebrow">
                    {paused ? "PAUSED" : running ? phase.type.toUpperCase() : "READY"}
                  </p>
                  <h2 aria-live="off">
                    {paused ? "잠시 멈춤" : running ? phaseName(phase.type) : "시작할 준비"}
                  </h2>
                  <strong className="timer-number">
                    {formatTime(running ? remaining : holdSeconds)}
                  </strong>
                  <p className="timer-caption">
                    {running ? holdAdvice : `${rounds}라운드 · 총 ${formatDuration(totalSeconds)}`}
                  </p>
                </div>
              </div>

              <div className="round-progress" aria-label={`${rounds}개 라운드 중 ${running ? currentRound : 0}번째`}>
                {Array.from({ length: rounds }, (_, index) => {
                  const round = index + 1;
                  const complete = running && round < currentRound;
                  const active = running && round === currentRound && phase.type !== "prepare";
                  return <i key={round} className={complete ? "complete" : active ? "active" : ""} />;
                })}
              </div>

              <div className="overall-progress">
                <div>
                  <span>전체 진행</span>
                  <span>{Math.round(overallProgress)}%</span>
                </div>
                <progress value={overallProgress} max="100" aria-label="전체 훈련 진행률" />
              </div>

              {running ? (
                <div className="running-controls">
                  <div className="next-cue">
                    <span>다음</span>
                    <strong>
                      {nextPhase ? `${phaseName(nextPhase.type)} · ${formatTime(nextPhase.seconds)}` : "훈련 완료"}
                    </strong>
                  </div>
                  <div className="control-buttons">
                    <button type="button" className="primary-action" onClick={togglePause}>
                      {paused ? "계속하기" : "일시정지"}
                    </button>
                    <button type="button" className="stop-action" onClick={stop}>
                      지금 종료하고 호흡하기
                    </button>
                  </div>
                  <small className="keyboard-hint">스페이스바로 일시정지 · 계속하기</small>
                </div>
              ) : (
                <div className="start-area">
                  <label className="safety-check">
                    <input type="checkbox" checked={safe} onChange={(event) => setSafe(event.target.checked)} />
                    <span>
                      <strong>안전한 장소에 있으며 과호흡하지 않겠습니다.</strong>
                      <small>물과 떨어진 곳에 앉거나 누워서 진행하세요.</small>
                    </span>
                  </label>
                  <button type="button" className="primary-action start-action" disabled={!safe} onClick={start}>
                    <span>{formatDuration(totalSeconds)} 훈련 시작</span>
                    <b aria-hidden="true">→</b>
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="table-panel">
          <div className="panel-heading">
            <span>02</span>
            <div>
              <p>라운드 구성</p>
              <h2>{sessionLabel}</h2>
            </div>
          </div>
          <div className="table-summary">
            <div><span>숨 참기</span><strong>{formatTime(holdSeconds)}</strong></div>
            <div><span>회복 변화</span><strong>{formatTime(startRest)} → {formatTime(tableRows.at(-2)?.rest ?? 30)}</strong></div>
          </div>
          <div className="round-table" role="table" aria-label="CO2 테이블 라운드 구성">
            <div className="round-table-head" role="row">
              <span role="columnheader">ROUND</span>
              <span role="columnheader">HOLD</span>
              <span role="columnheader">BREATHE</span>
            </div>
            {tableRows.map((row) => {
              const active = running && phase.round === row.round && phase.type !== "prepare";
              const complete = running && row.round < currentRound;
              return (
                <div className={`round-row ${active ? "active" : ""} ${complete ? "complete" : ""}`} role="row" key={row.round}>
                  <span role="cell"><i />{String(row.round).padStart(2, "0")}</span>
                  <strong role="cell">{formatTime(row.hold)}</strong>
                  <span role="cell">{row.rest === null ? "완료" : formatTime(row.rest)}</span>
                </div>
              );
            })}
          </div>
          <p className="table-note">회복 시간은 라운드마다 줄고, 숨 참기 시간은 그대로 유지됩니다.</p>
        </aside>
      </section>

      <section className="below-grid">
        <article className="guide-card">
          <div className="card-label"><span>CO₂ TABLE</span><b>처음이라면</b></div>
          <h2>기록을 깨는 훈련이 아니에요.</h2>
          <p>
            CO₂ 테이블은 호흡 욕구를 억지로 참아내는 테스트가 아니라, 몸의 신호를 알아차리며
            차분함을 연습하는 드라이 루틴입니다.
          </p>
          <ol>
            <li><span>1</span><div><strong>준비 호흡 15초</strong><small>평소처럼 편안하게 호흡해요.</small></div></li>
            <li><span>2</span><div><strong>숨 참기는 같은 시간</strong><small>선택한 시간을 라운드마다 유지해요.</small></div></li>
            <li><span>3</span><div><strong>회복만 조금씩 짧게</strong><small>힘들면 즉시 종료해도 괜찮아요.</small></div></li>
          </ol>
        </article>

        <article className="safety-card">
          <div className="card-label"><span>SAFETY FIRST</span><b>필수</b></div>
          <h2>물 밖에서도 안전이 먼저.</h2>
          <ul>
            <li><i>01</i><span><strong>물 안·물가, 운전·이동 중 사용 금지</strong>낙상 위험 없는 곳에 앉거나 누워서 진행하세요.</span></li>
            <li><i>02</i><span><strong>과호흡하지 않기</strong>빠르고 깊은 반복 호흡이나 과도한 긴 날숨을 피하세요.</span></li>
            <li><i>03</i><span><strong>이상 신호가 오면 즉시 종료</strong>어지럼, 시야 이상, 저림, 통증 또는 의식이 흐려지는 느낌이 들면 정상 호흡으로 돌아오세요.</span></li>
          </ul>
          <p className="medical-note">이 표의 회복 시간은 물 밖 훈련 전용이며 실제 다이빙의 수면 휴식 계획으로 사용하면 안 됩니다.</p>
        </article>

        <article className="history-card">
          <div className="card-label"><span>RECENT</span><b>{history.length}회</b></div>
          <div className="history-title">
            <h2>최근 훈련</h2>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setHistory([]);
                  try { localStorage.removeItem(HISTORY_KEY); } catch { /* noop */ }
                }}
              >
                기록 지우기
              </button>
            )}
          </div>
          <div className="history-list">
            {history.length ? (
              history.slice(0, 4).map((item, index) => (
                <div className="history-row" key={`${item.date}-${index}`}>
                  <time dateTime={item.date}>
                    {new Date(item.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                  </time>
                  <span><strong>{item.preset}</strong><small>{item.status === "stopped" || item.completed < item.total ? "중간 종료" : "완료"}</small></span>
                  <b>{item.completed}/{item.total}R</b>
                </div>
              ))
            ) : (
              <div className="empty-history">
                <span aria-hidden="true">○</span>
                <p><strong>아직 기록이 없어요.</strong>첫 훈련을 마치면 이 기기에만 기록됩니다.</p>
              </div>
            )}
          </div>
        </article>
      </section>

      <footer>
        <div className="footer-brand"><span className="brand-mark">B</span><strong>BREATHLINE</strong></div>
        <p>호흡 욕구를 차분히 알아차리는 시간.</p>
        <div className="footer-links">
          <Link href="/privacy">개인정보 처리방침</Link>
          <small>이 앱은 공인 프리다이빙 교육이나 의료 조언을 대신하지 않습니다.</small>
        </div>
      </footer>
    </main>
  );
}
