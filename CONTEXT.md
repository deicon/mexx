# Mexx Tracker

Mexx Tracker supports long-running observation of Mexx's seizures, food intake, stool, and related care signals so patterns can be reviewed over time.

## Language

**Event**:
A timestamped observation or action recorded for Mexx.
_Avoid_: Entry, record, log item

**Event Time**:
The time at which an event actually happened.
_Avoid_: Entry time, creation time

**Capture Time**:
The time at which an event was recorded in the app.
_Avoid_: Event time, logged time

**Change Time**:
The time at which an event was last corrected in the app.
_Avoid_: Event time, logged time

**Seizure**:
An event describing a suspected seizure with severity, duration, and possible triggers.
_Avoid_: Attack, fit

**Seizure Duration Class**:
A coarse duration bucket for a seizure, including unknown.
_Avoid_: Duration text

**Seizure Severity**:
A three-level assessment of a seizure as light, medium, or severe.
_Avoid_: Medical severity classification

**Exact Seizure Duration**:
An optional precise seizure duration.
_Avoid_: Required duration

**Trigger Tag**:
A reusable label for a possible seizure trigger.
_Avoid_: Cause, reason

**Meal**:
An event describing food given to Mexx, including amount, food type, and optional additions.
_Avoid_: Feeding, ration

**Food Component**:
One ingredient or food product with an amount inside a meal.
_Avoid_: Food note, ingredient text

**Consumed Amount**:
The amount of a food component that Mexx actually ate, as far as known.
_Avoid_: Offered amount

**Unit**:
A controlled measurement label used for food components and doses.
_Avoid_: Free unit text

**Known Term**:
A reusable name or tag learned from previous entries.
_Avoid_: Master data, catalog entry

**Term Merge**:
A manual cleanup action that combines two known terms after user confirmation.
_Avoid_: Automatic deduplication

**Meal Template**:
A reusable preset for creating a meal quickly.
_Avoid_: Meal type, standard meal

**Consumption Status**:
An optional meal status indicating whether the offered food was eaten.
_Avoid_: Appetite note

**Stool**:
An event describing a stool passage and its observed quality.
_Avoid_: Poop, bowel movement

**Stool Quality**:
A five-level consistency assessment of a stool event.
_Avoid_: Stool score

**Stool Flag**:
A reusable label for an observed stool abnormality.
_Avoid_: Stool note

**Dose**:
An event describing something administered to Mexx, such as a supplement or medication.
_Avoid_: Medication entry, supplement entry

**Administered Amount**:
The amount of a dose actually given to Mexx, as far as known.
_Avoid_: Planned dose

**Dose Category**:
The kind of administered item, such as supplement, medication, or other.
_Avoid_: Dose type

**Observation**:
An event for relevant context that does not fit a more specific event type.
_Avoid_: Note, miscellaneous entry

**Observation Tag**:
A reusable label for contextual observations.
_Avoid_: Observation category

**Correlation**:
A reported temporal relationship between events without claiming causation.
_Avoid_: Diagnosis, cause

**Correlation Window**:
A standard time range used to compare events before a seizure.
_Avoid_: Lookback, delay bucket

**Clinical Report**:
A PDF or print-oriented report for veterinary or nutrition consultation.
_Avoid_: Diary export, pretty report

**Report Period**:
The date range used for dashboard analysis, CSV export, or a clinical report.
_Avoid_: Filter date

**Phase**:
A named period of relevant context such as a diet trial or supplement change.
_Avoid_: Treatment plan, program

**CSV Export Package**:
A set of CSV files grouped by event and detail type for tabular analysis.
_Avoid_: CSV file, flat export

**Manual Sync**:
Transfer of data between devices by explicit JSON export and import.
_Avoid_: Cloud sync, automatic sync

**Quick Action**:
A start-screen action for capturing a common event with minimal navigation.
_Avoid_: Shortcut, menu item

**Dashboard**:
The start view combining today's status, quick actions, and the calendar.
_Avoid_: Home page, landing page

**Calendar View**:
A month view showing the color score for each day.
_Avoid_: Trend chart

**Day Detail**:
A chronological view of one day's events with a compact summary.
_Avoid_: Grouped day report

**Backup Export**:
A JSON export that contains all local state needed to restore or transfer the tracker.
_Avoid_: JSON export

**Backup Status**:
The visible state of when the last backup export was created.
_Avoid_: Export reminder

**Day Export**:
A JSON export for one calendar day that can be imported into another device.
_Avoid_: Partial backup, daily backup

**Primary Device**:
The device that holds the authoritative long-term tracker data.
_Avoid_: Main phone, master device

**Secondary Device**:
A device used temporarily to capture events before transferring them to the primary device.
_Avoid_: Other phone, helper device

**Tracked Dog**:
The single dog whose events are tracked by the app.
_Avoid_: Pet profile, patient

**Day Import**:
The process of merging a day export into the receiving device.
_Avoid_: Replace day, restore day

**Backup Import**:
The process of replacing local state from a backup export.
_Avoid_: Merge backup

**Import Preview**:
A summary shown before importing a JSON export.
_Avoid_: File dialog

**Schema Version**:
The export format version used to decide whether a JSON import is compatible.
_Avoid_: App version

**Event Identity**:
A stable identifier that lets the same event be recognized across exports and imports.
_Avoid_: Row number, timestamp identity

**Deleted Event**:
An event marked as removed while retaining its identity for import and merge behavior.
_Avoid_: Hard delete, removed row

**Day State**:
A calculated summary of one calendar day derived from that day's events.
_Avoid_: Daily entry, day record

**Color Score**:
The calendar color derived from seizure events for one day.
_Avoid_: Health score, stool score

**Green Day**:
A day with no recorded seizures.
_Avoid_: Perfect day

**Yellow Day**:
A day with one light seizure.
_Avoid_: Slightly bad day

**Orange Day**:
A day with multiple light seizures or one medium seizure.
_Avoid_: Warning day

**Red Day**:
A day with a severe seizure, a very long seizure, or repeated medium seizures.
_Avoid_: Bad day

## Relationships

- A **Day State** is calculated from zero or more **Events**
- An **Event** belongs to exactly one calendar day by its **Event Time**
- A **Day State** has one **Color Score**
- A **Color Score** is calculated from **Seizures**, not from **Stool Quality**
- A **Green Day**, **Yellow Day**, **Orange Day**, or **Red Day** is a possible **Color Score**
- A **Seizure**, **Meal**, **Stool**, **Dose**, or **Observation** is a kind of **Event**
- An **Observation** has zero or more **Observation Tags** and can have an optional note
- A **Dose** may be associated with a **Meal**, but can also be recorded independently
- A **Dose** has one **Dose Category**, a name, an administered amount, and a unit
- A **Dose** can have an optional note
- A **Meal** contains one or more **Food Components**
- **Food Components** and **Doses** use controlled **Units**
- Food component **Units** are g, ml, piece, tsp, and tbsp
- Dose **Units** are g, mg, ml, drops, tablet, capsule, and piece
- **Food Components** have a name, consumed amount, and unit; nutrition values are not tracked in version 1
- A **Meal** can have an optional note
- A **Meal** can have a **Consumption Status** with eaten as the default
- Food names, dose names, trigger tags, and stool flags can become **Known Terms**
- Similar **Known Terms** can be suggested for **Term Merge**, but are not merged automatically
- A **Meal** can be created from a **Meal Template**
- A **Meal** created from a **Meal Template** remains independently editable
- **Meal Templates** are freely named and are not fixed meal categories
- A **Stool** has one **Stool Quality** and can have zero or more **Stool Flags**
- **Stool Quality** values are firm/formed, normal, soft, mushy, and diarrhea
- Stool amount is not tracked in version 1
- A **Correlation** can relate meals, doses, stool, observations, and seizures across time windows
- Standard **Correlation Windows** are 0-6 hours, 6-24 hours, and 24-72 hours before a seizure
- A **Clinical Report** summarizes events and correlations for an external professional audience
- Standard **Report Periods** are the last 7 days, last 30 days, last 90 days, and a custom date range
- A **Phase** has a name, start date, and optional end date
- A **Phase** provides context for reports and calendar detail but does not affect the **Color Score**
- **Phases** are maintained separately from meals and doses
- **Phases** can overlap
- A **CSV Export Package** contains separate CSV files for events, event details, day states, and related components
- **Manual Sync** is the only supported way to move data between devices
- Primary **Quick Actions** are seizure capture, meal capture, stool capture, and dose capture
- The **Dashboard** shows today's status, primary **Quick Actions**, and the **Calendar View**
- The **Day Detail** shows events primarily in chronological order by **Event Time**
- A **Backup Export** contains all local state needed for restore or transfer to another device
- A **Backup Export** includes active and deleted events, meal templates, known terms, app settings, and schema metadata
- JSON exports contain a **Schema Version**
- Imports with an unknown newer **Schema Version** are blocked
- A **Backup Import** replaces the local state completely
- A **Backup Import** requires an **Import Preview** and explicit confirmation before replacement
- A **Backup Status** helps users see whether recent local data has been backed up
- A **Day Export** contains the events and used **Known Terms** for one calendar day
- A **Day Export** does not transfer all **Meal Templates** or unrelated **Known Terms**
- A **Secondary Device** can produce a **Day Export** for import into the **Primary Device**
- A **Day Import** merges events and does not delete existing events implicitly
- A full backup import requires a fresh **Backup Export** before it proceeds
- A **Day Import** recommends but does not require a fresh **Backup Export**
- The **Tracked Dog** is Mexx only
- An **Event Identity** remains stable when an event is exported, imported, and corrected
- During **Day Import**, a newer **Change Time** wins when the same **Event Identity** already exists
- During **Day Import**, similar events with different **Event Identities** remain separate
- A **Deleted Event** is excluded from dashboards and reports but remains available for JSON import and merge behavior
- A **Seizure** can be recorded after it happened and can be corrected later
- A **Seizure** can have zero or more **Trigger Tags**
- Known **Trigger Tags** are selected quickly, and new **Trigger Tags** can be created during seizure capture
- A **Seizure** has one **Seizure Severity**
- A **Seizure** has one **Seizure Duration Class** and may have an **Exact Seizure Duration**
- Seizure after-effects are not tracked as a dedicated field
- A **Seizure** can have an optional note
- An **Event** has one **Event Time**, one **Capture Time**, and one **Change Time**

## Example dialogue

> **Dev:** "Do we store the calendar cell color as user input?"
> **Domain expert:** "No, the **Day State** is calculated from **Events** like seizures, meals, and stool observations."

> **Dev:** "Does bad stool make a green day yellow?"
> **Domain expert:** "No, the **Color Score** reflects seizure activity. **Stool Quality** is shown separately."

> **Dev:** "Can the report say a food caused seizures?"
> **Domain expert:** "No, reports show **Correlations** only. They must not make diagnostic claims."

> **Dev:** "Is the PDF mainly a personal diary?"
> **Domain expert:** "No, the **Clinical Report** is primarily for veterinary or nutrition consultation."

> **Dev:** "If a seizure is entered on Tuesday but happened on Monday, which day does it count for?"
> **Domain expert:** "It counts for Monday because the **Event Time** decides the day; the **Capture Time** only says when we entered it."

## Flagged ambiguities

- "Tracken" can mean recording raw observations or reviewing summaries — resolved: raw observations are **Events**, calendar summaries are **Day States**.
- "Day score" can mean seizure status or overall wellbeing — resolved: the **Color Score** reflects seizure activity only; stool remains a separate observation dimension.
- "Auslöser" can mean a suspected context or a proven cause — resolved: **Trigger Tags** and reports describe suspicion or **Correlation**, never diagnosis.
- "JSON export" can mean full restore or one-day transfer — resolved: **Backup Export** restores the tracker, **Day Export** transfers one calendar day.
