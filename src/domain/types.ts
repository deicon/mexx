export const SCHEMA_VERSION = 1;

export type SchemaVersion = typeof SCHEMA_VERSION;

export type ISODate = string;
export type ISODateTime = string;
export type EventId = string;
export type MealTemplateId = string;
export type PhaseId = string;
export type KnownTermId = string;

export type EventType = 'seizure' | 'meal' | 'stool' | 'dose' | 'observation';

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

export type FoodUnit = 'g' | 'ml' | 'piece' | 'tsp' | 'tbsp';

export type ConsumptionStatus = 'eaten' | 'partially-eaten' | 'refused' | 'unknown';

export type FoodComponent = {
  name: string;
  consumedAmount: number;
  unit: FoodUnit;
};

export type DoseCategory = 'supplement' | 'medication' | 'other';

export type DoseUnit = 'g' | 'mg' | 'ml' | 'drops' | 'tablet' | 'capsule' | 'piece';

export type DosePreset = {
  category: DoseCategory;
  name: string;
  administeredAmount: number;
  unit: DoseUnit;
  note?: string;
};

export type MealTemplate = {
  id: MealTemplateId;
  name: string;
  foodComponents: [FoodComponent, ...FoodComponent[]];
  dosePresets?: DosePreset[];
};

export type MealEvent = EventBase<'meal'> & {
  foodComponents: [FoodComponent, ...FoodComponent[]];
  consumptionStatus?: ConsumptionStatus;
  mealTemplateId?: MealTemplateId;
  note?: string;
};

export type StoolQuality = 'firm-formed' | 'normal' | 'soft' | 'mushy' | 'diarrhea';

export type StoolEvent = EventBase<'stool'> & {
  quality: StoolQuality;
  stoolFlags: string[];
  note?: string;
};

export type DoseEvent = EventBase<'dose'> & {
  category: DoseCategory;
  name: string;
  administeredAmount: number;
  unit: DoseUnit;
  associatedMealId?: EventId;
  note?: string;
};

export type ObservationEvent = EventBase<'observation'> & {
  observationTags: string[];
  note?: string;
};

export type TrackerEvent =
  | SeizureEvent
  | MealEvent
  | StoolEvent
  | DoseEvent
  | ObservationEvent;

export type ColorScore = 'green' | 'yellow' | 'orange' | 'red';

export type Phase = {
  id: PhaseId;
  name: string;
  startDate: ISODate;
  endDate?: ISODate;
};

export type KnownTermKind =
  | 'food-name'
  | 'dose-name'
  | 'trigger-tag'
  | 'stool-flag'
  | 'observation-tag';

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
  mealTemplates: MealTemplate[];
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
