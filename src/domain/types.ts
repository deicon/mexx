export const SCHEMA_VERSION = 1;

export type SchemaVersion = typeof SCHEMA_VERSION;

export type ISODate = string;
export type ISODateTime = string;
export type EventId = string;
export type PhaseId = string;
export type KnownTermId = string;

export type EventType = 'seizure' | 'observation' | 'therapy_dog';

export type DeletedState = {
  deleted: true;
  deletedTime: ISODateTime;
};

export type ActiveState = {
  deleted?: false;
  deletedTime?: never;
};

export type EventLifecycleState = ActiveState | DeletedState;

export type EventBase<TType extends EventType> = EventLifecycleState & {
  id: EventId;
  type: TType;
  eventTime: ISODateTime;
  captureTime: ISODateTime;
  changeTime: ISODateTime;
};

export type SeizureSeverity = 'light' | 'medium' | 'severe';

export type SeizureDurationClass =
  | 'under-1-min'
  | '1-3-min'
  | '3-5-min'
  | 'over-5-min'
  | 'unknown';

export type ExactDuration = {
  value: number;
  unit: 'seconds' | 'minutes';
};

export type SeizureEvent = EventBase<'seizure'> & {
  severity: SeizureSeverity;
  durationClass: SeizureDurationClass;
  exactDuration?: ExactDuration;
  triggerTags: string[];
  note?: string;
};

export type ObservationEvent = EventBase<'observation'> & {
  observationTags: string[];
  note?: string;
};

export type TherapyDogIntensity = 'light' | 'medium' | 'heavy';

export type TherapyDogEvent = EventBase<'therapy_dog'> & {
  intensity: TherapyDogIntensity;
  durationMinutes?: number;
  tags: string[];
  note?: string;
};

export type TrackerEvent =
  | SeizureEvent
  | ObservationEvent
  | TherapyDogEvent;

export type ColorScore = 'green' | 'yellow' | 'orange' | 'red';

export type Phase = {
  id: PhaseId;
  name: string;
  startDate: ISODate;
  endDate?: ISODate;
};

export type KnownTermKind = 'trigger-tag' | 'observation-tag' | 'therapy-tag';

export type KnownTerm = {
  id: KnownTermId;
  kind: KnownTermKind;
  value: string;
  lastUsedTime?: ISODateTime;
  useCount?: number;
};

export type BackupStatus = {
  lastBackupTime?: ISODateTime;
};

export type AppSettings = {
  trackedDogName: 'Mexx';
  backupStatus?: BackupStatus;
};

export type AppState = {
  schemaVersion: SchemaVersion;
  events: TrackerEvent[];
  knownTerms: KnownTerm[];
  phases: Phase[];
  settings: AppSettings;
};

export type BackupExportPayload = {
  schemaVersion: SchemaVersion;
  exportType: 'backup';
  exportedAt: ISODateTime;
  state: AppState;
};

export type DayExportPayload = {
  schemaVersion: SchemaVersion;
  exportType: 'day';
  exportedAt: ISODateTime;
  date: ISODate;
  events: TrackerEvent[];
  knownTerms: KnownTerm[];
};
