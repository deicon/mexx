import { z } from 'zod';
import { getEventCalendarDate } from './dayState';
import {
  AppState,
  BackupExportPayload,
  DayExportPayload,
  KnownTerm,
  SCHEMA_VERSION,
  TrackerEvent
} from './types';

const isoDateTimeSchema = z.string().datetime({ offset: true, message: 'Invalid ISO datetime' });
const isoDateSchema = z.string().refine(isCalendarDate, 'Invalid calendar date');

const activeLifecycleSchema = {
  deleted: z.literal(false).optional()
};

const deletedLifecycleSchema = {
  deleted: z.literal(true),
  deletedTime: isoDateTimeSchema
};

const commonEventFields = {
  id: z.string(),
  eventTime: isoDateTimeSchema,
  captureTime: isoDateTimeSchema,
  changeTime: isoDateTimeSchema
};

const exactDurationSchema = z
  .object({
    value: z.number(),
    unit: z.enum(['seconds', 'minutes'])
  })
  .strict();

const foodComponentSchema = z
  .object({
    name: z.string(),
    consumedAmount: z.number(),
    unit: z.enum(['g', 'ml', 'piece', 'tsp', 'tbsp'])
  })
  .strict();

const dosePresetSchema = z
  .object({
    category: z.enum(['supplement', 'medication', 'other']),
    name: z.string(),
    administeredAmount: z.number(),
    unit: z.enum(['g', 'mg', 'ml', 'drops', 'tablet', 'capsule', 'piece']),
    note: z.string().optional()
  })
  .strict();

const mealTemplateSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    foodComponents: z.tuple([foodComponentSchema]).rest(foodComponentSchema),
    dosePresets: z.array(dosePresetSchema).optional()
  })
  .strict();

const seizureFields = {
  type: z.literal('seizure'),
  severity: z.enum(['light', 'medium', 'severe']),
  durationClass: z.enum(['under-1-min', '1-3-min', '3-5-min', 'over-5-min', 'unknown']),
  exactDuration: exactDurationSchema.optional(),
  triggerTags: z.array(z.string()),
  note: z.string().optional()
};

const mealFields = {
  type: z.literal('meal'),
  foodComponents: z.tuple([foodComponentSchema]).rest(foodComponentSchema),
  consumptionStatus: z.enum(['eaten', 'partially-eaten', 'refused', 'unknown']).optional(),
  mealTemplateId: z.string().optional(),
  note: z.string().optional()
};

const stoolFields = {
  type: z.literal('stool'),
  quality: z.enum(['firm-formed', 'normal', 'soft', 'mushy', 'diarrhea']),
  stoolFlags: z.array(z.string()),
  note: z.string().optional()
};

const doseFields = {
  type: z.literal('dose'),
  category: z.enum(['supplement', 'medication', 'other']),
  name: z.string(),
  administeredAmount: z.number(),
  unit: z.enum(['g', 'mg', 'ml', 'drops', 'tablet', 'capsule', 'piece']),
  associatedMealId: z.string().optional(),
  note: z.string().optional()
};

const observationFields = {
  type: z.literal('observation'),
  observationTags: z.array(z.string()),
  note: z.string().optional()
};

function activeEventSchema<TFields extends z.ZodRawShape>(fields: TFields) {
  return z
    .object({
      ...commonEventFields,
      ...activeLifecycleSchema,
      ...fields
    })
    .strict();
}

function deletedEventSchema<TFields extends z.ZodRawShape>(fields: TFields) {
  return z
    .object({
      ...commonEventFields,
      ...deletedLifecycleSchema,
      ...fields
    })
    .strict();
}

const trackerEventSchema = z.union([
  activeEventSchema(seizureFields),
  deletedEventSchema(seizureFields),
  activeEventSchema(mealFields),
  deletedEventSchema(mealFields),
  activeEventSchema(stoolFields),
  deletedEventSchema(stoolFields),
  activeEventSchema(doseFields),
  deletedEventSchema(doseFields),
  activeEventSchema(observationFields),
  deletedEventSchema(observationFields)
]);

const knownTermSchema = z
  .object({
    id: z.string(),
    kind: z.enum(['food-name', 'dose-name', 'trigger-tag', 'stool-flag', 'observation-tag']),
    value: z.string(),
    lastUsedTime: isoDateTimeSchema.optional(),
    useCount: z.number().optional()
  })
  .strict();

const phaseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    startDate: isoDateSchema,
    endDate: isoDateSchema.optional()
  })
  .strict();

const appSettingsSchema = z
  .object({
    trackedDogName: z.literal('Mexx'),
    backupStatus: z
      .object({
        lastBackupTime: isoDateTimeSchema.optional()
      })
      .strict()
      .optional()
  })
  .strict();

const appStateSchema: z.ZodType<AppState> = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    events: z.array(trackerEventSchema),
    mealTemplates: z.array(mealTemplateSchema),
    knownTerms: z.array(knownTermSchema),
    phases: z.array(phaseSchema),
    settings: appSettingsSchema
  })
  .strict()
  .superRefine((state, ctx) => {
    addDuplicateIdIssues(ctx, state.events, ['events'], 'event');
    addDuplicateIdIssues(ctx, state.mealTemplates, ['mealTemplates'], 'meal template');
    addDuplicateIdIssues(ctx, state.knownTerms, ['knownTerms'], 'known-term');
    addDuplicateIdIssues(ctx, state.phases, ['phases'], 'phase');
  });

const backupExportSchema: z.ZodType<BackupExportPayload> = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    exportType: z.literal('backup'),
    exportedAt: isoDateTimeSchema,
    state: appStateSchema
  })
  .strict();

const dayExportSchema: z.ZodType<DayExportPayload> = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    exportType: z.literal('day'),
    exportedAt: isoDateTimeSchema,
    date: isoDateSchema,
    events: z.array(trackerEventSchema),
    knownTerms: z.array(knownTermSchema)
  })
  .strict()
  .superRefine((dayExport, ctx) => {
    addDuplicateIdIssues(ctx, dayExport.events, ['events'], 'event');
    addDuplicateIdIssues(ctx, dayExport.knownTerms, ['knownTerms'], 'known-term');

    if (!isCalendarDate(dayExport.date)) {
      return;
    }

    dayExport.events.forEach((event, index) => {
      if (!isISODateTime(event.eventTime)) {
        return;
      }

      if (getEventCalendarDate(event.eventTime) !== dayExport.date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Event does not belong to declared day export date',
          path: ['events', index, 'eventTime']
        });
      }
    });
  });

export function parseBackupExport(payload: unknown): BackupExportPayload {
  assertNoFutureSchemaVersion(payload, 'backup');

  try {
    return backupExportSchema.parse(payload);
  } catch (error) {
    throw new Error(`Invalid backup export: ${formatParseError(error)}`);
  }
}

export function parseDayExport(payload: unknown): DayExportPayload {
  assertNoFutureSchemaVersion(payload, 'day');

  try {
    return dayExportSchema.parse(payload);
  } catch (error) {
    throw new Error(`Invalid day export: ${formatParseError(error)}`);
  }
}

export function createBackupExport(state: AppState, exportedAt: string): BackupExportPayload {
  return parseBackupExport({
    schemaVersion: SCHEMA_VERSION,
    exportType: 'backup',
    exportedAt,
    state
  });
}

export function createDayExport(state: AppState, date: string, exportedAt: string): DayExportPayload {
  const events = state.events.filter((event) => getEventCalendarDate(event.eventTime) === date);
  const usedKnownTerms = selectKnownTermsUsedByEvents(state.knownTerms, events);

  return parseDayExport({
    schemaVersion: SCHEMA_VERSION,
    exportType: 'day',
    exportedAt,
    date,
    events,
    knownTerms: usedKnownTerms
  });
}

export function applyBackupImport(_localState: AppState, backup: BackupExportPayload): AppState {
  return parseBackupExport(backup).state;
}

export function applyDayImport(localState: AppState, dayExport: DayExportPayload): AppState {
  const parsedDayExport = parseDayExport(dayExport);
  const importedById = new Map(parsedDayExport.events.map((event) => [event.id, event]));
  const mergedEvents = localState.events.map((localEvent) => {
    const importedEvent = importedById.get(localEvent.id);

    if (!importedEvent) {
      return localEvent;
    }

    importedById.delete(localEvent.id);
    return isLaterInstant(importedEvent.changeTime, localEvent.changeTime) ? importedEvent : localEvent;
  });

  mergedEvents.push(...importedById.values());

  return {
    ...localState,
    events: mergedEvents,
    knownTerms: mergeKnownTerms(localState.knownTerms, parsedDayExport.knownTerms)
  };
}

function selectKnownTermsUsedByEvents(knownTerms: KnownTerm[], events: TrackerEvent[]): KnownTerm[] {
  const usedTerms = new Set<string>();

  for (const event of events) {
    if (event.type === 'seizure') {
      event.triggerTags.forEach((value) => usedTerms.add(termKey('trigger-tag', value)));
    }

    if (event.type === 'meal') {
      event.foodComponents.forEach((food) => usedTerms.add(termKey('food-name', food.name)));
    }

    if (event.type === 'stool') {
      event.stoolFlags.forEach((value) => usedTerms.add(termKey('stool-flag', value)));
    }

    if (event.type === 'dose') {
      usedTerms.add(termKey('dose-name', event.name));
    }

    if (event.type === 'observation') {
      event.observationTags.forEach((value) => usedTerms.add(termKey('observation-tag', value)));
    }
  }

  return knownTerms.filter((knownTerm) => usedTerms.has(termKey(knownTerm.kind, knownTerm.value)));
}

function mergeKnownTerms(localTerms: KnownTerm[], importedTerms: KnownTerm[]): KnownTerm[] {
  const importedById = new Map(importedTerms.map((term) => [term.id, term]));
  const mergedTerms = localTerms.map((localTerm) => {
    const importedTerm = importedById.get(localTerm.id);

    if (!importedTerm) {
      return localTerm;
    }

    importedById.delete(localTerm.id);
    return chooseKnownTerm(localTerm, importedTerm);
  });

  mergedTerms.push(...importedById.values());
  return mergedTerms;
}

function chooseKnownTerm(localTerm: KnownTerm, importedTerm: KnownTerm): KnownTerm {
  if (!localTerm.lastUsedTime) {
    return importedTerm.lastUsedTime ? importedTerm : localTerm;
  }

  if (!importedTerm.lastUsedTime) {
    return localTerm;
  }

  return isLaterInstant(importedTerm.lastUsedTime, localTerm.lastUsedTime) ? importedTerm : localTerm;
}

function termKey(kind: KnownTerm['kind'], value: string): string {
  return `${kind}:${value}`;
}

function isLaterInstant(left: string, right: string): boolean {
  return Date.parse(left) > Date.parse(right);
}

function addDuplicateIdIssues(
  ctx: z.RefinementCtx,
  items: { id: string }[],
  path: (string | number)[],
  label: string
): void {
  const seenIds = new Set<string>();

  items.forEach((item, index) => {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Duplicate ${label} ID: ${item.id}`,
      path: [...path, index, 'id']
    });
  });
}

function isISODateTime(value: string): boolean {
  return isoDateTimeSchema.safeParse(value).success;
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function assertNoFutureSchemaVersion(payload: unknown, exportType: 'backup' | 'day'): void {
  if (!isRecord(payload)) {
    return;
  }

  assertSchemaVersionValue(payload.schemaVersion, exportType);

  if (exportType === 'backup' && isRecord(payload.state)) {
    assertSchemaVersionValue(payload.state.schemaVersion, exportType);
  }
}

function assertSchemaVersionValue(schemaVersion: unknown, exportType: 'backup' | 'day'): void {
  if (typeof schemaVersion === 'number' && schemaVersion > SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version for ${exportType} export: ${schemaVersion}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatParseError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.errors.map((issue) => issue.message).join('; ');
  }

  return 'payload does not match V1 schema';
}
