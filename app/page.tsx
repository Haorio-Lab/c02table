"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Phase = { type: "hold" | "rest"; seconds: number; round: number };
type Session = { date: string; preset: string; completed: number; total: number };

const PRESETS = {
  beginner: { label: "입문", hold: 45, rest: 90, rounds: 6, step: 10 },
  standard: { label: "스탠더드", hold: 75, rest: 120, rounds: 8, step: 15 },
  advanced: { label: "어드밴스드", hold: 105, rest: 135, rounds: 8, step: 15 },
};

const format = (seconds: number) =>
  `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

export default function Home() {
  const [preset, setPreset] = useState<keyof typeof PRESETS>("beginner");
  const [safe, setSafe] = useState(false);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [history, setHistory] = useState<Session[]>([]);
  const saved = useRef(false);
  const config = PRESETS[preset];

  const phases = useMemo<Phase[]>(() => {
    const result: Phase[] = [];
    for (let round = 1; round <= config.rounds; round++) {
      result.push({ type: "hold", seconds: config.hold, round });
      if (round < config.rounds) {
        result.push({ type: "rest", seconds: Math.max(30, config.rest - (round - 1) * config.step), round });
      }
    }
    return result;
  }, [config]);

  const phase = phases[index];
  const totalSeconds = phases.reduce((sum, item) => sum + item.seconds, 0);
  const elapsedBefore = phases.slice(0, index).reduce((sum, item) => sum + item.seconds, 0);
  const progress = phase ? ((elapsedBefore + phase.seconds - remaining) / totalSeconds) * 100 : 0;

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem("co2-history") || "[]")); } catch { setHistory([]); }
  }, []);

  useEffect(() => {
    if (!running || paused || !phase) return;
    const timer = window.setInterval(() => {
      setRemaining((current) => {
        if (current > 1) return current - 1;
        if (index < phases.length - 1) {
          setIndex((value) => value + 1);
          return phases[index + 1].seconds;
        }
        setRunning(false);
        if (!saved.current) {
          const entry = { date: new Date().toISOString(), preset: config.label, completed: config.rounds, total: config.rounds };
          const next = [entry, ...history].slice(0, 8);
          setHistory(next);
          localStorage.setItem("co2-history", JSON.stringify(next));
          saved.current = true;
        }
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, paused, phase, index, phases, config, history]);

  const start = () => {
    saved.current = false;
    setIndex(0);
    setRemaining(phases[0].seconds);
    setPaused(false);
    setRunning(true);
  };

  const stop = () => {
    if (running && phase) {
      const completed = phases.slice(0, index).filter((item) => item.type === "hold").length;
      const entry = { date: new Date().toISOString(), preset: config.label, completed, total: config.rounds };
      const next = [entry, ...history].slice(0, 8);
      setHistory(next);
      localStorage.setItem("co2-history", JSON.stringify(next));
    }
    setRunning(false);
    setPaused(false);
    setIndex(0);
  };

  return (
    <main>
      <nav className="nav">
        <a className="brand" href="#top" aria-label="Breathline 홈"><span>BL</span> BREATHLINE</a>
        <div className="nav-note">CO₂ TABLE TRAINER <b>01</b></div>
      </nav>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">FREEDIVING · DRY TRAINING</p>
          <h1>불편함과<br /><em>친해지는 시간.</em></h1>
        </div>
        <div className="hero-copy">
          <p>휴식 시간을 단계적으로 줄이며 이산화탄소 내성을 훈련하세요. 물 밖에서, 안전하게, 나만의 호흡 리듬으로.</p>
          <div className="hero-stat"><strong>{format(totalSeconds)}</strong><span>예상 훈련 시간</span></div>
        </div>
      </section>

      <section className="workspace">
        <aside className="setup">
          <div className="section-label">01 / TABLE SETUP</div>
          <h2>오늘의 테이블</h2>
          <div className="preset-grid">
            {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((key) => (
              <button key={key} className={preset === key ? "preset active" : "preset"} onClick={() => !running && setPreset(key)}>
                <span>{PRESETS[key].label}</span><b>{format(PRESETS[key].hold)}</b><small>숨참기</small>
              </button>
            ))}
          </div>
          <div className="table-preview">
            <div className="table-head"><span>ROUND</span><span>HOLD</span><span>REST</span></div>
            {Array.from({ length: config.rounds }, (_, i) => (
              <div className="table-row" key={i}><span>{String(i + 1).padStart(2, "0")}</span><b>{format(config.hold)}</b><span>{i === config.rounds - 1 ? "—" : format(Math.max(30, config.rest - i * config.step))}</span></div>
            ))}
          </div>
        </aside>

        <div className="timer-panel">
          <div className="timer-top"><span>{running ? `${phase?.round} / ${config.rounds} ROUND` : "READY"}</span><span>{running ? (phase?.type === "hold" ? "숨을 참으세요" : "편안히 호흡하세요") : "DRY SESSION"}</span></div>
          <div className={`orb ${running && phase?.type === "hold" ? "holding" : ""}`}>
            <div className="orb-inner"><small>{running ? (phase?.type === "hold" ? "HOLD" : "BREATHE") : "SESSION"}</small><strong>{running ? format(remaining) : format(config.hold)}</strong><span>{running ? (paused ? "일시정지" : "천천히, 힘을 빼세요") : `${config.rounds} ROUNDS`}</span></div>
          </div>
          <div className="progress"><i style={{ width: `${running ? progress : 0}%` }} /></div>
          {!running ? (
            <div className="start-box">
              <label><input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} /><span>나는 물 밖의 안전한 장소에 있으며, 혼자 물속에서 이 훈련을 하지 않습니다.</span></label>
              <button className="primary" disabled={!safe} onClick={start}>훈련 시작 <span>→</span></button>
            </div>
          ) : (
            <div className="controls"><button className="primary" onClick={() => setPaused(!paused)}>{paused ? "계속하기" : "일시정지"}</button><button className="secondary" onClick={stop}>종료</button></div>
          )}
        </div>
      </section>

      <section className="safety">
        <div><span className="section-label">02 / SAFETY FIRST</span><h2>기록보다<br />안전이 먼저.</h2></div>
        <div className="rules">
          <article><b>01</b><h3>반드시 물 밖에서</h3><p>이 앱은 드라이 트레이닝 전용입니다. 물속이나 운전 중에는 절대 사용하지 마세요.</p></article>
          <article><b>02</b><h3>과호흡하지 않기</h3><p>시작 전 평소처럼 편안하게 호흡하세요. 빠르고 깊은 호흡을 반복하지 마세요.</p></article>
          <article><b>03</b><h3>불편하면 즉시 중단</h3><p>어지럼증, 시야 변화, 통증이나 이상을 느끼면 바로 정상 호흡으로 돌아오세요.</p></article>
        </div>
      </section>

      <section className="history">
        <div><span className="section-label">03 / RECENT SESSIONS</span><h2>나의 리듬</h2></div>
        <div className="history-list">
          {history.length ? history.slice(0, 4).map((item, i) => <div className="history-row" key={item.date + i}><span>{new Date(item.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</span><b>{item.preset}</b><span>{item.completed} / {item.total} 라운드</span></div>) : <p className="empty">첫 훈련을 완료하면 이 기기에 기록이 남습니다.</p>}
        </div>
      </section>

      <footer><a className="brand" href="#top"><span>BL</span> BREATHLINE</a><p>Train calm. Dive free.</p><small>의학적 조언을 대체하지 않습니다.</small></footer>
    </main>
  );
}
