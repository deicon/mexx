import Dexie, { Table } from 'dexie';
import {
  AppSettings,
  BackupStatus,
  KnownTerm,
  Phase,
  TrackerEvent
} from '../domain/types';

export type OrderedRecord<T> = T & {
  storageOrder: number;
};

export type SettingsRecord = {
  key: 'app';
  value: AppSettings;
};

export type BackupMetadataRecord = {
  key: 'backupStatus';
  value: BackupStatus;
};

export class TrackerDatabase extends Dexie {
  events!: Table<OrderedRecord<TrackerEvent>, string>;
  knownTerms!: Table<OrderedRecord<KnownTerm>, string>;
  phases!: Table<OrderedRecord<Phase>, string>;
  settings!: Table<SettingsRecord, string>;
  backupMetadata!: Table<BackupMetadataRecord, string>;

  constructor(name = 'mexx-tracker') {
    super(name);

    this.version(1).stores({
      events: 'id, type, eventTime, changeTime, deleted, storageOrder',
      knownTerms: 'id, kind, value, lastUsedTime, storageOrder',
      phases: 'id, startDate, endDate, storageOrder',
      settings: 'key',
      backupMetadata: 'key'
    });
  }
}

export const createTrackerDatabase = (name?: string): TrackerDatabase => new TrackerDatabase(name);

export const trackerDatabase = createTrackerDatabase();
