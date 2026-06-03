# Mexx Tracker V1 Scope

Mexx Tracker V1 is an offline-first, serverless PWA for iPhone-focused daily tracking of Mexx's seizures, meals, doses, stool, and contextual observations. The app supports fast capture, local-only data storage, manual JSON transfer between devices, CSV analysis export, and a print/PDF-oriented clinical report.

## Goals

- Capture daily events quickly on an iPhone
- Show seizure activity immediately through a calendar color score
- Preserve detailed raw events for later review
- Support veterinary or nutrition consultation through reports and exports
- Allow local backup, restore, and exceptional day transfer from a secondary device

## Core Workflows

- Open dashboard and see today's status, quick actions, and the monthly calendar
- Capture a seizure, meal, stool, or dose from the start screen
- Open a day detail and review or correct events chronologically
- Create a day export on a secondary device and merge it into the primary device
- Create a full backup export and restore or transfer it to another device
- Generate a clinical report for a selected report period
- Export tabular CSV data for external analysis

## Event Model

All events have:

- Event time
- Capture time
- Change time
- Stable event identity
- Deleted state for merge-safe deletion

Events can be created after they happened and corrected later.

## Event Types

### Seizure

Fields:

- Event time
- Severity: light, medium, severe
- Duration class: under 1 min, 1-3 min, 3-5 min, over 5 min, unknown
- Optional exact duration
- Zero or more trigger tags
- Optional note

Known trigger tags are selectable quickly. New trigger tags can be created while capturing a seizure.

Not in V1:

- Dedicated after-effect field
- Diagnostic interpretation

### Meal

Fields:

- Event time
- One or more food components
- Optional consumption status, default eaten
- Optional note
- Optional origin from a meal template

Food components have:

- Name
- Consumed amount
- Controlled unit

Allowed food units:

- `g`
- `ml`
- `piece`
- `tsp`
- `tbsp`

Meal templates are freely named presets used for fast capture. Meals created from templates remain independently editable.

Not in V1:

- Nutrition values
- Fixed meal categories
- Diet rule enforcement

### Dose

Fields:

- Event time
- Category: supplement, medication, other
- Name
- Administered amount
- Controlled unit
- Optional meal association
- Optional note

Allowed dose units:

- `g`
- `mg`
- `ml`
- `drops`
- `tablet`
- `capsule`
- `piece`

Doses can be captured independently or associated with a meal.

### Stool

Fields:

- Event time
- Stool quality: firm/formed, normal, soft, mushy, diarrhea
- Zero or more stool flags
- Optional note

Not in V1:

- Stool amount
- Stool influence on color score

### Observation

Fields:

- Event time
- Zero or more observation tags
- Optional note

Observations are for relevant context that does not fit a more specific event type.

## Dashboard And Day Views

The dashboard contains:

- Today's compact status
- Primary quick actions: seizure, meal, stool, dose
- Monthly calendar view

The calendar color score is derived only from seizure events:

- Green: no recorded seizures
- Yellow: one light seizure
- Orange: multiple light seizures or one medium seizure
- Red: severe seizure, very long seizure, or repeated medium seizures

Stool quality is displayed separately and does not affect the color score.

Day detail shows:

- Compact day summary
- Chronological event list ordered by event time
- Edit access for events

## Phases

Phases are named periods of context, such as diet trials or supplement changes.

Fields:

- Name
- Start date
- Optional end date

Phases can overlap. They are maintained separately from meals and doses, appear as context in reports and day/calendar detail, and do not affect the color score.

## Analysis And Reports

Standard report periods:

- Last 7 days
- Last 30 days
- Last 90 days
- Custom date range

Standard correlation windows before seizures:

- 0-6 hours
- 6-24 hours
- 24-72 hours

Reports show temporal correlations and frequencies only. They must not make causal or diagnostic claims.

The clinical report is primarily for veterinary or nutrition consultation and should include:

- Selected report period
- Calendar overview with seizure color scores
- Seizure list with time, severity, duration, and trigger tags
- Meal and dose summary
- Stool overview
- Relevant phases
- Correlations without diagnostic claims

## Exports And Imports

### Backup Export

Backup export is a full JSON export for restore or transfer to another device.

It includes:

- Active and deleted events
- Meal templates
- Known terms
- App settings
- Schema metadata

### Backup Import

Backup import replaces local state completely.

Requirements:

- Fresh local backup before import
- Import preview
- Explicit confirmation
- Compatible schema version

### Day Export

Day export is a JSON export for exceptional capture on a secondary device.

It includes:

- Events for one calendar day
- Known terms used by those events

It does not include unrelated known terms or all meal templates.

### Day Import

Day import merges into the receiving device.

Rules:

- Existing events are not implicitly deleted
- Same event identity uses newer change time
- Similar events with different identities remain separate
- Deleted events are transferred as deleted state
- Fresh backup is recommended but not required

### CSV Export

CSV export is an analysis package with separate files, not one flat table.

Expected files:

- `events.csv`
- `seizures.csv`
- `meals.csv`
- `food-components.csv`
- `doses.csv`
- `stools.csv`
- `observations.csv`
- `day-states.csv`

CSV is not a restore format.

## Known Terms And Units

Known terms are learned from previous entries and suggested during capture.

Known terms include:

- Food names
- Dose names
- Trigger tags
- Stool flags
- Observation tags

Similar known terms may be suggested for manual merge, but are never merged automatically.

Food components and doses use controlled units. Names remain flexible and reusable.

## Explicitly Out Of Scope For V1

- Cloud sync
- User accounts
- Server backend
- Multiple tracked dogs
- Medical diagnoses or causal claims
- Automatic term merging
- Nutrition database
- Stool amount tracking
- Stool contribution to color score
- Complex diet or therapy planning
- Automatic synchronization between devices
