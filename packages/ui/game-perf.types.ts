// Shared types for the GamePerf local expo module
// (apps/mobile/modules/game-perf). Kept in a pure-types file so both the
// .native accessor and the stub anchor can re-export them.
export interface GamePerfDisplayMode {
  id: number;
  width: number;
  height: number;
  refreshRate: number;
  current: boolean;
}

export interface GamePerfThermalSnapshot {
  supported: boolean;
  /** PowerManager THERMAL_STATUS_* int, or -1 when unsupported. */
  status: number;
  /** getThermalHeadroom() 0..1; null when the device reports NaN. */
  headroom: number | null;
  /** getThermalHeadroom(forecastSeconds); null below API 30. */
  headroomForecast: number | null;
}

export interface GamePerfHintSession {
  active: boolean;
  tids: number[];
  /** Why the session did not start: requires-api-31 | no-hint-service | session-unsupported. */
  reason: string | null;
}

export interface GamePerfNativeModule {
  displayModes(): Promise<GamePerfDisplayMode[]>;
  /** modeId > 0 votes for that mode; modeId <= 0 clears the vote. */
  requestDisplayMode(modeId: number): Promise<GamePerfDisplayMode | null>;
  thermalSnapshot(forecastSeconds: number): Promise<GamePerfThermalSnapshot>;
  startHintSession(targetNanos: number, threadNames: string[]): GamePerfHintSession;
  reportWorkDuration(nanos: number): boolean;
  setHintTarget(nanos: number): boolean;
  stopHintSession(): boolean;
}
