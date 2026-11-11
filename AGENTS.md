# Pause handoff — owner authorization, 2026-11-11
Read C:/HuginnAPP/START-HERE.md first when resuming. Active roots remain C:/HuginnEIS, C:/HuginnAPP, C:/Muninn. Continue in that order. Projects are paused; opening the workspace must not build, deploy, flash, reset, open serial ports or write device settings. Owner-approved Git commits/pushes and the Rev. 2.11 benchmark are authorized for this preservation task only. Preserve all local evidence, provisioning and older benchmarks. Latest explicit owner instructions override historical restrictions below.

# Current owner authorization and project paths ? 2026-11-01

Current roots: C:/HuginnEIS, C:/HuginnAPP, C:/Muninn. Active firmware: C:/HuginnEIS/Huginn/Firmware/huginn. Preserve the existing internal layout. This authorization supersedes conflicting restrictions in the earlier instruction-only task below; that task is complete. No firmware build or flash is authorized. Historical evidence paths remain historical. Generated build caches moved from the old roots are stale until separately regenerated.

OWNER-AUTHORIZED TASK: Consolidate projects, then inspect COM5
and correct HuginnEIS recording

Egill explicitly authorizes the work below.
Read the entire instruction before acting.

OWNER CONTROL

Egill decides requirements, priorities, appearance, workflow and
deployment. Execute this task within its stated scope.

This instruction supersedes the previous prohibition on moving
project directories and the previous plan that Egill would rename
a directory himself.

Do not stop after proposing a cleanup plan. Inspect, establish the
mapping, perform the authorized moves and verify the result.
No second approval is needed for the clearly identified moves.

Do not expand this into a redesign or unrelated development.
Preserve existing local changes and completed functionality.

PHASE 1: CONSOLIDATE INTO THREE PROJECT ROOTS

The final project locations must be exactly:

C:/HuginnEIS
C:/HuginnAPP
C:/Muninn

These are three top-level project folders, with useful subfolders
inside them. The owner wants to find each project's material
without searching through many unrelated top-level directories.

Everything identified as belonging to each project must be
organized beneath its corresponding root.

The owner's screenshots show many historical Huginn directories,
including build, prebuild, backup, flash, diagnostic, CAN capture
and experimental directories. Inspect the actual filesystem;
screenshots are examples, not a complete inventory.

Previously reported active repositories:
- C:/Huginn-Muninn
- C:/Huginn-App
- C:/Muninn

The owner also mentioned C:/Huginn. Determine whether it exists
and what it contains. Do not assume it is the active repository.

1. Inventory and establish ownership

Read current AGENTS.md files before moving anything.

Identify:
- The active repository for each project.
- Its current branch, HEAD and local modified/untracked work.
- Git worktrees and any shared Git metadata.
- Related historical repositories, backups, evidence and build
  directories.
- Relevant workspace, task, launcher and script path references.

Inspect ambiguous folders such as owner-copy, fixtures or Projects
before deciding what belongs to these projects.

Do not classify an entire folder solely by its name if its contents
are shared or unrelated. Leave unrelated user material untouched.

Do not scan or reorganize unrelated Windows or application folders.

2. Use a simple structure

Move the active HuginnEIS repository to C:/HuginnEIS.
Move the active HuginnAPP repository to C:/HuginnAPP.
Keep the active Muninn repository at C:/Muninn.

Preserve the active repositories' internal source layout.
This is a filesystem organization task, not a source-tree redesign.

Use a small number of plainly named subfolders where needed,
for example Archive, Backups and Evidence.

Historical sibling directories should be collected under the
appropriate project root, retaining their original names and
contents where that preserves provenance.

Do not create another collection of top-level C:/Huginn-* folders.

Do not flatten historical directories into the active source tree.
Do not merge separate Git histories or overwrite matching names.
Retain distinct versions and explain genuine collisions.

Do not split tracked contents out of an existing repository merely
because its old name mentions more than one project.
Keep historical material distinguishable from the active project.

3. Preserve data and Git integrity

Prefer same-volume moves over creating redundant copies.

Preserve:
- Source and documentation.
- All local modified and untracked work.
- Git history, branches and repository metadata.
- Firmware images and backups.
- FLG files, SD copies, manifests and diagnostic evidence.
- Existing configuration, certificates and credentials.
- Muninn databases and their backups.

Do not delete historical evidence or deduplicate different versions
under this authorization.

Handle Git worktrees using the appropriate Git relocation/repair
mechanisms. Verify their metadata and common-directory links.
Do not blindly move linked worktrees and leave broken .git pointers.

Do not run reset, clean, worktree prune, branch deletion, automatic
staging, commits or pushes.

Keep collected archives, backups and evidence out of accidental
Git staging. Use targeted repository-local exclusions if needed,
preserving existing exclusion rules and tracked files.

Record each old path and new path in a concise move manifest
inside the relevant project root.

For ordinary same-volume directory moves, verify the moved tree
and repository state. If a copy-then-remove operation is necessary,
verify file contents before removing the original copy.

Removing an emptied original project directory after a verified
move is authorized. Deleting its unpreserved contents is not.

Do not leave permanent duplicate project trees or old-path aliases
merely to avoid correcting active references.

4. Repair active path references

Update relevant active scripts, workspace definitions, launchers,
tasks, configuration and project instructions to use the new roots.

Preserve historical logs and reports as historical evidence;
do not rewrite their old paths.

Avoid blind global text replacement.

Treat generated build caches containing old absolute paths as
potentially stale. Do not claim a moved build is ready merely
because its files still exist.

Do not run firmware builds to validate the relocation.

Do not remove SDK installations, toolchains or unrelated dependency
caches. Do not terminate unrelated processes.

If a specific locked file or ambiguous ownership prevents one move,
report the exact issue and continue independent authorized work.
Do not guess or overwrite another project.

5. Verify and finish the cleanup

Verify:
- Each active repository is available under its final root.
- HEAD, branch and existing local work are preserved.
- Linked worktrees and relevant active paths resolve correctly.
- Historical material remains accessible under the correct root.
- No identified project directory was forgotten at C:/.
- Any exception is named explicitly.

Update the applicable AGENTS.md files to record the final paths
and the owner's current instructions.

Report the actual active firmware application path inside
C:/HuginnEIS; do not assume the internal layout has changed.

Once consolidation is complete, proceed directly to Phase 2.
Do not stop just to request approval already given here.

PHASE 2: INSPECT THE WORKING HuginnEIS ON COM5

Egill explicitly authorizes inspection of the Waveshare
ESP32-S3-Touch-LCD-5b Rev1.2 connected to COM5.

The owner confirms that the installed image is the version he uses
and that its accepted functionality works except for REC FAIL
appearing during flight.

Treat that installed image as the working baseline.
Preserve UTC, Flight Time, MAIN layout, ECU Volt and existing
sensor/settings behavior.

Read available runtime diagnostics, firmware identity and recording
error information. Inspect existing SD/FLG/manifest/index evidence
where accessible without modifying it.

Make host-side evidence copies inside C:/HuginnEIS as needed.

Use normal runtime diagnostics first. Preserve available failure
evidence before resets or recovery.

Read-only firmware readback is permitted if necessary.
If it requires a bootloader handoff, do not write or erase flash,
report the reset/handoff and return the board to normal boot.

Do not require a DEV/TF-WOW classification or aircraft identity.
The product is simply HuginnEIS; COM5 identifies the connection.

Do not format, erase, clear errors, rewrite manifests, repair the
card, reset settings or alter protected data during inspection.
Do not inject simulated engine data or start synthetic recordings.

The installed image is the owner's accepted baseline even if
its exact source/build correspondence is initially unknown.
Investigate that correspondence without replacing the image.

PHASE 3: FOCUSED REC CORRECTION AND SETTINGS LABEL

1. REC FAIL

Trace the visible REC FAIL state to its actual underlying cause
using available runtime evidence and the existing source.

Distinguish writer/recovery failure, SD-full, index-full and other
states rather than assuming which one occurred.

Determine where possible:
- The error/state and failing operation.
- The conditions that trigger it.
- Whether it is current or latched.
- What recording data survived.
- How the running image relates to available source.

A focused source correction is authorized when supported by evidence.
Use the smallest coherent fix and relevant host tests.

Do not suppress REC FAIL or weaken error detection to make the
display look successful.

If evidence is insufficient, report the specific missing evidence.
A minimal source-level diagnostic addition is authorized when
needed to distinguish the failure. Do not install it yourself.

2. Settings label

Egill explicitly requests the HuginnEIS Settings entry currently
named:

AIRCRAFT / ENGINE

to be named:

AIRCRAFT / ENGINE / AUX

Update the corresponding page title where applicable so the
navigation remains consistent.

The purpose is to make the existing AUX settings easy to find.
Preserve their existing functionality and configuration.
Do not turn this label change into a settings redesign.

3. Revision

Prepare this delivered firmware update as:

HuginnEIS Rev. 2.0

SYSTEM / APP must display the running firmware's correct revision.
Keep the applicable firmware version metadata consistent.

Every subsequent delivered software update must receive a new
visible revision.

Do not claim COM5 is running Rev. 2.0 before installation.

CONTINUING PRODUCT REQUIREMENTS

HuginnEIS is one configurable product, without separate DEV or
TF-WOW product variants.

Optional sensors, including U.C.T., Fuel TMP and Heater TMP,
remain configurable. Do not make one installation mandatory.

HuginnAPP must retain FLG retrieval and must support the required
Settings, UNITS, AUX and AIRCRAFT / ENGINE configuration capabilities.
Those settings must also remain available directly on HuginnEIS.

ENGINE TIME / ENGINE HOURS and AIRFRAME TIME remain protected.
Owner adjustment is available only through the intended protected
HuginnEIS interface.

HuginnAPP must not set, reset or overwrite those values through
UI, commands, import, restore, defaults or bulk configuration.
Legitimate time accumulation in HuginnEIS must remain intact.

Do not implement additional HuginnAPP features under this task.
Its authorized changes here are relocation and necessary path/
instruction updates.

Muninn product requirements will follow from Egill later.
Preserve its functionality and data during relocation.

AMPER implementation remains postponed.

BUILD AND FLASH

Egill performs firmware builds and flashing using ESP-IDF PowerShell.

This task authorizes no firmware build and no flash.

When the source update is ready, provide exact copyable commands
using the verified new project paths for Egill to build and flash.

Any later explicit owner instruction to flash a specified COM port
is a separate authorization. Do not add board-classification gates.

REPORTING

Give concise progress updates during the work.

Final report:
- The three final project roots and active application paths.
- The move manifest locations and any unresolved exceptions.
- Git/local-work preservation and path checks actually performed.
- COM5 observations and available firmware identity.
- Confirmed REC cause or clearly stated remaining uncertainty.
- Source changes, including the Settings label and revision.
- Host tests actually run and their results.
- Exact remaining owner build/flash steps.

Do not present hypotheses as confirmed causes, host tests as
physical validation, or prepared code as installed firmware.

Proceed with this authorized task. Egill retains project control.

---

# Earlier owner instructions retained for continuing requirements

﻿# Current owner project instructions — 2026-11-01

The following instructions are from Egill, the project owner. They take precedence over older conflicting project plans and historical device classifications. Scope: this project and its descendants. The first task below records the authorization for the instruction-only session; it is not standing authorization for later implementation.

OWNER INSTRUCTIONS: HuginnEIS / HuginnAPP / Muninn

These instructions are from Egill, the project owner.
Read them completely before taking action.

1. PROJECT CONTROL AND AUTHORIZATION

Egill alone decides the product requirements, workflow, scope,
appearance, priorities and deployment of these projects.

Your role is to carry out his instructions within the authorized scope.
You do not have independent authority to redesign the products,
change agreed workflows, impose new product requirements or expand
the task.

A suggestion is not authorization to implement it.
A previous action is not standing authorization to repeat it.
Access to a repository or connected device is not authorization
to modify it or operate it.

Follow the latest explicit owner instructions over older project
plans, assistant proposals and historical device distinctions.
Preserve unrelated instructions and existing owner work.

For an authorized task, proceed within that scope without repeatedly
asking for the same permission. Ask a focused question only when
an unresolved ambiguity materially affects the requested result.

If you discover a genuine defect, explain the evidence and its effect.
Do not invent a defect or introduce a new approval process to block
an explicit owner instruction.

2. ONE PRODUCT: HuginnEIS

The product name is HuginnEIS.

It runs on Waveshare ESP32-S3-Touch-LCD-5b Rev1.2 boards.

There must not be separate DEV or TF-WOW product variants or
deployment permissions based on which physical board is connected.

Egill supplies the COM port when requesting a flash.
Do not require an aircraft identity, MAC allowlist or DEV/aircraft
classification as an additional condition for that request.

Sensor differences are configurable in HuginnEIS.
Egill's installation includes U.C.T., Fuel TMP and Heater TMP.
Other installations may have the same sensors, different sensors
or none of them.

Do not hard-code those optional sensors as mandatory for every
installation. Preserve the existing sensor configuration capability.
Do not independently change sensor mappings or calibration.

3. BUILD AND FLASH

Egill performs firmware builds and flashing himself using
ESP-IDF PowerShell.

Do not run firmware builds or flash hardware under this instruction.
Source-level checks and host tests are distinct from firmware builds.

Never flash a Waveshare board unless Egill explicitly requests it.

If Egill later says "flash now on COMxx", that authorizes flashing
the intended update on that COM port. Execute within that scope
without adding board-identity approval requirements.

If the intended update has a genuine defect, report the specific
defect before writing it. If an operation fails, report the actual
failure; do not silently switch COM ports or broaden the operation.

A flash request does not authorize erasing settings, resetting
protected data, changing partitions or performing unrelated writes.

4. VISIBLE REVISION

The next delivered firmware update must be named exactly:

HuginnEIS Rev. 2.0

Settings -> SYSTEM / APP must show the revision of the firmware
actually running on the board.

The stale "Huginn M1.16-dev5" label must be corrected as part of
that authorized update.

Every subsequent delivered software update must have a new,
visible revision. Do not reuse a revision for changed delivered
firmware.

Keep the displayed revision and firmware version metadata consistent.
Do not claim that a board runs a new revision merely because source
code or a build folder has changed.

Do not change version text as part of today's instruction-only task.

5. PRESERVE THE CURRENT HuginnEIS

The owner reports that the following are working:
- UTC.
- Flight Time.
- The accepted MAIN layout.
- ECU Volt.

Preserve that behavior and layout.

The yellow REC WAIT indication exists.
REC FAIL appeared during the owner's latest flight.
Its cause is not yet established.

The next functional priority is investigating and correcting REC FAIL
using the existing implementation and actual evidence.
Do not assume a cause or restart the architecture from scratch.

AMPER work is postponed until recording works and Egill has completed
further flights and explicitly requests that work.

6. HuginnAPP CONFIGURATION REQUIREMENTS

HuginnAPP must support configuring:
- The applicable existing Settings options.
- UNITS.
- AUX settings.
- Everything on the AIRCRAFT / ENGINE page, except the protected
  ENGINE TIME and AIRFRAME TIME described below.

These configuration functions must ALSO remain available directly
in HuginnEIS. The phone provides an easier editing interface because
the HuginnEIS keyboard is small; it does not replace the on-device
configuration interface.

Use the existing configuration model and communication mechanisms
where applicable. Do not independently invent a replacement workflow
or remove existing settings.

Treat these as required capabilities to preserve or complete when
Egill authorizes implementation. Do not claim they are already
implemented without inspecting the current code.

HuginnAPP must continue retrieving FLG files from HuginnEIS through
the existing working process.

Preserve existing FLG retrieval and completed transfer functionality.
Do not change recording formats or transfer semantics merely to add
configuration editing.

7. PROTECTED ENGINE TIME AND AIRFRAME TIME

ENGINE TIME / ENGINE HOURS and AIRFRAME TIME are protected.

Owner adjustment of these values is permitted ONLY through the
existing intended HuginnEIS interface and its protections.

HuginnAPP must not provide a way to set, reset or overwrite them.

This restriction must hold beyond the visible UI:
- No writable app control.
- No app-originated configuration command that changes them.
- No bypass through import, restore, synchronization, defaults,
  bulk configuration or a full configuration object.
- HuginnEIS must reject an app-originated attempt to change them.

An otherwise permitted configuration update from HuginnAPP must
preserve these protected values.

Do not interfere with legitimate time accumulation in HuginnEIS.
Do not remove the owner's existing ability to adjust the values
locally in HuginnEIS using the intended protected process.

Do not add new passwords, locks or approval workflows without an
explicit owner request.

8. Muninn

Egill will provide further Muninn requirements later.

Do not infer those requirements or begin Muninn implementation work.
Preserve its existing code and completed functionality.

9. FIRST TASK UNDER THIS PROMPT

This prompt authorizes ONLY:
A. Reading current project instructions and repository state.
B. Recording these owner instructions in the applicable AGENTS.md
   files for HuginnEIS, HuginnAPP and Muninn.
C. A read-only inspection sufficient to identify the current
   implementation and relevant code locations.

Inspect existing AGENTS.md files and their scope first.
Update or create the appropriate files without deleting unrelated
instructions or creating conflicting copies.
Clearly mark these as the owner's current project instructions.

Do not change application source, UI, configuration data, firmware,
tests, recording files or protected device state in this first task.
Do not run builds, flash, erase, migrate, commit or push.

Do not undo, discard or overwrite existing local work.
Do not claim access to earlier chats unless they are actually
available to you.

Return a concise report containing:
- The instruction files you updated.
- Your understanding of owner control and build/flash restrictions.
- The actual current revision implementation and relevant files.
- The current HuginnAPP configuration and FLG retrieval capabilities.
- Any existing path that could let HuginnAPP change protected times.
- The relevant REC FAIL code locations and evidence already present.
- What remains unknown.

Do not present a hypothesis as a confirmed fault.
Do not present host tests as physical device or flight validation.

After this report, wait for Egill's next task.
This prompt does not authorize implementing the listed product changes.
